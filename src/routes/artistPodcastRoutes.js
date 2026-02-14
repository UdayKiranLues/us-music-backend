import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateAWSConfig, uploadAudioMiddleware, uploadCoverMiddleware, uploadErrorHandler } from '../middleware/upload.js';
import { uploadPodcast, getArtistPodcasts } from '../controllers/podcastController.js';
import { uploadEpisode, publishEpisode } from '../controllers/podcastEpisodeController.js';

const router = express.Router();

// Get artist's own podcasts
router.get('/podcasts', authenticate, authorize('artist'), getArtistPodcasts);

// Upload podcast series (artist)
router.post('/podcasts', authenticate, authorize('artist'), validateAWSConfig, uploadCoverMiddleware, uploadErrorHandler, uploadPodcast);

// Upload episode (artist)
router.post('/podcasts/:id/episodes', authenticate, authorize('artist'), validateAWSConfig, uploadAudioMiddleware, uploadErrorHandler, uploadEpisode);

// Publish episode
router.put('/podcast-episodes/:id/publish', authenticate, authorize('artist'), publishEpisode);

export default router;
