import express from 'express';
import {
    getAlbums,
    getAlbum,
    createAlbum,
    updateAlbum,
    deleteAlbum,
} from '../controllers/albumController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getAlbums);
router.get('/:id', getAlbum);

router.post('/', authenticate, authorize('artist', 'admin'), createAlbum);
router.put('/:id', authenticate, updateAlbum);
router.delete('/:id', authenticate, deleteAlbum);

export default router;
