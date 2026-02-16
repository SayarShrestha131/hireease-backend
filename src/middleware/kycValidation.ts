import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

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
 * Validation middleware for KYC submission
 * Validates required fields: licenseNumber, fullName, dateOfBirth, licenseExpiryDate
 */
export const validateKYCSubmission = [
  body('licenseNumber')
    .trim()
    .notEmpty()
    .withMessage('License number is required'),
  
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required'),
  
  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  
  body('licenseExpiryDate')
    .notEmpty()
    .withMessage('License expiry date is required')
    .isISO8601()
    .withMessage('License expiry date must be a valid date')
    .custom((value) => {
      const expiryDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for fair comparison
      
      if (expiryDate <= today) {
        throw new Error('License expiry date must be in the future');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * Validation middleware for KYC rejection
 * Validates that rejection reason is provided and minimum 10 characters
 */
export const validateRejection = [
  body('reason')
    .trim()
    .notEmpty()
    .withMessage('Rejection reason is required')
    .isLength({ min: 10 })
    .withMessage('Rejection reason must be at least 10 characters'),
  
  handleValidationErrors
];
