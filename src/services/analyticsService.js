import Analytics from '../models/Analytics.js';
import Song from '../models/Song.js';
import logger from '../utils/logger.js';

/**
 * Analytics Service
 * Handles all analytics-related business logic
 */

/**
 * Record a play event
 */
export const recordPlayEvent = async (songId, userId, playData = {}) => {
  try {
    // Get song details for album
    const song = await Song.findById(songId);
    if (!song) {
      throw new Error('Song not found');
    }

    // Record in analytics
    await Analytics.recordPlay(songId, userId, {
      ...playData,
      album: song.album,
    });

    // Update song play counters
    await Song.findByIdAndUpdate(songId, {
      $inc: { totalPlays: 1 },
      $set: { lastPlayedAt: new Date() },
    });

    // Update unique listeners count (run async, don't wait)
    updateUniqueListenersCount(songId).catch((err) =>
      logger.error('Failed to update unique listeners', { error: err.message, songId })
    );

    logger.s3('Play event recorded', { songId, userId });
  } catch (error) {
    logger.error('Error recording play event', { error: error.message, songId, userId });
    throw error;
  }
};

/**
 * Update unique listeners count for a song
 */
const updateUniqueListenersCount = async (songId) => {
  const result = await Analytics.aggregate([
    { $match: { song: songId } },
    {
      $group: {
        _id: null,
        uniqueListeners: { $addToSet: '$uniqueListeners' },
      },
    },
    {
      $project: {
        count: {
          $size: {
            $reduce: {
              input: '$uniqueListeners',
              initialValue: [],
              in: { $setUnion: ['$$value', '$$this'] },
            },
          },
        },
      },
    },
  ]);

  if (result.length > 0) {
    await Song.findByIdAndUpdate(songId, {
      uniqueListeners: result[0].count,
    });
  }
};

/**
 * Get song analytics
 */
export const getSongAnalytics = async (songId, startDate, endDate) => {
  try {
    const analytics = await Analytics.getSongAnalytics(songId, startDate, endDate);
    const song = await Song.findById(songId);

    return {
      song: {
        id: song._id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        totalPlays: song.totalPlays,
        uniqueListeners: song.uniqueListeners,
      },
      dailyStats: analytics,
    };
  } catch (error) {
    logger.error('Error fetching song analytics', { error: error.message, songId });
    throw error;
  }
};

/**
 * Get top songs
 */
export const getTopSongs = async (limit = 10, startDate = null, endDate = null) => {
  try {
    return await Analytics.getTopSongs(limit, startDate, endDate);
  } catch (error) {
    logger.error('Error fetching top songs', { error: error.message });
    throw error;
  }
};

/**
 * Get top albums
 */
export const getTopAlbums = async (limit = 10, startDate = null, endDate = null) => {
  try {
    return await Analytics.getTopAlbums(limit, startDate, endDate);
  } catch (error) {
    logger.error('Error fetching top albums', { error: error.message });
    throw error;
  }
};

/**
 * Get daily trend
 */
export const getDailyTrend = async (startDate, endDate) => {
  try {
    return await Analytics.getDailyTrend(startDate, endDate);
  } catch (error) {
    logger.error('Error fetching daily trend', { error: error.message });
    throw error;
  }
};

/**
 * Get overall statistics
 */
export const getOverallStats = async (startDate = null, endDate = null) => {
  try {
    const stats = await Analytics.getOverallStats(startDate, endDate);
    
    // Get total songs and users count
    const [totalSongs, totalUsers] = await Promise.all([
      Song.countDocuments(),
      // You can add User model count here if needed
    ]);

    return {
      ...stats,
      totalSongs,
    };
  } catch (error) {
    logger.error('Error fetching overall stats', { error: error.message });
    throw error;
  }
};

/**
 * Get analytics dashboard summary
 */
export const getAnalyticsDashboard = async (days = 30) => {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [overallStats, topSongs, topAlbums, dailyTrend] = await Promise.all([
      getOverallStats(startDate, endDate),
      getTopSongs(10, startDate, endDate),
      getTopAlbums(10, startDate, endDate),
      getDailyTrend(startDate, endDate),
    ]);

    return {
      period: {
        startDate,
        endDate,
        days,
      },
      overallStats,
      topSongs,
      topAlbums,
      dailyTrend,
    };
  } catch (error) {
    logger.error('Error fetching analytics dashboard', { error: error.message });
    throw error;
  }
};

/**
 * Get genre analytics
 */
export const getGenreAnalytics = async (startDate = null, endDate = null) => {
  try {
    const match = {};
    
    if (startDate || endDate) {
      match.date = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        match.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        match.date.$lte = end;
      }
    }

    const result = await Analytics.aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'songs',
          localField: 'song',
          foreignField: '_id',
          as: 'songDetails',
        },
      },
      { $unwind: '$songDetails' },
      { $unwind: '$songDetails.genre' },
      {
        $group: {
          _id: '$songDetails.genre',
          totalPlays: { $sum: '$plays' },
          uniqueListeners: { $sum: { $size: '$uniqueListeners' } },
          songCount: { $addToSet: '$song' },
        },
      },
      {
        $project: {
          genre: '$_id',
          totalPlays: 1,
          uniqueListeners: 1,
          songCount: { $size: '$songCount' },
          _id: 0,
        },
      },
      { $sort: { totalPlays: -1 } },
    ]);

    return result;
  } catch (error) {
    logger.error('Error fetching genre analytics', { error: error.message });
    throw error;
  }
};

export default {
  recordPlayEvent,
  getSongAnalytics,
  getTopSongs,
  getTopAlbums,
  getDailyTrend,
  getOverallStats,
  getAnalyticsDashboard,
  getGenreAnalytics,
};
