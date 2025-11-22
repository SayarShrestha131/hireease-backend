import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError, ConflictError, AuthenticationError } from '../utils/errors';

/**
 * Global error handling middleware
 * Catches errors from routes and formats responses consistently
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default to 500 Internal Server Error
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: Array<{ field: string; message: string }> | undefined;

  // Handle custom error classes
  if (err instanceof ValidationError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ConflictError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof AuthenticationError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof AppError) {
    // Handle base AppError class
    statusCode = err.statusCode;
    message = err.message;
  } else if (err.validationErrors) {
    // Handle express-validator validation errors
    statusCode = err.statusCode || 400;
    message = err.message || 'Validation failed';
    errors = err.validationErrors;
  } else if (err.name === 'ValidationError') {
    // Handle Mongoose validation errors
    statusCode = 400;
    message = err.message;
  } else if (err.name === 'CastError') {
    // Handle Mongoose cast errors (invalid ObjectId, etc.)
    statusCode = 400;
    message = 'Invalid data format';
  } else if (err.message) {
    // Use the error message if available
    message = err.message;
  }

  // Log error with descriptive message
  console.error(`[ERROR] ${statusCode} - ${message}`);
  console.error(`[ERROR] Stack: ${err.stack}`);

  // Build error response
  const errorResponse: {
    success: boolean;
    error: {
      message: string;
      statusCode: number;
      errors?: Array<{ field: string; message: string }>;
    };
    stack?: string;
  } = {
    success: false,
    error: {
      message,
      statusCode,
      errors,
    },
  };

  // Include stack trace only in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Return appropriate HTTP status code with formatted error response
  res.status(statusCode).json(errorResponse);
};
