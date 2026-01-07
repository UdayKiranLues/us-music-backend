import express from 'express';
import {
  uploadSong,
  uploadSongWithCover,
  uploadAudioMiddleware,
  uploadWithCoverMiddleware,
  uploadErrorHandler,
} from '../controllers/uploadController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateAWSConfig } from '../middleware/upload.js';

const router = express.Router();

/**
 * @route   POST /api/v1/upload/song
 * @desc    Upload audio file and convert to HLS
 * @access  Private (Artist/Admin)
 */
router.post(
  '/song',
  authenticate,
  authorize('artist', 'admin'),
  validateAWSConfig,
  uploadAudioMiddleware,
  uploadErrorHandler,
  uploadSong
);

/**
 * @route   POST /api/v1/upload/song-with-cover
 * @desc    Upload audio and cover image
 * @access  Private (Artist/Admin)
 */
router.post(
  '/song-with-cover',
  authenticate,
  authorize('artist', 'admin'),
  validateAWSConfig,
  uploadWithCoverMiddleware,
  uploadErrorHandler,
  uploadSongWithCover
);

export default router;
