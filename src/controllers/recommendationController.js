import recommendationService from '../services/recommendationService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Get personalized recommendations
 * @route GET /api/v1/recommendations
 * @access Private
 */
export const getRecommendations = asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  const recommendations = await recommendationService.getRecommendations(
    req.user._id,
    parseInt(limit)
  );

  res.json({
    success: true,
    data: recommendations,
  });
});

/**
 * Get trending songs
 * @route GET /api/v1/recommendations/trending
 * @access Public
 */
export const getTrending = asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  const trending = await recommendationService.getTrendingSongs(parseInt(limit));

  res.json({
    success: true,
    data: trending,
  });
});

/**
 * Get similar songs
 * @route GET /api/v1/recommendations/similar/:songId
 * @access Public
 */
export const getSimilarSongs = asyncHandler(async (req, res) => {
  const { songId } = req.params;
  const { limit = 10 } = req.query;

  const similar = await recommendationService.getSimilarSongs(songId, parseInt(limit));

  res.json({
    success: true,
    data: similar,
  });
});

/**
 * Get next song recommendation
 * @route GET /api/v1/recommendations/next/:songId
 * @access Public (better with auth for history)
 */
export const getNextSong = asyncHandler(async (req, res) => {
  const { songId } = req.params;
  const userId = req.user?._id; // Optional user ID from auth

  const nextSong = await recommendationService.getNextSong(songId, userId);

  if (!nextSong) {
    return res.status(404).json({
      success: false,
      error: 'No suitable next song found',
    });
  }

  res.json({
    success: true,
    data: nextSong,
  });
});
