import { Request, Response, NextFunction } from 'express';

/**
 * Custom error class with status code
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handling middleware
 * Catches errors from routes and formats responses consistently
 */
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Default to 500 Internal Server Error
  let statusCode = 500;
  let message = 'Internal Server Error';

  // Check if it's our custom AppError
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
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
    message: string;
    error?: string;
    stack?: string;
  } = {
    success: false,
    message,
  };

  // Include error details and stack trace only in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = err.message;
    errorResponse.stack = err.stack;
  }

  // Return appropriate HTTP status code with formatted error response
  res.status(statusCode).json(errorResponse);
};
