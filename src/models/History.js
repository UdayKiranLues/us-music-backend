import mongoose from 'mongoose';

const historySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    song: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
    },
    playedAt: {
      type: Date,
      default: Date.now,
    },
    playDuration: {
      type: Number, // in seconds
      default: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    source: {
      type: String,
      enum: ['search', 'recommendation', 'playlist', 'album', 'artist', 'direct'],
      default: 'direct',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for user queries
historySchema.index({ user: 1, playedAt: -1 });
historySchema.index({ song: 1, playedAt: -1 });
historySchema.index({ user: 1, song: 1 });

// Limit history entries per user (keep last 500)
historySchema.statics.addEntry = async function (userId, songId, data = {}) {
  const entry = await this.create({
    user: userId,
    song: songId,
    ...data,
  });

  // Remove old entries (keep last 500)
  const count = await this.countDocuments({ user: userId });
  if (count > 500) {
    const toRemove = await this.find({ user: userId })
      .sort({ playedAt: 1 })
      .limit(count - 500)
      .select('_id');

    await this.deleteMany({ _id: { $in: toRemove.map((doc) => doc._id) } });
  }

  return entry;
};

const History = mongoose.model('History', historySchema);

export default History;
