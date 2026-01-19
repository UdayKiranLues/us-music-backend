import express from 'express';
import { registerArtist, loginArtist } from '../controllers/artistController.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

router.post('/register', validate(schemas.register), registerArtist);
router.post('/login', validate(schemas.login), loginArtist);

export default router;
