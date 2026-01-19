import Podcast from '../models/Podcast.js';
import PodcastEpisode from '../models/PodcastEpisode.js';
import { convertToHLS, cleanupFiles, getAudioMetadata } from '../services/ffmpegService.js';
import { uploadPodcastHLSToS3, uploadPodcastAudioToS3 } from '../utils/s3.js';
import { AppError } from '../utils/errors.js';
import path from 'path';
import fs from 'fs';
import config from '../config/index.js';

// Public - stream episode via CloudFront (or presigned fallback)
export const streamEpisode = async (req, res, next) => {
  try {
    const query = { _id: req.params.id };

    // Only allow streaming published episodes to non-artist users
    if (!req.user || req.user.role !== 'artist') {
      query.status = 'published';
    }

    const episode = await PodcastEpisode.findOne(query).lean();
    if (!episode) return res.status(404).json({ success: false, error: 'Episode not found' });

    if (!episode.hlsPath) return res.status(400).json({ success: false, error: 'Episode not ready for streaming' });

    // Build CloudFront URL (public domain or signed via cloudFrontService in s3 util)
    const streamUrl = config.aws.cloudFrontDomain
      ? `https://${config.aws.cloudFrontDomain}/${episode.hlsPath}`
      : await (await import('../utils/s3.js')).getSecureStreamingUrl(episode.hlsPath);

    res.json({ success: true, streamUrl });
  } catch (err) {
    next(err);
  }
};

// Public - report play (frontend should call after 30s of playback)
export const reportPlay = async (req, res, next) => {
  try {
    const episode = await PodcastEpisode.findByIdAndUpdate(req.params.id, { $inc: { totalPlays: 1 } }, { new: true }).lean();
    if (!episode) return res.status(404).json({ success: false, error: 'Episode not found' });
    res.json({ success: true, totalPlays: episode.totalPlays });
  } catch (err) {
    next(err);
  }
};

// Admin - upload episode audio, convert to HLS, upload to S3, save DB keys
export const uploadEpisode = async (req, res, next) => {
  const tempFiles = [];

  try {
    const podcastId = req.params.id;
    const podcast = await Podcast.findById(podcastId);
    if (!podcast) throw new AppError('Podcast not found', 404);

    if (!req.file) throw new AppError('No audio file uploaded', 400);

    // Create episode record first to obtain an ID
    const payload = {
      podcastId,
      title: req.body.title || req.file.originalname,
      description: req.body.description || '',
      duration: req.body.duration || 0,
      episodeNumber: req.body.episodeNumber || 0,
      season: req.body.season,
      releaseDate: req.body.releaseDate || Date.now(),
      createdByArtist: req.user?.artistProfile || undefined,
      category: req.body.category ? (Array.isArray(req.body.category) ? req.body.category : [req.body.category]) : [],
      keywords: req.body.keywords ? (Array.isArray(req.body.keywords) ? req.body.keywords : [req.body.keywords]) : [],
      language: req.body.language || 'en',
      explicit: req.body.explicit === 'true' || req.body.explicit === true,
    };

    const episode = await PodcastEpisode.create(payload);

    // Paths
    const inputPath = req.file.path;
    tempFiles.push(inputPath);

    const tmpOutputDir = path.join('/tmp', 'podcasts', String(podcastId), String(episode._id), 'hls');

    // Convert to HLS
    const hlsResult = await convertToHLS(inputPath, tmpOutputDir);
    tempFiles.push(hlsResult.outputDir);

    // Upload HLS files to S3
    const playlistKey = await uploadPodcastHLSToS3(hlsResult.files, podcastId, episode._id);

    // Upload original audio as well
    const audioKey = await uploadPodcastAudioToS3(inputPath, podcastId, episode._id, req.file.originalname);

    // Get metadata (duration) if possible
    let metadata = {};
    try {
      metadata = await getAudioMetadata(inputPath);
    } catch (e) {
      // non-fatal
    }

    // Update episode record
    episode.hlsPath = playlistKey;
    episode.audioPath = audioKey;
    if (metadata.duration) episode.duration = metadata.duration;
    await episode.save();

    // Increment podcast totalEpisodes
    podcast.totalEpisodes = (podcast.totalEpisodes || 0) + 1;
    await podcast.save();

    // Cleanup
    await cleanupFiles(tempFiles);

    res.status(201).json({ success: true, data: episode });
  } catch (err) {
    // attempt cleanup
    try { if (tempFiles.length) await cleanupFiles(tempFiles); } catch (e) {}
    next(err);
  }
};

// Admin - delete episode and S3 files reference removal is left to operator (not implemented)
export const deleteEpisode = async (req, res, next) => {
  try {
    const ep = await PodcastEpisode.findByIdAndDelete(req.params.id);
    if (!ep) return res.status(404).json({ success: false, error: 'Episode not found' });

    // Decrement podcast totalEpisodes
    await Podcast.findByIdAndUpdate(ep.podcastId, { $inc: { totalEpisodes: -1 } });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// Admin/Artist - publish episode (change status to published)
export const publishEpisode = async (req, res, next) => {
  try {
    const ep = await PodcastEpisode.findById(req.params.id);
    if (!ep) return res.status(404).json({ success: false, error: 'Episode not found' });

    // Only the creating artist or admin may publish
    if (req.user.role !== 'admin') {
      if (!req.user.artistProfile || String(ep.createdByArtist) !== String(req.user.artistProfile)) {
        return res.status(403).json({ success: false, error: 'Not authorized to publish this episode' });
      }
    }

    ep.status = 'published';
    ep.publishedAt = new Date();
    await ep.save();

    res.json({ success: true, data: ep });
  } catch (err) {
    next(err);
  }
};

export default { streamEpisode, reportPlay, uploadEpisode, deleteEpisode };
