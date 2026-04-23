import express from 'express';
import {
  diagnoseSongPlayback,
  checkSystemHealth,
  testPlayback,
} from '../controllers/diagnosticsController.js';

const router = express.Router();

// Diagnostic endpoints (public access for troubleshooting)
router.get('/song/:id', diagnoseSongPlayback);
router.get('/system', checkSystemHealth);
router.post('/test-playback', testPlayback);

export default router;
