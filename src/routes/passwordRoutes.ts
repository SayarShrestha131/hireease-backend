import { Router } from 'express';
import { forgotPassword, resetPassword, changePassword } from '../controllers/passwordController';
import { authenticate } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

const router = Router();

/**
 * Helper function to handle validation results
 */
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(err => ({
      field: err.type === 'field' ? err.path : 'unknown',
      message: err.msg
    }));
    
    const error: any = new Error('Validation failed');
    error.statusCode = 400;
    error.validationErrors = validationErrors;
    
    return next(error);
  }
  next();
};

/**
 * Validation middleware for forgot password
 */
const validateForgotPassword = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be in valid format'),
  
  handleValidationErrors
];

/**
 * Validation middleware for reset password
 */
const validateResetPassword = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
  
  handleValidationErrors
];

/**
 * Validation middleware for change password
 */
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .notEmpty()
    .withMessage('New password is required')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long'),
  
  handleValidationErrors
];

/**
 * Forgot password - Send password reset email
 * POST /api/auth/forgot-password
 * Requirements: 1.1
 */
router.post('/forgot-password', validateForgotPassword, forgotPassword);

/**
 * Reset password - Update password using reset token
 * POST /api/auth/reset-password
 * Requirements: 2.1
 */
router.post('/reset-password', validateResetPassword, resetPassword);

/**
 * Change password - Update password for authenticated user
 * POST /api/auth/change-password
 * Requirements: 3.1
 */
router.post('/change-password', authenticate, validateChangePassword, changePassword);

export default router;
