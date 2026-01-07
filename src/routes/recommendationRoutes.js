import express from 'express';
import {
  getRecommendations,
  getTrending,
  getSimilarSongs,
  getNextSong,
} from '../controllers/recommendationController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, getRecommendations);
router.get('/trending', optionalAuth, getTrending);
router.get('/similar/:songId', optionalAuth, getSimilarSongs);
router.get('/next/:songId', optionalAuth, getNextSong);

export default router;
