import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema(
  {
    song: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
      index: true,
    },
    album: {
      type: String,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    plays: {
      type: Number,
      default: 0,
    },
    uniqueListeners: {
      type: [String], // Array of user IDs
      default: [],
    },
    completedPlays: {
      type: Number,
      default: 0,
    },
    totalDuration: {
      type: Number,
      default: 0, // Total seconds played
    },
    sources: {
      search: { type: Number, default: 0 },
      recommendation: { type: Number, default: 0 },
      playlist: { type: Number, default: 0 },
      album: { type: Number, default: 0 },
      artist: { type: Number, default: 0 },
      direct: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
analyticsSchema.index({ song: 1, date: 1 }, { unique: true }); // One document per song per day
analyticsSchema.index({ date: -1, plays: -1 }); // Top songs by date
analyticsSchema.index({ album: 1, date: -1 }); // Album analytics
analyticsSchema.index({ song: 1, date: -1 }); // Song history

// Convert Set to Array for JSON serialization
analyticsSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

/**
 * Record a play event
 * @param {ObjectId} songId - Song ID
 * @param {ObjectId} userId - User ID
 * @param {Object} data - Play data (duration, completed, source, album)
 */
analyticsSchema.statics.recordPlay = async function (songId, userId, data = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { playDuration = 0, completed = false, source = 'direct', album = null } = data;

  // Upsert analytics document for today
  const result = await this.findOneAndUpdate(
    { song: songId, date: today },
    {
      $inc: {
        plays: 1,
        completedPlays: completed ? 1 : 0,
        totalDuration: playDuration,
        [`sources.${source}`]: 1,
      },
      $addToSet: { uniqueListeners: userId.toString() },
      $setOnInsert: { album },
    },
    { upsert: true, new: true }
  );

  return result;
};

/**
 * Get song analytics for a date range
 * @param {ObjectId} songId - Song ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 */
analyticsSchema.statics.getSongAnalytics = async function (songId, startDate, endDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  return await this.find({
    song: songId,
    date: { $gte: start, $lte: end },
  }).sort({ date: 1 });
};

/**
 * Get top songs by plays
 * @param {Number} limit - Number of songs to return
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 */
analyticsSchema.statics.getTopSongs = async function (limit = 10, startDate = null, endDate = null) {
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

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$song',
        totalPlays: { $sum: '$plays' },
        totalUniqueListeners: { $sum: { $size: '$uniqueListeners' } },
        totalCompleted: { $sum: '$completedPlays' },
        avgDailyPlays: { $avg: '$plays' },
      },
    },
    { $sort: { totalPlays: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'songs',
        localField: '_id',
        foreignField: '_id',
        as: 'songDetails',
      },
    },
    { $unwind: '$songDetails' },
    {
      $project: {
        songId: '$_id',
        title: '$songDetails.title',
        artist: '$songDetails.artist',
        coverImageUrl: '$songDetails.coverImageUrl',
        totalPlays: 1,
        totalUniqueListeners: 1,
        totalCompleted: 1,
        avgDailyPlays: { $round: ['$avgDailyPlays', 2] },
        completionRate: {
          $round: [
            { $multiply: [{ $divide: ['$totalCompleted', '$totalPlays'] }, 100] },
            2,
          ],
        },
      },
    },
  ]);
};

/**
 * Get top albums by plays
 * @param {Number} limit - Number of albums to return
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 */
analyticsSchema.statics.getTopAlbums = async function (limit = 10, startDate = null, endDate = null) {
  const match = { album: { $ne: null, $exists: true } };
  
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

  return await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$album',
        totalPlays: { $sum: '$plays' },
        totalUniqueListeners: { $sum: { $size: '$uniqueListeners' } },
        songCount: { $addToSet: '$song' },
      },
    },
    {
      $project: {
        album: '$_id',
        totalPlays: 1,
        totalUniqueListeners: 1,
        songCount: { $size: '$songCount' },
      },
    },
    { $sort: { totalPlays: -1 } },
    { $limit: limit },
  ]);
};

/**
 * Get daily plays trend
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 */
analyticsSchema.statics.getDailyTrend = async function (startDate, endDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  return await this.aggregate([
    { $match: { date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
        totalPlays: { $sum: '$plays' },
        uniqueListeners: { $sum: { $size: '$uniqueListeners' } },
        completedPlays: { $sum: '$completedPlays' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        date: '$_id',
        totalPlays: 1,
        uniqueListeners: 1,
        completedPlays: 1,
        _id: 0,
      },
    },
  ]);
};

/**
 * Get overall statistics
 */
analyticsSchema.statics.getOverallStats = async function (startDate = null, endDate = null) {
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

  const result = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalPlays: { $sum: '$plays' },
        totalCompleted: { $sum: '$completedPlays' },
        totalDuration: { $sum: '$totalDuration' },
        uniqueSongs: { $addToSet: '$song' },
        allListeners: { $push: '$uniqueListeners' },
      },
    },
    {
      $project: {
        _id: 0,
        totalPlays: 1,
        totalCompleted: 1,
        totalDuration: 1,
        uniqueSongs: { $size: '$uniqueSongs' },
        completionRate: {
          $round: [
            { $multiply: [{ $divide: ['$totalCompleted', '$totalPlays'] }, 100] },
            2,
          ],
        },
        avgDuration: {
          $round: [{ $divide: ['$totalDuration', '$totalPlays'] }, 2],
        },
      },
    },
  ]);

  return result[0] || {
    totalPlays: 0,
    totalCompleted: 0,
    totalDuration: 0,
    uniqueSongs: 0,
    completionRate: 0,
    avgDuration: 0,
  };
};

const Analytics = mongoose.model('Analytics', analyticsSchema);

export default Analytics;
