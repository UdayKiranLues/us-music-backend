import express from "express";
import {
  uploadSong,
  uploadSongWithCover,
} from "../controllers/uploadController.js";
import {
  uploadAudioMiddleware,
  uploadWithCoverMiddleware,
  uploadErrorHandler,
} from "../middleware/upload.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validateAWSConfig } from "../middleware/upload.js";


const router = express.Router();

/**
 * =========================================================
 *  POST /api/v1/upload/song
 * ---------------------------------------------------------
 *  Description:
 *    Upload an audio file, process it, and convert to HLS.
 *
 *  Access:
 *    Private (Artist, Admin)
 *
 *  Flow:
 *    Auth → Role Check → AWS Config Check
 *    → Upload Audio → Error Handler → Controller
 * =========================================================
 */
router.post(
  "/song",
  authenticate,
  authorize("artist", "admin"),
  validateAWSConfig,
  uploadAudioMiddleware,
  uploadErrorHandler,
  uploadSong
);

/**
 * =========================================================
 *  POST /api/v1/upload/song-with-cover
 * ---------------------------------------------------------
 *  Description:
 *    Upload an audio file along with a cover image.
 *
 *  Access:
 *    Private (Artist, Admin)
 *
 *  Flow:
 *    Auth → Role Check → AWS Config Check
 *    → Upload Audio + Image → Error Handler → Controller
 * =========================================================
 */
router.post(
  "/song-with-cover",
  authenticate,
  authorize("artist", "admin"),
  validateAWSConfig,
  uploadWithCoverMiddleware,
  uploadErrorHandler,
  uploadSongWithCover
);

export default router;
