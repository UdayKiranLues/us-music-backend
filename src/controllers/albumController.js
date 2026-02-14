import Album from '../models/Album.js';
import Song from '../models/Song.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * Get all albums with pagination and filters
 * @route GET /api/v1/albums
 * @access Public
 */
export const getAlbums = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 20,
        genre,
        artist,
        search,
        sort = '-createdAt',
    } = req.query;

    const query = {};

    if (process.env.NODE_ENV === 'production') {
        query.status = 'published';
    }

    if (genre) {
        query.genre = { $in: Array.isArray(genre) ? genre : [genre] };
    }
    if (artist) {
        query.artist = new RegExp(artist, 'i');
    }
    if (search) {
        query.title = new RegExp(search, 'i');
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const albums = await Album.find(query)
        .populate('artistProfile', 'artistName profileImage')
        .sort(sort)
        .limit(parseInt(limit))
        .skip(skip)
        .lean();

    const total = await Album.countDocuments(query);

    res.json({
        success: true,
        data: albums,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

/**
 * Get single album with songs
 * @route GET /api/v1/albums/:id
 * @access Public
 */
export const getAlbum = asyncHandler(async (req, res) => {
    const album = await Album.findById(req.params.id)
        .populate('artistProfile', 'artistName profileImage')
        .populate({
            path: 'songs',
            select: 'title artist duration coverImageUrl hlsUrl popularity',
        })
        .lean();

    if (!album) {
        throw new AppError('Album not found', 404);
    }

    res.json({
        success: true,
        data: album,
    });
});

/**
 * Create album
 * @route POST /api/v1/albums
 * @access Private (Artist/Admin)
 */
export const createAlbum = asyncHandler(async (req, res) => {
    const { title, genre, description, coverImageUrl, songs } = req.body;

    if (!req.user.artistProfile && req.user.role !== 'admin') {
        throw new AppError('Only artists can create albums', 403);
    }

    const albumData = {
        title,
        artist: req.user.name, // Fallback to user name if artist profile name not handy
        genre: Array.isArray(genre) ? genre : [genre],
        description,
        coverImageUrl,
        songs: songs || [],
        artistProfile: req.user.artistProfile,
        createdBy: req.user._id,
        status: 'published', // Default to published for simplicity
    };

    // If we have an artist profile, use that name
    if (req.user.artistProfile) {
        const mongoose = await import('mongoose');
        const ArtistProfile = mongoose.default.model('ArtistProfile');
        const profile = await ArtistProfile.findById(req.user.artistProfile);
        if (profile) {
            albumData.artist = profile.artistName;
        }
    }

    const album = await Album.create(albumData);

    // Update songs to reference this album (optional, but good for reverse lookups)
    if (songs && songs.length > 0) {
        await Song.updateMany(
            { _id: { $in: songs } },
            { $set: { album: album.title } }
        );
    }

    res.status(201).json({
        success: true,
        data: album,
    });
});

/**
 * Update album
 * @route PUT /api/v1/albums/:id
 * @access Private (Owner/Admin)
 */
export const updateAlbum = asyncHandler(async (req, res) => {
    let album = await Album.findById(req.params.id);

    if (!album) {
        throw new AppError('Album not found', 404);
    }

    if (album.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        throw new AppError('Not authorized to update this album', 403);
    }

    album = await Album.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    res.json({
        success: true,
        data: album,
    });
});

/**
 * Delete album
 * @route DELETE /api/v1/albums/:id
 * @access Private (Owner/Admin)
 */
export const deleteAlbum = asyncHandler(async (req, res) => {
    const album = await Album.findById(req.params.id);

    if (!album) {
        throw new AppError('Album not found', 404);
    }

    if (album.createdBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        throw new AppError('Not authorized to delete this album', 403);
    }

    await album.deleteOne();

    res.json({
        success: true,
        message: 'Album deleted successfully',
    });
});

/**
 * Get albums for the authenticated artist
 * @route GET /api/v1/artist/albums
 * @access Private (Artist)
 */
export const getArtistAlbums = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Filter by the authenticated user's ID
    const query = { createdBy: req.user._id };

    const albums = await Album.find(query)
        .populate('artistProfile', 'artistName profileImage')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean();

    const total = await Album.countDocuments(query);

    res.json({
        success: true,
        data: albums,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
        },
    });
});

export default {
    getAlbums,
    getAlbum,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    getArtistAlbums,
};
