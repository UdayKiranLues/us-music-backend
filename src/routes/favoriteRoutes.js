import express from 'express';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  checkFavorite,
  checkMultipleFavorites,
} from '../controllers/favoriteController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getFavorites);
router.post('/check-multiple', validate(schemas.checkMultipleFavorites), checkMultipleFavorites);
router.post('/:songId', addFavorite);
router.delete('/:songId', removeFavorite);
router.get('/:songId/check', checkFavorite);

export default router;
