import express from 'express';
import {
  getAnalyticsDashboard,
  getSongAnalytics,
  getTopSongs,
  getTopAlbums,
  getDailyTrend,
  getOverallStats,
  getGenreAnalytics,
  recordPlay,
} from '../controllers/analyticsController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/**
 * @route   POST /api/v1/analytics/play
 * @desc    Record a play event (called by frontend when song is played)
 * @access  Private
 */
router.post('/play', authenticate, recordPlay);

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get comprehensive analytics dashboard
 * @access  Private (Admin only)
 */
router.get('/dashboard', authenticate, authorize('admin'), getAnalyticsDashboard);

/**
 * @route   GET /api/v1/analytics/songs/:songId
 * @desc    Get analytics for a specific song
 * @access  Private (Admin only)
 */
router.get('/songs/:songId', authenticate, authorize('admin'), getSongAnalytics);

/**
 * @route   GET /api/v1/analytics/songs/top
 * @desc    Get top songs by plays
 * @access  Private (Admin only)
 */
router.get('/songs/top', authenticate, authorize('admin'), getTopSongs);

/**
 * @route   GET /api/v1/analytics/albums/top
 * @desc    Get top albums by plays
 * @access  Private (Admin only)
 */
router.get('/albums/top', authenticate, authorize('admin'), getTopAlbums);

/**
 * @route   GET /api/v1/analytics/trend/daily
 * @desc    Get daily plays trend
 * @access  Private (Admin only)
 */
router.get('/trend/daily', authenticate, authorize('admin'), getDailyTrend);

/**
 * @route   GET /api/v1/analytics/stats
 * @desc    Get overall statistics
 * @access  Private (Admin only)
 */
router.get('/stats', authenticate, authorize('admin'), getOverallStats);

/**
 * @route   GET /api/v1/analytics/genres
 * @desc    Get genre-wise analytics
 * @access  Private (Admin only)
 */
router.get('/genres', authenticate, authorize('admin'), getGenreAnalytics);

export default router;
