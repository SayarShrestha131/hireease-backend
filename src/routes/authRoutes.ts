import { Router } from 'express';
import { register, login } from '../controllers/authController';
import { validateRegister, validateLogin } from '../middleware/validation';

const router = Router();

/**
 * Register a new user
 * POST /api/auth/register
 * Requirements: 1.1
 */
router.post('/register', validateRegister, register);

/**
 * Login an existing user
 * POST /api/auth/login
 * Requirements: 2.1
 */
router.post('/login', validateLogin, login);

export default router;
