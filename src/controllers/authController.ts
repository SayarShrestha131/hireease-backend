import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import { generateToken } from '../utils/jwt';
import { ConflictError, AuthenticationError } from '../utils/errors';
import { sendEmail } from '../utils/emailService';

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

    // Create new user (email not verified yet)
    const user = await User.create({
      email,
      password,
      isEmailVerified: false,
    });

    // Generate email verification code
    const verificationCode = user.generateEmailVerificationCode();
    await user.save();

    // Send verification email
    const message = `Welcome! Please verify your email address to complete your registration.\n\nYour verification code is:\n\n${verificationCode}\n\nThis code will expire in 30 minutes.\n\nIf you did not create an account, please ignore this email.`;

    const htmlMessage = `
      <h2>Welcome to Vehicle Rental!</h2>
      <p>Please verify your email address to complete your registration.</p>
      <p>Your verification code is:</p>
      <h1 style="font-size: 32px; letter-spacing: 8px; color: #0096c7; font-weight: bold;">${verificationCode}</h1>
      <p>This code will expire in 30 minutes.</p>
      <p>If you did not create an account, please ignore this email.</p>
    `;

    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email Address',
      text: message,
      html: htmlMessage,
    });

    // Return user data without token (user must verify email first)
    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification code.',
      data: {
        email: user.email,
        userId: user._id,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify email with code
 * @route POST /api/auth/verify-email
 */
export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, code } = req.body;

    // Validate code format (6 digits)
    if (!code || !/^\d{6}$/.test(code)) {
      res.status(400).json({
        success: false,
        error: 'Invalid code format',
      });
      return;
    }

    // Hash the incoming code to match against stored hash
    const hashedCode = crypto
      .createHash('sha256')
      .update(code)
      .digest('hex');

    // Find user with matching email, code, and valid expiration
    const user = await User.findOne({
      email,
      emailVerificationCode: hashedCode,
      emailVerificationExpires: { $gt: Date.now() },
    });

    // Check if code is invalid or expired
    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code',
      });
      return;
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Generate JWT token
    const token = generateToken(user._id.toString());

    // Return user data and token
    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
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
 * Resend verification code
 * @route POST /api/auth/resend-verification
 */
export const resendVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Check if already verified
    if (user.isEmailVerified) {
      res.status(400).json({
        success: false,
        error: 'Email is already verified',
      });
      return;
    }

    // Generate new verification code
    const verificationCode = user.generateEmailVerificationCode();
    await user.save();

    // Send verification email
    const message = `Your new verification code is:\n\n${verificationCode}\n\nThis code will expire in 30 minutes.`;

    const htmlMessage = `
      <h2>Email Verification</h2>
      <p>Your new verification code is:</p>
      <h1 style="font-size: 32px; letter-spacing: 8px; color: #0096c7; font-weight: bold;">${verificationCode}</h1>
      <p>This code will expire in 30 minutes.</p>
    `;

    await sendEmail({
      to: user.email,
      subject: 'New Verification Code',
      text: message,
      html: htmlMessage,
    });

    res.status(200).json({
      success: true,
      message: 'Verification code sent successfully',
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

    // Check if email is verified
    if (!user.isEmailVerified) {
      res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in',
        needsVerification: true,
      });
      return;
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
