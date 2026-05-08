import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';

/**
 * Rate limiting store for payment attempts
 * In production, this should use Redis or a persistent store
 * 
 * Structure: Map<userId, { attempts: number, resetTime: Date }>
 */
const paymentAttempts = new Map<string, { attempts: number; resetTime: Date }>();

/**
 * Rate limiting middleware for payment endpoints
 * Limits to 10 payment attempts per user per hour
 * 
 * Requirements: 4.7
 */
export const paymentRateLimiter = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id?.toString();

    // If user is not authenticated, skip rate limiting
    // (authentication middleware should handle this)
    if (!userId) {
      next();
      return;
    }

    const now = new Date();
    const userAttempts = paymentAttempts.get(userId);

    // If no previous attempts or reset time has passed, initialize/reset
    if (!userAttempts || now >= userAttempts.resetTime) {
      paymentAttempts.set(userId, {
        attempts: 1,
        resetTime: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now
      });
      next();
      return;
    }

    // Check if user has exceeded the limit
    if (userAttempts.attempts >= 10) {
      const minutesRemaining = Math.ceil(
        (userAttempts.resetTime.getTime() - now.getTime()) / (60 * 1000)
      );

      res.status(429).json({
        success: false,
        error: `Rate limit exceeded. You have reached the maximum of 10 payment attempts per hour. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
        retryAfter: userAttempts.resetTime.toISOString(),
      });
      return;
    }

    // Increment attempt count
    userAttempts.attempts += 1;
    paymentAttempts.set(userId, userAttempts);

    next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    // On error, allow the request to proceed (fail open)
    next();
  }
};

/**
 * Cleanup function to remove expired rate limit entries
 * Should be called periodically (e.g., every hour)
 */
export const cleanupExpiredRateLimits = (): void => {
  const now = new Date();
  
  for (const [userId, data] of paymentAttempts.entries()) {
    if (now >= data.resetTime) {
      paymentAttempts.delete(userId);
    }
  }
};

// Run cleanup every hour
setInterval(cleanupExpiredRateLimits, 60 * 60 * 1000);
