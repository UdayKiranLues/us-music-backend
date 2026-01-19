import express from 'express';
import { streamEpisode, reportPlay, uploadEpisode, deleteEpisode } from '../controllers/podcastEpisodeController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateAWSConfig, uploadAudioMiddleware, uploadErrorHandler } from '../middleware/upload.js';

const router = express.Router();

// Public stream
router.get('/:id/stream', streamEpisode);
// Public report play (called by frontend after 30s)
router.post('/:id/report-play', reportPlay);

// Admin upload
router.post('/podcasts/:id/episodes', authenticate, authorize('admin'), validateAWSConfig, uploadAudioMiddleware, uploadErrorHandler, uploadEpisode);

// Admin delete
router.delete('/:id', authenticate, authorize('admin'), deleteEpisode);

export default router;
