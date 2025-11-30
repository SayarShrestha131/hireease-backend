import { Router } from 'express';
import { forgotPassword, verifyResetCode, resetPassword, changePassword } from '../controllers/passwordController';
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
 * Validation middleware for verify reset code
 */
const validateVerifyCode = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be in valid format'),
  
  body('code')
    .notEmpty()
    .withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Code must be 6 digits')
    .isNumeric()
    .withMessage('Code must contain only numbers'),
  
  handleValidationErrors
];

/**
 * Validation middleware for reset password
 */
const validateResetPassword = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be in valid format'),
  
  body('code')
    .notEmpty()
    .withMessage('Verification code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Code must be 6 digits')
    .isNumeric()
    .withMessage('Code must contain only numbers'),
  
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
 * Forgot password - Send password reset code via email
 * POST /api/auth/forgot-password
 * Requirements: 1.1
 */
router.post('/forgot-password', validateForgotPassword, forgotPassword);

/**
 * Verify reset code - Verify the 6-digit code
 * POST /api/auth/verify-reset-code
 * Requirements: 2.1
 */
router.post('/verify-reset-code', validateVerifyCode, verifyResetCode);

/**
 * Reset password - Update password using reset code
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
