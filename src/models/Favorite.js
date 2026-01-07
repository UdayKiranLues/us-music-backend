import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema(
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
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate favorites
favoriteSchema.index({ user: 1, song: 1 }, { unique: true });

// Index for user queries
favoriteSchema.index({ user: 1, addedAt: -1 });

const Favorite = mongoose.model('Favorite', favoriteSchema);

export default Favorite;
