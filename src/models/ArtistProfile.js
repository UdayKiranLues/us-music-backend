import mongoose from 'mongoose';

const ArtistProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    artistName: { type: String, required: true },
    bio: { type: String },
    profileImage: { type: String },
    verified: { type: Boolean, default: false },
    totalFollowers: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('ArtistProfile', ArtistProfileSchema);
