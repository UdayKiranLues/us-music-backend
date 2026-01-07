import * as analyticsService from '../services/analyticsService.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Get analytics dashboard
 * GET /api/v1/analytics/dashboard
 */
export const getAnalyticsDashboard = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    const dashboard = await analyticsService.getAnalyticsDashboard(parseInt(days));

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    logger.error('Error fetching analytics dashboard', { error: error.message });
    next(error);
  }
};

/**
 * Get song analytics
 * GET /api/v1/analytics/songs/:songId
 */
export const getSongAnalytics = async (req, res, next) => {
  try {
    const { songId } = req.params;
    const { startDate, endDate } = req.query;

    // Default to last 30 days if not provided
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const analytics = await analyticsService.getSongAnalytics(songId, start, end);

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    logger.error('Error fetching song analytics', { error: error.message, songId: req.params.songId });
    next(error);
  }
};

/**
 * Get top songs
 * GET /api/v1/analytics/songs/top
 */
export const getTopSongs = async (req, res, next) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const topSongs = await analyticsService.getTopSongs(parseInt(limit), start, end);

    res.status(200).json({
      success: true,
      data: topSongs,
    });
  } catch (error) {
    logger.error('Error fetching top songs', { error: error.message });
    next(error);
  }
};

/**
 * Get top albums
 * GET /api/v1/analytics/albums/top
 */
export const getTopAlbums = async (req, res, next) => {
  try {
    const { limit = 10, startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const topAlbums = await analyticsService.getTopAlbums(parseInt(limit), start, end);

    res.status(200).json({
      success: true,
      data: topAlbums,
    });
  } catch (error) {
    logger.error('Error fetching top albums', { error: error.message });
    next(error);
  }
};

/**
 * Get daily trend
 * GET /api/v1/analytics/trend/daily
 */
export const getDailyTrend = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const trend = await analyticsService.getDailyTrend(start, end);

    res.status(200).json({
      success: true,
      data: trend,
    });
  } catch (error) {
    logger.error('Error fetching daily trend', { error: error.message });
    next(error);
  }
};

/**
 * Get overall statistics
 * GET /api/v1/analytics/stats
 */
export const getOverallStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const stats = await analyticsService.getOverallStats(start, end);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error fetching overall stats', { error: error.message });
    next(error);
  }
};

/**
 * Get genre analytics
 * GET /api/v1/analytics/genres
 */
export const getGenreAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const genreStats = await analyticsService.getGenreAnalytics(start, end);

    res.status(200).json({
      success: true,
      data: genreStats,
    });
  } catch (error) {
    logger.error('Error fetching genre analytics', { error: error.message });
    next(error);
  }
};

/**
 * Record a play event (called when user plays a song)
 * POST /api/v1/analytics/play
 */
export const recordPlay = async (req, res, next) => {
  try {
    const { songId, playDuration, completed, source } = req.body;
    const userId = req.user._id;

    if (!songId) {
      throw new AppError('Song ID is required', 400);
    }

    await analyticsService.recordPlayEvent(songId, userId, {
      playDuration,
      completed,
      source,
    });

    res.status(200).json({
      success: true,
      message: 'Play event recorded',
    });
  } catch (error) {
    logger.error('Error recording play', { error: error.message, user: req.user?._id });
    next(error);
  }
};
