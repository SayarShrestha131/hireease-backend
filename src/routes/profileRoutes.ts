import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getProfile,
  updateProfile,
  deleteAccount,
  getBookingHistory,
  addEmergencyContact,
  removeEmergencyContact,
  uploadProfilePicture,
  getProfilePicture,
  deleteProfilePicture,
} from '../controllers/profileController';
import { authenticate } from '../middleware/auth';
import { uploadProfilePicture as uploadMiddleware, handleProfileUploadError, validateProfilePictureFace } from '../middleware/profileUploadMiddleware';
import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

const router = Router();

/**
 * Rate limiter for profile picture upload endpoint - DISABLED for testing
 * Limits users to 5 uploads per hour to prevent abuse
 * Requirements: 11.7 (Security)
 */
const profilePictureUploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 999999, // Effectively unlimited for testing
  message: {
    success: false,
    error: 'Too many profile picture uploads. You can upload up to 5 pictures per hour.',
    retryAfter: 'Please try again in an hour.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request) => {
    // Rate limit per authenticated user, fallback to IP with proper IPv6 handling
    const userId = (req as any).user?._id;
    if (userId) {
      return `user:${userId}`;
    }
    // Use the built-in IP key generator for proper IPv6 support
    return req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    const resetTime = new Date(Date.now() + 60 * 60 * 1000);
    res.status(429).json({
      success: false,
      error: 'Too many profile picture uploads. You can upload up to 5 pictures per hour.',
      retryAfter: 'Please try again in an hour.',
      resetTime: resetTime.toISOString(),
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
  },
});

/**
 * Validation middleware
 */
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array(),
    });
  }
  next();
};

/**
 * @route   GET /api/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/', authenticate, getProfile);

/**
 * @route   PUT /api/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/',
  authenticate,
  [
    body('username')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Username must be between 2 and 50 characters'),
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Please provide a valid date of birth'),
  ],
  handleValidationErrors,
  updateProfile
);

/**
 * @route   DELETE /api/profile
 * @desc    Delete user account
 * @access  Private
 */
router.delete(
  '/',
  authenticate,
  [
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  handleValidationErrors,
  deleteAccount
);

/**
 * @route   GET /api/profile/bookings
 * @desc    Get user booking history
 * @access  Private
 */
router.get('/bookings', authenticate, getBookingHistory);

/**
 * @route   POST /api/profile/emergency-contacts
 * @desc    Add emergency contact
 * @access  Private
 */
router.post(
  '/emergency-contacts',
  authenticate,
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('relationship').notEmpty().withMessage('Relationship is required'),
    body('phone').notEmpty().withMessage('Phone is required'),
  ],
  handleValidationErrors,
  addEmergencyContact
);

/**
 * @route   DELETE /api/profile/emergency-contacts/:index
 * @desc    Remove emergency contact
 * @access  Private
 */
router.delete('/emergency-contacts/:index', authenticate, removeEmergencyContact);

/**
 * @route   POST /api/profile/picture
 * @desc    Upload profile picture
 * @access  Private
 */
router.post(
  '/picture',
  authenticate,
  profilePictureUploadLimiter,
  uploadMiddleware.single('profilePicture'),
  handleProfileUploadError,
  validateProfilePictureFace,
  uploadProfilePicture
);

/**
 * @route   GET /api/profile/picture/:filename
 * @desc    Get profile picture
 * @access  Public
 */
router.get('/picture/:filename', getProfilePicture);

/**
 * @route   DELETE /api/profile/picture
 * @desc    Delete profile picture
 * @access  Private
 */
router.delete('/picture', authenticate, deleteProfilePicture);

export default router;
