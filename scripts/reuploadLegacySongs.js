import fs from 'fs';
import path from 'path';
import connectDB from '../src/config/database.js';
import config from '../src/config/index.js';
import Song from '../src/models/Song.js';
import { fileExistsInS3, uploadHLSToS3 } from '../src/utils/s3.js';

const args = new Set(process.argv.slice(2));
const execute = args.has('--execute');
const verbose = args.has('--verbose');

const parseLimitArg = () => {
  const raw = process.argv.find((arg) => arg.startsWith('--limit='));
  if (!raw) return null;
  const parsed = Number.parseInt(raw.split('=')[1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseSongArg = () => {
  const raw = process.argv.find((arg) => arg.startsWith('--song='));
  return raw ? raw.split('=')[1] : null;
};

const limit = parseLimitArg();
const targetSongId = parseSongArg();

const getExpectedPlaylistKey = (songId) => `songs/${songId}/hls/playlist.m3u8`;
const getLocalHlsDir = (songId) => path.resolve(config.storage.localDir, 'songs', String(songId), 'hls');
const isNormalizedKey = (value, songId) => value === getExpectedPlaylistKey(songId);
const isLegacyLocalUrl = (value = '') =>
  value.startsWith('http://localhost') ||
  value.includes('/uploads/') ||
  value.includes('\\');

const inspectPlaylist = (playlistPath) => {
  if (!fs.existsSync(playlistPath)) {
    return {
      exists: false,
      segmentCount: 0,
      targetDuration: null,
      playlistType: null,
      hasEndList: false,
      recoverable: false,
      broken: false,
    };
  }

  const content = fs.readFileSync(playlistPath, 'utf8');
  const segmentCount = (content.match(/^segment\d+\.ts$/gm) || []).length;
  const targetDurationMatch = content.match(/#EXT-X-TARGETDURATION:(\d+)/);
  const playlistTypeMatch = content.match(/#EXT-X-PLAYLIST-TYPE:(\w+)/);
  const targetDuration = targetDurationMatch ? Number.parseInt(targetDurationMatch[1], 10) : null;
  const playlistType = playlistTypeMatch ? playlistTypeMatch[1] : null;
  const hasEndList = content.includes('#EXT-X-ENDLIST');
  const recoverable = segmentCount > 1 && (targetDuration || 0) > 0;
  const broken = !recoverable;

  return {
    exists: true,
    segmentCount,
    targetDuration,
    playlistType,
    hasEndList,
    recoverable,
    broken,
  };
};

const getLocalHlsFiles = (songId) => {
  const localDir = getLocalHlsDir(songId);
  if (!fs.existsSync(localDir)) {
    return [];
  }

  return fs.readdirSync(localDir)
    .map((name) => ({
      name,
      path: path.join(localDir, name),
    }))
    .filter((file) => fs.statSync(file.path).isFile());
};

const logSong = (prefix, song, details = '') => {
  console.log(`${prefix} ${song.title} (${song._id})${details ? ` - ${details}` : ''}`);
};

const summary = {
  scanned: 0,
  repaired: [],
  normalized: [],
  alreadyHealthy: [],
  needsOriginalReupload: [],
  missingAssets: [],
  skippedExternal: [],
  errors: [],
};

const run = async () => {
  await connectDB();

  const query = targetSongId ? { _id: targetSongId } : {};
  let cursor = Song.find(query)
    .sort({ createdAt: 1 })
    .select('_id title artist hlsUrl createdAt');

  if (limit) {
    cursor = cursor.limit(limit);
  }

  const songs = await cursor;

  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Songs selected: ${songs.length}`);

  for (const song of songs) {
    summary.scanned += 1;

    const songId = String(song._id);
    const expectedKey = getExpectedPlaylistKey(songId);
    const localDir = getLocalHlsDir(songId);
    const localPlaylist = path.join(localDir, 'playlist.m3u8');
    const playlistInfo = inspectPlaylist(localPlaylist);

    let s3HasExpectedKey = false;
    try {
      s3HasExpectedKey = await fileExistsInS3(expectedKey);
    } catch (error) {
      summary.errors.push({
        id: songId,
        title: song.title,
        reason: `S3 check failed: ${error.message}`,
      });
      logSong('ERROR', song, `S3 check failed: ${error.message}`);
      continue;
    }

    if (verbose) {
      logSong(
        'CHECK',
        song,
        `hlsUrl=${song.hlsUrl} local=${playlistInfo.exists ? 'yes' : 'no'} segments=${playlistInfo.segmentCount} s3=${s3HasExpectedKey ? 'yes' : 'no'}`
      );
    }

    if (isNormalizedKey(song.hlsUrl, songId) && s3HasExpectedKey) {
      summary.alreadyHealthy.push({ id: songId, title: song.title });
      continue;
    }

    if (s3HasExpectedKey) {
      if (!isNormalizedKey(song.hlsUrl, songId)) {
        if (execute) {
          song.hlsUrl = expectedKey;
          await song.save();
        }
        summary.normalized.push({ id: songId, title: song.title, from: song.hlsUrl, to: expectedKey });
        logSong(execute ? 'NORMALIZED' : 'WOULD NORMALIZE', song, `to ${expectedKey}`);
      } else {
        summary.alreadyHealthy.push({ id: songId, title: song.title });
      }
      continue;
    }

    if (playlistInfo.recoverable) {
      const files = getLocalHlsFiles(songId);

      if (files.length === 0) {
        summary.missingAssets.push({ id: songId, title: song.title, reason: 'Playlist looked recoverable but files were missing' });
        logSong('MISSING', song, 'playlist metadata exists but HLS files were missing');
        continue;
      }

      if (execute) {
        await uploadHLSToS3(files, songId);
        song.hlsUrl = expectedKey;
        await song.save();
      }

      summary.repaired.push({
        id: songId,
        title: song.title,
        from: song.hlsUrl,
        to: expectedKey,
        segmentCount: playlistInfo.segmentCount,
      });
      logSong(execute ? 'REPAIRED' : 'WOULD REPAIR', song, `${playlistInfo.segmentCount} HLS segments ready for S3 upload`);
      continue;
    }

    if (playlistInfo.exists && playlistInfo.broken) {
      summary.needsOriginalReupload.push({
        id: songId,
        title: song.title,
        reason: `broken local HLS playlist (segments=${playlistInfo.segmentCount}, targetDuration=${playlistInfo.targetDuration ?? 'missing'})`,
      });
      logSong('NEEDS SOURCE', song, `broken local playlist in ${localDir}`);
      continue;
    }

    if (!playlistInfo.exists && !s3HasExpectedKey && !isLegacyLocalUrl(song.hlsUrl) && !isNormalizedKey(song.hlsUrl, songId)) {
      summary.skippedExternal.push({
        id: songId,
        title: song.title,
        reason: `external or unsupported hlsUrl: ${song.hlsUrl}`,
      });
      logSong('SKIPPED', song, 'external HLS URL is not managed by this migration');
      continue;
    }

    summary.missingAssets.push({
      id: songId,
      title: song.title,
      reason: 'no local HLS files and expected S3 key missing',
    });
    logSong('MISSING', song, 'no local playlist and expected S3 key missing');
  }

  console.log('\nSummary');
  console.log(`Scanned: ${summary.scanned}`);
  console.log(`Already healthy: ${summary.alreadyHealthy.length}`);
  console.log(`${execute ? 'Repaired' : 'Repairable'} local songs: ${summary.repaired.length}`);
  console.log(`${execute ? 'Normalized' : 'Normalizable'} DB paths: ${summary.normalized.length}`);
  console.log(`Needs original reupload: ${summary.needsOriginalReupload.length}`);
  console.log(`Missing assets: ${summary.missingAssets.length}`);
  console.log(`Skipped external URLs: ${summary.skippedExternal.length}`);
  console.log(`Errors: ${summary.errors.length}`);

  if (summary.needsOriginalReupload.length > 0) {
    console.log('\nSongs that still need the original source file');
    for (const item of summary.needsOriginalReupload) {
      console.log(`- ${item.title} (${item.id}) - ${item.reason}`);
    }
  }

  if (summary.missingAssets.length > 0) {
    console.log('\nSongs with no recoverable assets found');
    for (const item of summary.missingAssets) {
      console.log(`- ${item.title} (${item.id}) - ${item.reason}`);
    }
  }

  if (summary.errors.length > 0) {
    console.log('\nErrors');
    for (const item of summary.errors) {
      console.log(`- ${item.title} (${item.id}) - ${item.reason}`);
    }
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await import('mongoose').then(({ default: mongoose }) => mongoose.connection.close().catch(() => {}));
  });
