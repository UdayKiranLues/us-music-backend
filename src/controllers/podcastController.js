import Podcast from '../models/Podcast.js';
import { uploadToS3 } from '../utils/s3.js';
import { getAudioMetadata } from '../services/ffmpegService.js';
import fs from 'fs';
import path from 'path';
import config from '../config/index.js';

/**
 * Upload a podcast episode (Artists only)
 */
export const uploadPodcast = async (req, res, next) => {
  try {
    // Check if user is an artist
    if (!req.user || req.user.role !== 'artist') {
      return res.status(403).json({
        success: false,
        error: 'Only artists can upload podcasts'
      });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required'
      });
    }

    const { title, description, category, keywords } = req.body;

    // Validate required fields
    if (!title || !description || !category) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and category are required'
      });
    }

    const filePath = req.file.path;
    const fileSize = req.file.size;
    const mimeType = req.file.mimetype;

    // Get audio metadata
    const metadata = await getAudioMetadata(filePath);
    const duration = metadata.duration;

    // Generate unique S3 key
    const fileExtension = path.extname(req.file.originalname);
    const s3Key = `podcasts/${req.user._id}/${Date.now()}-${Math.random().toString(36).substring(2)}${fileExtension}`;

    // Read file buffer
    const fileBuffer = fs.readFileSync(filePath);

    // Upload to S3
    const audioUrl = await uploadToS3(fileBuffer, s3Key, mimeType, false);

    // Parse keywords
    let keywordsArray = [];
    if (keywords) {
      keywordsArray = typeof keywords === 'string'
        ? keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
        : Array.isArray(keywords) ? keywords : [];
    }

    // Create podcast document
    const podcast = await Podcast.create({
      title: title.trim(),
      description: description.trim(),
      category,
      keywords: keywordsArray,
      audioUrl,
      duration,
      artist: req.user._id,
      fileSize,
      mimeType
    });

    // Clean up temp file
    fs.unlinkSync(filePath);

    res.status(201).json({
      success: true,
      data: podcast
    });

  } catch (error) {
    // Clean up temp file on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
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
      query.category = category;
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
      .populate('artist', 'username')
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
