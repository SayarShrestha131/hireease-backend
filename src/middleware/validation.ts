import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

/**
 * Helper function to handle validation results
 * Throws error with validation details if validation fails
 */
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map(err => ({
      field: err.type === 'field' ? err.path : 'unknown',
      message: err.msg
    }));
    
    // Create error object with validation details
    const error: any = new Error('Validation failed');
    error.statusCode = 400;
    error.validationErrors = validationErrors;
    
    return next(error);
  }
  next();
};

/**
 * Validation middleware for user registration
 * Requirements: 1.3, 1.4
 */
export const validateRegister = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Email must be in valid format'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  handleValidationErrors
];

/**
 * Validation middleware for user login
 * Requirements: 2.3
 */
export const validateLogin = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];
