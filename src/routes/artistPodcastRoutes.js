import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateAWSConfig, uploadAudioMiddleware, uploadErrorHandler } from '../middleware/upload.js';
import { uploadPodcast } from '../controllers/podcastController.js';
import { uploadEpisode, publishEpisode } from '../controllers/podcastEpisodeController.js';

const router = express.Router();

// Upload podcast episode (artist) - replaces old createPodcast
router.post('/podcasts', authenticate, authorize('artist'), validateAWSConfig, uploadAudioMiddleware, uploadErrorHandler, uploadPodcast);

// Upload episode (artist) - keeping for backward compatibility if needed
router.post('/podcasts/:id/episodes', authenticate, authorize('artist', 'admin'), validateAWSConfig, uploadAudioMiddleware, uploadErrorHandler, uploadEpisode);

// Publish episode
router.put('/podcast-episodes/:id/publish', authenticate, authorize('artist', 'admin'), publishEpisode);

export default router;
