import { Router } from 'express';
import { register, login, verifyEmail, resendVerification } from '../controllers/authController';
import { validateRegister, validateLogin, validateVerifyEmail, validateResendVerification } from '../middleware/validation';

const router = Router();

/**
 * Register a new user
 * POST /api/auth/register
 * Requirements: 1.1
 */
router.post('/register', validateRegister, register);

/**
 * Verify email with code
 * POST /api/auth/verify-email
 */
router.post('/verify-email', validateVerifyEmail, verifyEmail);

/**
 * Resend verification code
 * POST /api/auth/resend-verification
 */
router.post('/resend-verification', validateResendVerification, resendVerification);

/**
 * Login an existing user
 * POST /api/auth/login
 * Requirements: 2.1
 */
router.post('/login', validateLogin, login);

export default router;
