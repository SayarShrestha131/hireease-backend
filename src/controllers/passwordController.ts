import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import { sendEmail } from '../utils/emailService';
import { AuthRequest } from '../types/auth';

/**
 * Forgot password - Send password reset code via email
 * @route POST /api/auth/forgot-password
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });

    // Always return 200 even if user not found (security: prevent email enumeration)
    if (!user) {
      res.status(200).json({
        success: true,
        message: 'If an account exists, a password reset code has been sent',
      });
      return;
    }

    // Generate 6-digit reset code
    const resetCode = user.generateResetCode();

    // Save user with reset code and expiration
    await user.save();

    // Email content
    const message = `You are receiving this email because you (or someone else) has requested a password reset for your account.\n\nYour password reset code is:\n\n${resetCode}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, please ignore this email and your password will remain unchanged.`;

    const htmlMessage = `
      <h2>Password Reset Request</h2>
      <p>You are receiving this email because you (or someone else) has requested a password reset for your account.</p>
      <p>Your password reset code is:</p>
      <h1 style="font-size: 32px; letter-spacing: 8px; color: #0096c7; font-weight: bold;">${resetCode}</h1>
      <p>This code will expire in 15 minutes.</p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
    `;

    // Send email
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Code',
      text: message,
      html: htmlMessage,
    });

    res.status(200).json({
      success: true,
      message: 'If an account exists, a password reset code has been sent',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verify reset code - Verify the 6-digit code
 * @route POST /api/auth/verify-reset-code
 */
export const verifyResetCode = async (
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
      resetPasswordCode: hashedCode,
      resetPasswordExpires: { $gt: Date.now() },
    });

    // Check if code is invalid or expired
    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired code',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Code verified successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password - Update password using reset code
 * @route POST /api/auth/reset-password
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, code, newPassword } = req.body;

    // Validate new password meets minimum length requirement
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long',
      });
      return;
    }

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
      resetPasswordCode: hashedCode,
      resetPasswordExpires: { $gt: Date.now() },
    });

    // Check if code is invalid or expired
    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired code',
      });
      return;
    }

    // Update user password
    user.password = newPassword;
    
    // Clear reset code and expiration fields
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;

    // Save user (password will be hashed by pre-save hook)
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password - Update password for authenticated user
 * @route POST /api/auth/change-password
 */
export const changePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate new password meets minimum length requirement
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long',
      });
      return;
    }

    // Get authenticated user from request (set by auth middleware)
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
      return;
    }

    // Update user password
    user.password = newPassword;

    // Save user (password will be hashed by pre-save hook)
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
};
