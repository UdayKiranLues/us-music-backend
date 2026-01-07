import Favorite from '../models/Favorite.js';
import Song from '../models/Song.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Get user's favorites
 * @route GET /api/v1/favorites
 * @access Private
 */
export const getFavorites = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const favorites = await Favorite.find({ user: req.user._id })
    .populate({
      path: 'song',
      select: 'title artist genre mood duration coverImageUrl hlsUrl popularity',
    })
    .sort({ addedAt: -1 })
    .limit(parseInt(limit))
    .skip(skip)
    .lean();

  const total = await Favorite.countDocuments({ user: req.user._id });

  res.json({
    success: true,
    data: favorites.map((fav) => fav.song),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * Add song to favorites
 * @route POST /api/v1/favorites/:songId
 * @access Private
 */
export const addFavorite = asyncHandler(async (req, res) => {
  const { songId } = req.params;

  // Check if song exists
  const song = await Song.findById(songId);
  if (!song) {
    throw new AppError('Song not found', 404);
  }

  // Check if already favorited
  const existingFavorite = await Favorite.findOne({
    user: req.user._id,
    song: songId,
  });

  if (existingFavorite) {
    throw new AppError('Song already in favorites', 400);
  }

  // Create favorite
  await Favorite.create({
    user: req.user._id,
    song: songId,
  });

  // Update song like count
  await Song.findByIdAndUpdate(songId, { $inc: { 'statistics.likeCount': 1 } });

  res.status(201).json({
    success: true,
    message: 'Added to favorites',
  });
});

/**
 * Remove song from favorites
 * @route DELETE /api/v1/favorites/:songId
 * @access Private
 */
export const removeFavorite = asyncHandler(async (req, res) => {
  const { songId } = req.params;

  const favorite = await Favorite.findOneAndDelete({
    user: req.user._id,
    song: songId,
  });

  if (!favorite) {
    throw new AppError('Favorite not found', 404);
  }

  // Update song like count
  await Song.findByIdAndUpdate(songId, { $inc: { 'statistics.likeCount': -1 } });

  res.json({
    success: true,
    message: 'Removed from favorites',
  });
});

/**
 * Check if song is favorited
 * @route GET /api/v1/favorites/:songId/check
 * @access Private
 */
export const checkFavorite = asyncHandler(async (req, res) => {
  const { songId } = req.params;

  const favorite = await Favorite.findOne({
    user: req.user._id,
    song: songId,
  }).lean();

  res.json({
    success: true,
    data: { isFavorite: !!favorite },
  });
});

/**
 * Check multiple songs for favorites status
 * @route POST /api/v1/favorites/check-multiple
 * @access Private
 */
export const checkMultipleFavorites = asyncHandler(async (req, res) => {
  const { songIds } = req.body;

  if (!Array.isArray(songIds) || songIds.length === 0) {
    throw new AppError('songIds must be a non-empty array', 400);
  }

  if (songIds.length > 100) {
    throw new AppError('Maximum 100 songs can be checked at once', 400);
  }

  const favorites = await Favorite.find({
    user: req.user._id,
    song: { $in: songIds },
  })
    .select('song')
    .lean();

  const favoriteSongIds = favorites.map((fav) => fav.song.toString());

  const result = songIds.reduce((acc, songId) => {
    acc[songId] = favoriteSongIds.includes(songId.toString());
    return acc;
  }, {});

  res.json({
    success: true,
    data: result,
  });
});
