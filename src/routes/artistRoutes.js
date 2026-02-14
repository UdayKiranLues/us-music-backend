import express from 'express';
import {
    getArtistMe,
    updateArtistProfile,
    getArtistStats
} from '../controllers/artistController.js';
import { getArtistSongs } from '../controllers/songController.js';
import { getArtistAlbums } from '../controllers/albumController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', authenticate, authorize('artist', 'admin', 'user'), getArtistMe);
router.get('/stats', authenticate, authorize('artist', 'admin', 'user'), getArtistStats);
router.get('/songs', authenticate, authorize('artist', 'admin', 'user'), getArtistSongs);
router.get('/albums', authenticate, authorize('artist', 'admin', 'user'), getArtistAlbums);
router.put('/profile', authenticate, authorize('artist', 'admin', 'user'), updateArtistProfile);

export default router;
