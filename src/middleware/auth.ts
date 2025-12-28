import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '../types/auth';

/**
 * Middleware to verify JWT token and attach user to request
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No token provided',
      });
      return;
    }

    // Extract token
    const token = authHeader.split(' ')[1];

    // Verify token
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }

    const decoded = jwt.verify(token, secret) as { userId: string };

    // Find user by ID
    const user = await User.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
      return;
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};
