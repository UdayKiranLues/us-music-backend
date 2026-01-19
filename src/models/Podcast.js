import mongoose from "mongoose";

const podcastSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true,
    maxlength: [200, "Title cannot exceed 200 characters"]
  },
  description: {
    type: String,
    required: [true, "Description is required"],
    maxlength: [2000, "Description cannot exceed 2000 characters"]
  },
  category: {
    type: String,
    required: [true, "Category is required"],
    enum: ["technology", "business", "entertainment", "education", "health", "sports", "news", "comedy", "music", "other"],
    default: "other"
  },
  keywords: [{
    type: String,
    trim: true,
    maxlength: [50, "Keyword cannot exceed 50 characters"]
  }],
  audioUrl: {
    type: String,
    required: [true, "Audio URL is required"]
  },
  duration: {
    type: Number,
    required: [true, "Duration is required"],
    min: [1, "Duration must be at least 1 second"]
  },
  artist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Artist is required"]
  },
  plays: {
    type: Number,
    default: 0,
    min: [0, "Plays cannot be negative"]
  },
  fileSize: {
    type: Number,
    required: [true, "File size is required"],
    min: [1, "File size must be at least 1 byte"]
  },
  mimeType: {
    type: String,
    required: [true, "MIME type is required"],
    enum: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/aac", "audio/flac"]
  }
}, {
  timestamps: true
});

// Indexes for performance
podcastSchema.index({ artist: 1, createdAt: -1 }); // Artist's podcasts by date
podcastSchema.index({ category: 1, createdAt: -1 }); // Podcasts by category and date
podcastSchema.index({ createdAt: -1 }); // Latest podcasts
podcastSchema.index({ plays: -1 }); // Most played podcasts

// Virtual for formatted duration
podcastSchema.virtual('durationFormatted').get(function() {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Ensure virtual fields are serialized
podcastSchema.set('toJSON', { virtuals: true });
podcastSchema.set('toObject', { virtuals: true });

export default mongoose.model("Podcast", podcastSchema);
