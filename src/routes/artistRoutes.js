import express from 'express';
import { getArtistMe, updateArtistProfile } from '../controllers/artistController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', authenticate, authorize('artist', 'admin'), getArtistMe);
router.put('/profile', authenticate, authorize('artist', 'admin'), updateArtistProfile);

export default router;
