import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { generateToken } from '../utils/jwt';
import { ConflictError, AuthenticationError } from '../utils/errors';

/**
 * Register a new user
 * @route POST /api/auth/register
 */
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Check if user with email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Create new user
    const user = await User.create({
      email,
      password,
    });

    // Generate JWT token
    const token = generateToken(user._id.toString());

    // Return user data (password excluded by toJSON transform) and token
    res.status(201).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login an existing user
 * @route POST /api/auth/login
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Compare provided password with stored hashed password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Generate JWT token
    const token = generateToken(user._id.toString());

    // Return user data (password excluded by toJSON transform) and token
    res.status(200).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};
