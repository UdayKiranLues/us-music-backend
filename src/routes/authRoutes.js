import express from 'express';
import { register, login, logout, getMe, refreshToken, chooseRole, checkUsername, changeUsername, setUserRole } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

router.post('/register', validate(schemas.register), register);
router.post('/login', validate(schemas.login), login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.post('/refresh', refreshToken);
router.post('/choose-role', authenticate, validate(schemas.chooseRole), chooseRole);
router.get('/check-username/:username', checkUsername);
router.put('/username', authenticate, validate(schemas.changeUsername), changeUsername);
router.put('/set-role', authenticate, validate(schemas.chooseRole), setUserRole);

export default router;
