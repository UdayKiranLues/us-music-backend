import { getSignedS3Url } from '../utils/s3.js';
/**
 * Get presigned S3 URL for a song's cover image
 * @route GET /api/v1/songs/:id/cover-signed-url
 * @access Public
 */
export const getCoverSignedUrl = asyncHandler(async (req, res) => {
  const song = await Song.findById(req.params.id).select('coverImageUrl').lean();
  if (!song || !song.coverImageUrl) {
    throw new AppError('Song or cover image not found', 404);
  }

  // If it's a local URL, return it as is
  if (song.coverImageUrl.startsWith('http://localhost') || song.coverImageUrl.includes('/uploads/')) {
    console.log(`🖼️ Serving local cover URL for song: ${req.params.id}`);
    return res.json({ success: true, url: song.coverImageUrl });
  }

  // Extract S3 key from the coverImageUrl (assuming it contains the S3 key or full S3 URL)
  let s3Key = song.coverImageUrl;
  // If it's a full S3 URL, extract the key
  if (s3Key.includes('amazonaws.com/')) {
    const urlParts = s3Key.split('.amazonaws.com/');
    if (urlParts.length === 2) {
      s3Key = urlParts[1];
    }
  }

  // Generate presigned URL (default 1 hour)
  const signedUrl = await getSignedS3Url(s3Key, 3600);
  res.json({ success: true, url: signedUrl });
});
import Song from '../models/Song.js';
import History from '../models/History.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

/**
 * Get all songs with pagination and filters
 * @route GET /api/v1/songs
 * @access Public
 */
export const getSongs = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = config.pagination.defaultPageSize,
    genre,
    mood,
    language,
    artist,
    search,
    sort = '-createdAt', // Default to newest first
    minBpm,
    maxBpm,
  } = req.query;

  // Build query
  const query = {};

  // Only show published songs to non-artist users (in production)
  // In development, show all songs for testing
  if (process.env.NODE_ENV === 'production' && (!req.user || req.user.role !== 'artist')) {
    query.status = 'published';
  }

  // Filters
  if (genre) {
    query.genre = Array.isArray(genre) ? { $in: genre } : { $in: [genre] };
  }
  if (mood) {
    query.mood = Array.isArray(mood) ? { $in: mood } : { $in: [mood] };
  }
  if (language) {
    query.language = language;
  }
  if (artist) {
    query.artist = new RegExp(artist, 'i');
  }

  // BPM range filter
  if (minBpm || maxBpm) {
    query.bpm = {};
    if (minBpm) query.bpm.$gte = parseInt(minBpm);
    if (maxBpm) query.bpm.$lte = parseInt(maxBpm);
  }

  // Text search
  if (search) {
    query.$text = { $search: search };
  }

  // Execute query with pagination and projection
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const songs = await Song.find(query)
    .select('title artist genre mood bpm language popularity duration coverImageUrl createdAt')
    .sort(sort)
    .limit(parseInt(limit))
    .skip(skip)
    .lean(); // Use lean() for better performance

  const total = await Song.countDocuments(query);

  console.log(`📋 GET /songs: Returning ${songs.length} songs (total: ${total})`);
  if (songs.length > 0) {
    console.log(`   Latest song: "${songs[0].title}" by ${songs[0].artist} (${songs[0].createdAt})`);
  }

  // Set cache headers for CDN
  res.set('Cache-Control', 'public, max-age=300'); // 5 minutes

  res.json({
    success: true,
    data: songs,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * Get single song
 * @route GET /api/v1/songs/:id
 * @access Public
 */
export const getSong = asyncHandler(async (req, res) => {
  const query = { _id: req.params.id };

  // Only show published songs to non-artist users
  if (!req.user || req.user.role !== 'artist') {
    query.status = 'published';
  }

  const song = await Song.findOne(query)
    .select('-__v')
    .lean();

  if (!song) {
    throw new AppError('Song not found', 404);
  }

  // Set cache headers for CDN
  res.set('Cache-Control', 'public, max-age=600'); // 10 minutes

  res.json({
    success: true,
    data: song,
  });
});

/**
 * Create song
 * @route POST /api/v1/songs
 * @access Private (Artist/Admin)
 */
export const createSong = asyncHandler(async (req, res) => {
  const songData = {
    ...req.body,
    uploadedBy: req.user._id,
  };

  const song = await Song.create(songData);

  res.status(201).json({
    success: true,
    data: song,
  });
});

/**
 * Update song
 * @route PUT /api/v1/songs/:id
 * @access Private (Owner/Admin)
 */
export const updateSong = asyncHandler(async (req, res) => {
  let song = await Song.findById(req.params.id);

  if (!song) {
    throw new AppError('Song not found', 404);
  }

  // Check ownership
  if (song.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AppError('Not authorized to update this song', 403);
  }

  song = await Song.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  res.json({
    success: true,
    data: song,
  });
});

/**
 * Delete song
 * @route DELETE /api/v1/songs/:id
 * @access Private (Owner/Admin)
 */
export const deleteSong = asyncHandler(async (req, res) => {
  const song = await Song.findById(req.params.id);

  if (!song) {
    throw new AppError('Song not found', 404);
  }

  // Check ownership
  if (song.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new AppError('Not authorized to delete this song', 403);
  }

  await song.deleteOne();

  res.json({
    success: true,
    message: 'Song deleted successfully',
  });
});

/**
 * Get song stream URL
 * @route GET /api/v1/songs/:id/stream
 * @access Private (Authenticated users only)
 */
export const getSongStream = asyncHandler(async (req, res) => {
  const song = await Song.findById(req.params.id)
    .select('title artist hlsUrl duration')
    .lean();

  if (!song) {
    throw new AppError('Song not found', 404);
  }

  if (!song.hlsUrl) {
    throw new AppError('Stream not available for this song', 404);
  }

  // Log access for analytics (optional)
  console.log(`Stream accessed: ${song.title} by user ${req.user.email}`);

  // Return stream URL with metadata
  res.json({
    success: true,
    data: {
      streamUrl: song.hlsUrl,
      title: song.title,
      artist: song.artist,
      duration: song.duration,
      type: 'hls',
      protocol: 'application/vnd.apple.mpegurl',
    },
  });
});

/**
 * Get streaming URL - Simple CloudFront URL construction
 * @route GET /api/v1/songs/:id/stream
 * @access Public (no authentication required)
 */
export const getSecureStream = asyncHandler(async (req, res) => {
  try {
    const songId = req.params.id;
    console.log(`🎵 Stream request for song: ${songId}`);

    // Validate song ID
    if (!songId || songId === 'undefined' || songId === 'null') {
      console.error('❌ Invalid song ID');
      return res.status(400).json({
        success: false,
        error: 'Invalid song ID',
      });
    }

    // Fetch song from database
    const song = await Song.findById(songId)
      .select('_id title artist hlsUrl')
      .lean();

    if (!song) {
      console.error(`❌ Song not found: ${songId}`);
      return res.status(404).json({
        success: false,
        error: 'Song not found',
      });
    }

    // Validate HLS URL exists
    if (!song.hlsUrl) {
      console.error(`❌ HLS URL missing for song: ${song.title}`);
      return res.status(422).json({
        success: false,
        error: 'HLS stream not available for this song',
      });
    }

    // Use backend proxy URL to bypass CORS issues
    const streamUrl = `http://localhost:${config.port}/api/v1/songs/${songId}/hls/playlist.m3u8`;

    console.log(`✅ Stream URL generated: ${streamUrl}`);
    logger.info(`Stream: ${song._id}, song: ${song.title}`);

    // Return simple response
    return res.json({
      success: true,
      data: {
        streamUrl,
      },
    });
  } catch (error) {
    // Catch any unexpected errors
    console.error('❌ Stream endpoint error:', error);
    logger.error('Stream endpoint crashed:', error);

    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * Increment play count
 * @route POST /api/v1/songs/:id/play
 * @access Public
 */
export const incrementPlayCount = asyncHandler(async (req, res) => {
  const song = await Song.findByIdAndUpdate(
    req.params.id,
    { $inc: { 'statistics.playCount': 1 } },
    { new: true }
  );

  if (!song) {
    throw new AppError('Song not found', 404);
  }

  // Add to history if user is authenticated
  if (req.user) {
    await History.addEntry(req.user._id, song._id, {
      playDuration: req.body.playDuration || 0,
      completed: req.body.completed || false,
      source: req.body.source || 'direct',
    });
  }

  res.json({
    success: true,
    data: song,
  });
});

/**
 * Proxy HLS files from S3 (bypasses CORS)
 * @route GET /api/v1/songs/:id/hls/*
 * @access Public
 */
export const proxyHLS = asyncHandler(async (req, res) => {
  try {
    const songId = req.params.id;
    const hlsPath = req.params[0]; // Captures everything after /hls/

    console.log(`🎵 HLS Proxy request: song=${songId}, path=${hlsPath}`);

    // Validate song exists
    const song = await Song.findById(songId).select('hlsUrl').lean();
    if (!song || !song.hlsUrl) {
      return res.status(404).send('Song or HLS stream not found');
    }

    // S3 client with credentials
    const s3Client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    });

    // Build S3 key
    const s3Key = `songs/${songId}/hls/${hlsPath}`;
    console.log(`📡 Fetching from S3: ${config.aws.s3Bucket}/${s3Key}`);

    // Fetch from S3 using AWS SDK
    const command = new GetObjectCommand({
      Bucket: config.aws.s3Bucket,
      Key: s3Key,
    });

    const s3Response = await s3Client.send(command);

    // Set appropriate headers
    const contentType = hlsPath.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : hlsPath.endsWith('.ts')
        ? 'video/MP2T'
        : s3Response.ContentType || 'application/octet-stream';

    res.set('Content-Type', contentType);
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=3600');

    if (s3Response.ContentLength) {
      res.set('Content-Length', s3Response.ContentLength);
    }

    // Stream the S3 response body
    s3Response.Body.pipe(res);
  } catch (error) {
    console.error('❌ HLS proxy error:', error.message);

    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return res.status(404).send('HLS file not found');
    }

    res.status(500).send('Failed to proxy HLS stream');
  }
});

/**
 * Publish song (change status to published)
 * @route PUT /api/v1/songs/:id/publish
 * @access Private (Artist/Admin)
 */
export const publishSong = asyncHandler(async (req, res) => {
  const song = await Song.findById(req.params.id);

  if (!song) {
    throw new AppError('Song not found', 404);
  }

  // Only the creating artist or admin may publish
  if (req.user.role !== 'admin') {
    if (!req.user.artistProfile || String(song.createdByArtist) !== String(req.user.artistProfile)) {
      return res.status(403).json({ success: false, error: 'Not authorized to publish this song' });
    }
  }

  song.status = 'published';
  await song.save();

  res.json({
    success: true,
    data: song,
  });
});

/**
 * Get songs for the authenticated artist
 * @route GET /api/v1/artist/songs
 * @access Private (Artist)
 */
export const getArtistSongs = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // Filter by the authenticated user's ID
  const query = { uploadedBy: req.user._id };

  const songs = await Song.find(query)
    .sort('-createdAt')
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Song.countDocuments(query);

  res.json({
    success: true,
    data: songs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});
