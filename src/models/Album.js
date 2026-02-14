import mongoose from 'mongoose';

const albumSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Album title is required'],
            trim: true,
            maxlength: [200, 'Title cannot exceed 200 characters'],
            index: true,
        },
        artist: {
            type: String,
            required: [true, 'Artist name is required'],
            trim: true,
            index: true,
        },
        artistProfile: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ArtistProfile',
            required: true,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        coverImageUrl: {
            type: String,
            required: [true, 'Cover image URL is required'],
            trim: true,
        },
        genre: {
            type: [String],
            required: [true, 'At least one genre is required'],
            index: true,
        },
        releaseDate: {
            type: Date,
            default: Date.now,
        },
        description: {
            type: String,
            trim: true,
            maxlength: [1000, 'Description cannot exceed 1000 characters'],
        },
        songs: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Song',
            },
        ],
        status: {
            type: String,
            enum: ['draft', 'published'],
            default: 'draft',
        },
    },
    {
        timestamps: true,
    }
);

// Virtual for song count
albumSchema.virtual('songCount').get(function () {
    return this.songs ? this.songs.length : 0;
});

// Remove __v from JSON
albumSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        delete ret.__v;
        return ret;
    },
});

const Album = mongoose.model('Album', albumSchema);

export default Album;
