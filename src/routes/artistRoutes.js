import express from 'express';
import { getArtistMe, updateArtistProfile } from '../controllers/artistController.js';
import { getArtistSongs } from '../controllers/songController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/me', authenticate, authorize('artist', 'admin', 'user'), getArtistMe);
router.get('/songs', authenticate, authorize('artist', 'admin', 'user'), getArtistSongs);
router.get('/albums', authenticate, authorize('artist', 'admin', 'user'), (req, res) => {
    res.json({
        success: true,
        data: []
    });
});
router.put('/profile', authenticate, authorize('artist', 'admin', 'user'), updateArtistProfile);

export default router;
