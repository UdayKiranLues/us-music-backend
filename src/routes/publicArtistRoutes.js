import express from 'express';
import {
    getPublicArtistProfile,
    getArtistSongsPublic,
    getArtistPodcastsPublic
} from '../controllers/artistController.js';

const router = express.Router();

// Public routes (no auth required)
router.get('/:artistName', getPublicArtistProfile);
router.get('/:artistName/songs', getArtistSongsPublic);
router.get('/:artistName/podcasts', getArtistPodcastsPublic);

export default router;
