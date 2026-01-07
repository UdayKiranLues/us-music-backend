import express from 'express';
import { getHistory, addToHistory, clearHistory, getStats } from '../controllers/historyController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getHistory);
router.post('/', validate(schemas.addHistory), addToHistory);
router.delete('/', clearHistory);
router.get('/stats', getStats);

export default router;
