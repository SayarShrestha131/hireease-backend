import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  deleteAccount,
  getBookingHistory,
  addEmergencyContact,
  removeEmergencyContact,
} from '../controllers/profileController';
import { authenticate } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

const router = Router();

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

export default router;
