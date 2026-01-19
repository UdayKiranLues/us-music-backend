import express from 'express';
import {
  getSongs,
  getSong,
  createSong,
  updateSong,
  deleteSong,
  incrementPlayCount,
  getSongStream,
  getSecureStream,
  proxyHLS,
  publishSong,
} from '../controllers/songController.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// Public routes (with optional CDN caching)
router.get('/', getSongs);
router.get('/:id', getSong);

// Public streaming routes (no auth required for playback)
router.get('/:id/stream', getSecureStream);
// HLS proxy route (bypasses CORS)
router.get('/:id/hls/*', proxyHLS);
// Legacy streaming route (backwards compatibility)
router.get('/:id/stream-legacy', getSongStream);

// Play count tracking (optional auth for analytics)
router.post('/:id/play', optionalAuth, incrementPlayCount);

// Protected routes
router.post('/', authenticate, authorize('artist', 'admin'), validate(schemas.createSong), createSong);
router.put('/:id', authenticate, validate(schemas.updateSong), updateSong);
router.put('/:id/publish', authenticate, authorize('artist', 'admin'), publishSong);
router.delete('/:id', authenticate, deleteSong);

export default router;
