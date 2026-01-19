import express from 'express';
import {
  uploadPodcast,
  getPublicFeed,
  getArtistPodcasts,
  getPodcast,
  deletePodcast,
  getCategories,
} from '../controllers/podcastController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { uploadAudioMiddleware, uploadErrorHandler, validateAWSConfig } from '../middleware/upload.js';

const router = express.Router();

/**
 * Public routes
 */
router.get('/feed', getPublicFeed);
router.get('/categories', getCategories);
router.get('/:id', getPodcast);

/**
 * Artist-only routes
 */
router.post('/upload',
  authenticate,
  authorize('artist'),
  validateAWSConfig,
  uploadAudioMiddleware,
  uploadErrorHandler,
  uploadPodcast
);

router.get('/artist/dashboard',
  authenticate,
  authorize('artist'),
  getArtistPodcasts
);

router.delete('/:id',
  authenticate,
  authorize('artist'),
  deletePodcast
);

export default router;
