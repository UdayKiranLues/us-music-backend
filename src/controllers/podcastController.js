import Podcast from '../models/Podcast.js';
import { getAudioMetadata } from '../services/ffmpegService.js';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';
import { uploadFile } from '../utils/storage.js';

/**
 * Upload a podcast episode (Artists only)
 */
// @desc    Upload a new podcast (Series/Show)
// @route   POST /api/v1/podcasts/upload
// @access  Private (Artist)
export const uploadPodcast = async (req, res, next) => {
  try {
    console.log('🎙️ uploadPodcast controller reached - latest version');
    // Check if user is an artist
    if (!req.user || req.user.role !== 'artist') {
      return res.status(403).json({
        success: false,
        error: 'Only artists can upload podcasts'
      });
    }

    const { title, description, categories, category, keywords, host } = req.body;

    // For legacy support, allow creating a show if at least title is present.
    // If it looks like an episode upload hitting the wrong endpoint, we'll try to be helpful.
    if (!title) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        error: 'Title is required. If you are trying to upload an episode, please select a Podcast Series first.'
      });
    }

    // Handle single category vs categories array
    let finalCategories = categories || category || ['general'];

    let categoriesArray = [];
    try {
      categoriesArray = typeof finalCategories === 'string'
        ? (finalCategories.startsWith('[') ? JSON.parse(finalCategories) : [finalCategories])
        : Array.isArray(finalCategories) ? finalCategories : [finalCategories];
    } catch (e) {
      categoriesArray = [finalCategories];
    }

    // Handle cover image if uploaded
    let coverImage = '';
    if (req.file) {
      console.log(`🖼️ Uploading cover image for podcast: ${req.file.originalname}`);
      // Use general uploadFile utility which handles both S3 and Local based on config
      coverImage = await uploadFile(req.file.path, s3Key, req.file.mimetype, true);
      console.log('✅ Cover image uploaded successfully:', coverImage);
      // Clean up temp file
      if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }

    // Parse keywords
    let keywordsArray = [];
    if (keywords) {
      keywordsArray = typeof keywords === 'string'
        ? (keywords.startsWith('[') ? JSON.parse(keywords) : keywords.split(',').map(k => k.trim()).filter(k => k.length > 0))
        : Array.isArray(keywords) ? keywords : [];
    }

    const podcast = await Podcast.create({
      title: title.trim(),
      description: (description || 'No description provided').trim(),
      categories: categoriesArray,
      keywords: keywordsArray,
      host: host || req.user.name,
      artist: req.user._id,
      coverImage: coverImage || ''
    });

    res.status(201).json({
      success: true,
      data: podcast
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get public feed of latest podcasts
 */
export const getPublicFeed = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const category = req.query.category;
    const skip = (page - 1) * limit;

    let query = {};

    // Filter by category if provided
    if (category && category !== 'all') {
      query.categories = category;
    }

    const podcasts = await Podcast.find(query)
      .populate('artist', 'username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Podcast.countDocuments(query);

    res.json({
      success: true,
      data: podcasts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get artist's own podcasts (Artist dashboard)
 */
export const getArtistPodcasts = async (req, res, next) => {
  try {
    // Check if user is an artist
    if (!req.user || req.user.role !== 'artist') {
      return res.status(403).json({
        success: false,
        error: 'Only artists can access their dashboard'
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const podcasts = await Podcast.find({ artist: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Podcast.countDocuments({ artist: req.user._id });

    // Get total plays for this artist
    const totalPlays = await Podcast.aggregate([
      { $match: { artist: req.user._id } },
      { $group: { _id: null, total: { $sum: '$plays' } } }
    ]);

    res.json({
      success: true,
      data: podcasts,
      stats: {
        totalPodcasts: total,
        totalPlays: totalPlays[0]?.total || 0
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get a single podcast
 */
export const getPodcast = async (req, res, next) => {
  try {
    const podcast = await Podcast.findById(req.params.id)
      .populate('artist', 'name username')
      .lean();

    if (!podcast) {
      return res.status(404).json({
        success: false,
        error: 'Podcast not found'
      });
    }

    // Increment play count
    await Podcast.findByIdAndUpdate(req.params.id, { $inc: { plays: 1 } });

    res.json({
      success: true,
      data: podcast
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Delete a podcast (Artist can only delete their own)
 */
export const deletePodcast = async (req, res, next) => {
  try {
    const podcast = await Podcast.findById(req.params.id);

    if (!podcast) {
      return res.status(404).json({
        success: false,
        error: 'Podcast not found'
      });
    }

    // Check if user is the artist who uploaded this podcast
    if (!req.user || req.user.role !== 'artist' || podcast.artist.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own podcasts'
      });
    }

    // Delete from database
    await Podcast.findByIdAndDelete(req.params.id);

    // TODO: Delete from S3 as well (optional - can be done in background)

    res.json({
      success: true,
      message: 'Podcast deleted successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get podcast categories
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = [
      "technology", "business", "entertainment", "education",
      "health", "sports", "news", "comedy", "music", "other"
    ];

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    next(error);
  }
};

export default {
  uploadPodcast,
  getPublicFeed,
  getArtistPodcasts,
  getPodcast,
  deletePodcast,
  getCategories,
};
