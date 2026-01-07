import History from '../models/History.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { recordPlayEvent } from '../services/analyticsService.js';
import logger from '../utils/logger.js';

/**
 * Get user's listening history
 * @route GET /api/v1/history
 * @access Private
 */
export const getHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const history = await History.find({ user: req.user._id })
    .populate({
      path: 'song',
      select: 'title artist genre mood duration coverImageUrl hlsUrl',
    })
    .sort({ playedAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  const total = await History.countDocuments({ user: req.user._id });

  res.json({
    success: true,
    data: history,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * Add entry to history
 * @route POST /api/v1/history
 * @access Private
 */
export const addToHistory = asyncHandler(async (req, res) => {
  const { songId, playDuration, completed, source } = req.body;

  // Add to history
  const entry = await History.addEntry(req.user._id, songId, {
    playDuration,
    completed,
    source,
  });

  // Record analytics (async, don't wait)
  recordPlayEvent(songId, req.user._id, {
    playDuration,
    completed,
    source,
  }).catch((err) => {
    logger.error('Failed to record analytics', { error: err.message, songId });
  });

  res.status(201).json({
    success: true,
    data: entry,
  });
});

/**
 * Clear user's history
 * @route DELETE /api/v1/history
 * @access Private
 */
export const clearHistory = asyncHandler(async (req, res) => {
  await History.deleteMany({ user: req.user._id });

  res.json({
    success: true,
    message: 'History cleared successfully',
  });
});

/**
 * Get listening statistics
 * @route GET /api/v1/history/stats
 * @access Private
 */
export const getStats = asyncHandler(async (req, res) => {
  const history = await History.find({ user: req.user._id })
    .populate({
      path: 'song',
      select: 'genre artist',
    })
    .lean();

  // Calculate stats
  const totalPlays = history.length;
  const totalDuration = history.reduce((sum, entry) => sum + (entry.playDuration || 0), 0);
  const uniqueSongs = new Set(history.map((entry) => entry.song?._id.toString())).size;

  // Genre distribution - handle arrays
  const genreCount = {};
  history.forEach((entry) => {
    if (entry.song?.genre) {
      const genres = Array.isArray(entry.song.genre) ? entry.song.genre : [entry.song.genre];
      genres.forEach((genre) => {
        genreCount[genre] = (genreCount[genre] || 0) + 1;
      });
    }
  });

  // Top artists
  const artistCount = {};
  history.forEach((entry) => {
    if (entry.song?.artist) {
      artistCount[entry.song.artist] = (artistCount[entry.song.artist] || 0) + 1;
    }
  });

  const topArtists = Object.entries(artistCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([artist, count]) => ({ artist, count }));

  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, count]) => ({ genre, count }));

  res.json({
    success: true,
    data: {
      totalPlays,
      totalDuration: Math.floor(totalDuration / 60), // in minutes
      uniqueSongs,
      topArtists,
      topGenres,
    },
  });
});
