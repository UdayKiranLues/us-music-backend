import Song from '../models/Song.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

/**
 * Diagnose playback issues for a song
 * @route GET /api/v1/diagnostics/song/:id
 * @access Public
 */
export const diagnoseSongPlayback = asyncHandler(async (req, res) => {
  const songId = req.params.id;

  const song = await Song.findById(songId)
    .select('_id title artist duration hlsUrl')
    .lean();

  if (!song) {
    throw new AppError('Song not found', 404);
  }

  const diagnostics = {
    songId: song._id,
    title: song.title,
    artist: song.artist,
    duration: song.duration,
    hlsUrl: song.hlsUrl,
    issues: [],
    warnings: [],
  };

  // Check 1: Duration validation
  if (!song.duration || song.duration < 1) {
    diagnostics.issues.push('❌ Invalid duration: ' + song.duration);
  } else if (song.duration === 59) {
    diagnostics.issues.push('⚠️ CRITICAL: Song duration is exactly 59 seconds - this is likely a transcoding issue');
  } else if (song.duration < 30) {
    diagnostics.warnings.push(`⚠️ Song is very short: ${song.duration}s`);
  }

  // Check 2: HLS URL validation
  if (!song.hlsUrl || !song.hlsUrl.endsWith('.m3u8')) {
    diagnostics.issues.push('❌ Invalid HLS URL: ' + song.hlsUrl);
  }

  // Check 3: Local HLS files (if using local storage)
  if (config.storage.type === 'local') {
    const hlsDir = path.resolve(config.storage.localDir, 'songs', songId, 'hls');
    
    if (fs.existsSync(hlsDir)) {
      diagnostics.localHLSDir = hlsDir;
      const files = fs.readdirSync(hlsDir);
      diagnostics.hlsFiles = files;

      // Check playlist file
      const playlistPath = path.join(hlsDir, 'playlist.m3u8');
      if (fs.existsSync(playlistPath)) {
        const playlistContent = fs.readFileSync(playlistPath, 'utf8');
        diagnostics.playlistPreview = playlistContent.split('\n').slice(0, 20).join('\n');
        
        // Count segments
        const segmentCount = (playlistContent.match(/segment\d+\.ts/g) || []).length;
        diagnostics.segmentCount = segmentCount;

        // Calculate estimated duration from segments
        const targetDurationMatch = playlistContent.match(/#EXT-X-TARGETDURATION:(\d+)/);
        if (targetDurationMatch) {
          const targetDuration = parseInt(targetDurationMatch[1]);
          const estimatedDuration = segmentCount * targetDuration;
          diagnostics.estimatedDuration = estimatedDuration;
          
          if (Math.abs(estimatedDuration - song.duration) > 5) {
            diagnostics.warnings.push(
              `⚠️ Duration mismatch: DB=${song.duration}s, Estimated from segments=${estimatedDuration}s`
            );
          }
        }
      } else {
        diagnostics.issues.push('❌ playlist.m3u8 not found in HLS directory');
      }
    } else {
      diagnostics.warnings.push(`⚠️ Local HLS directory not found: ${hlsDir}`);
    }
  }

  // Check 4: Common 59-second indicators
  if (song.duration === 59) {
    diagnostics.analysis = {
      suspectedReason: 'FFmpeg encoding timeout or segment limit during upload',
      solution:
        '1. Re-upload the song\n2. Check server FFmpeg configuration\n3. Verify no encoding timeout limits',
      debugSteps: [
        'Check backend logs for FFmpeg errors during song upload',
        'Verify original audio file duration before upload',
        'Test FFmpeg manually: ffmpeg -i input.mp3 -f null - (should complete without timeout)',
      ],
    };
  }

  logger.info(`Diagnostics for song ${songId}:`, diagnostics);

  res.json({
    success: true,
    data: diagnostics,
  });
});

/**
 * Check system readiness for audio processing
 * @route GET /api/v1/diagnostics/system
 * @access Public
 */
export const checkSystemHealth = asyncHandler(async (req, res) => {
  const health = {
    ffmpeg: false,
    storage: false,
    database: true, // Assume if we got here, DB is OK
    recommendations: [],
  };

  // Check FFmpeg
  try {
    const { checkFFmpegAvailability } = await import('../services/ffmpegService.js');
    health.ffmpeg = await checkFFmpegAvailability();
  } catch (err) {
    health.ffmpeg = false;
    health.recommendations.push('❌ FFmpeg is not available - audio processing will fail');
  }

  // Check storage
  try {
    if (config.storage.type === 'local') {
      const testPath = config.storage.localDir;
      fs.accessSync(testPath, fs.constants.W_OK);
      health.storage = true;
    } else if (config.storage.type === 's3') {
      // For S3, we assume it's OK if config exists
      health.storage = true;
    }
  } catch (err) {
    health.storage = false;
    health.recommendations.push(`❌ Storage is not writable: ${err.message}`);
  }

  if (!health.ffmpeg) {
    health.recommendations.push('Install FFmpeg to enable audio processing');
  }

  res.json({
    success: true,
    data: health,
  });
});

/**
 * Check specific song for playback issues
 * @route POST /api/v1/diagnostics/test-playback
 * @access Public
 */
export const testPlayback = asyncHandler(async (req, res) => {
  const { songId, duration, streamUrl } = req.body;

  if (!songId || !streamUrl) {
    throw new AppError('songId and streamUrl are required', 400);
  }

  const result = {
    songId,
    streamUrl,
    tests: {},
  };

  // Test 1: Check stream URL accessibility
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(streamUrl, { method: 'HEAD', timeout: 5000 });
    result.tests.urlAccessibility = {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    };
  } catch (err) {
    result.tests.urlAccessibility = {
      error: err.message,
    };
  }

  // Test 2: Expected duration check
  if (duration === 59) {
    result.tests.durationCheck = {
      status: 'CRITICAL',
      message: '59-second duration detected - likely encoding issue',
      recommendation: 'Re-upload the song',
    };
  } else if (duration < 10) {
    result.tests.durationCheck = {
      status: 'WARNING',
      message: `Very short duration: ${duration}s`,
    };
  } else {
    result.tests.durationCheck = {
      status: 'OK',
      duration,
    };
  }

  res.json({
    success: true,
    data: result,
  });
});
