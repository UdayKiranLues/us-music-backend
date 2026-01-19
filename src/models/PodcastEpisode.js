import mongoose from 'mongoose';

const PodcastEpisodeSchema = new mongoose.Schema(
  {
    podcastId: { type: mongoose.Schema.Types.ObjectId, ref: 'Podcast', required: true },
    title: { type: String, required: true },
    description: { type: String },
    duration: { type: Number },
    episodeNumber: { type: Number },
    season: { type: Number },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date },
    createdByArtist: { type: mongoose.Schema.Types.ObjectId, ref: 'ArtistProfile' },
    audioPath: { type: String },
    hlsPath: { type: String },
    releaseDate: { type: Date, default: Date.now },
    totalPlays: { type: Number, default: 0 },
    category: [{ type: String }],
    keywords: [{ type: String }],
    language: { type: String, default: 'en' },
    explicit: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('PodcastEpisode', PodcastEpisodeSchema);
