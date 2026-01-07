import mongoose from 'mongoose';

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Song title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
      index: true, // Index for search queries
    },
    artist: {
      type: String,
      required: [true, 'Artist name is required'],
      trim: true,
      index: true, // Index for filtering by artist
    },
    genre: {
      type: [String],
      required: [true, 'At least one genre is required'],
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: 'Song must have at least one genre',
      },
      index: true, // Index for genre filtering
    },
    mood: {
      type: [String],
      default: [],
      index: true, // Index for mood-based recommendations
    },
    bpm: {
      type: Number,
      min: [0, 'BPM must be a positive number'],
      max: [300, 'BPM cannot exceed 300'],
    },
    language: {
      type: String,
      required: [true, 'Language is required'],
      trim: true,
      index: true, // Index for language filtering
    },
    popularity: {
      type: Number,
      default: 0,
      min: [0, 'Popularity cannot be negative'],
      max: [100, 'Popularity cannot exceed 100'],
      index: -1, // Descending index for sorting by popularity
    },
    duration: {
      type: Number,
      required: [true, 'Duration is required'],
      min: [1, 'Duration must be at least 1 second'],
    },
    coverImageUrl: {
      type: String,
      required: [true, 'Cover image URL is required'],
      trim: true,
    },
    hlsUrl: {
      type: String,
      required: [true, 'HLS URL is required'],
      trim: true,
      validate: {
        validator: function (v) {
          return v.endsWith('.m3u8');
        },
        message: 'HLS URL must be a .m3u8 file',
      },
    },
    album: {
      type: String,
      trim: true,
      index: true,
    },
    // Analytics fields for quick access
    totalPlays: {
      type: Number,
      default: 0,
      index: -1, // Descending index for sorting by plays
    },
    uniqueListeners: {
      type: Number,
      default: 0,
    },
    lastPlayedAt: {
      type: Date,
      index: -1,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Text index for full-text search on title and artist
songSchema.index({ title: 'text', artist: 'text' });

// Compound indexes for common query patterns
songSchema.index({ genre: 1, popularity: -1 }); // Filter by genre, sort by popularity
songSchema.index({ mood: 1, popularity: -1 }); // Filter by mood, sort by popularity
songSchema.index({ language: 1, popularity: -1 }); // Filter by language, sort by popularity
songSchema.index({ createdAt: -1 }); // Sort by newest
songSchema.index({ popularity: -1, createdAt: -1 }); // Popular and recent songs
songSchema.index({ totalPlays: -1 }); // Sort by most played
songSchema.index({ album: 1, totalPlays: -1 }); // Album songs sorted by plays

// BPM range queries for tempo-based filtering
songSchema.index({ bpm: 1 });

// Virtual for formatted duration
songSchema.virtual('formattedDuration').get(function () {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Remove __v from JSON
songSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const Song = mongoose.model('Song', songSchema);

export default Song;
