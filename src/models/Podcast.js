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
    required: false,
    maxlength: [2000, "Description cannot exceed 2000 characters"],
    default: ""
  },
  categories: {
    type: [String],
    default: ["general"]
  },
  keywords: [{
    type: String,
    trim: true,
    maxlength: [50, "Keyword cannot exceed 50 characters"]
  }],
  coverImage: {
    type: String,
    default: ""
  },
  host: {
    type: String,
    trim: true
  },
  episodeCount: {
    type: Number,
    default: 0
  },
  // Legacy fields for when podcasts were single files
  audioUrl: {
    type: String,
    required: false
  },
  duration: {
    type: Number,
    required: false,
    min: [0, "Duration cannot be negative"]
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
    required: false,
    min: [0, "File size cannot be negative"]
  },
  mimeType: {
    type: String,
    required: false,
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
podcastSchema.virtual('durationFormatted').get(function () {
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

// Ensure virtual fields are serialized
podcastSchema.set('toJSON', { virtuals: true });
podcastSchema.set('toObject', { virtuals: true });

export default mongoose.model("Podcast", podcastSchema);
