import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import User from '../models/User';
import { sendEmail } from '../utils/emailService';

/**
 * Forgot password - Send password reset email
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
        message: 'If an account exists, a password reset email has been sent',
      });
      return;
    }

    // Generate reset token
    const resetToken = user.generateResetToken();

    // Save user with reset token and expiration
    await user.save();

    // Construct reset URL with token
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    // Email content
    const message = `You are receiving this email because you (or someone else) has requested a password reset for your account.\n\nPlease click on the following link to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request this, please ignore this email and your password will remain unchanged.`;

    const htmlMessage = `
      <h2>Password Reset Request</h2>
      <p>You are receiving this email because you (or someone else) has requested a password reset for your account.</p>
      <p>Please click on the following link to reset your password:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
    `;

    // Send email
    await sendEmail({
      to: user.email,
      subject: 'Password Reset Request',
      text: message,
      html: htmlMessage,
    });

    res.status(200).json({
      success: true,
      message: 'If an account exists, a password reset email has been sent',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password - Update password using reset token
 * @route POST /api/auth/reset-password
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    // Validate new password meets minimum length requirement
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long',
      });
      return;
    }

    // Hash the incoming token to match against stored hash
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with matching token and valid expiration
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    // Check if token is invalid or expired
    if (!user) {
      res.status(400).json({
        success: false,
        error: 'Invalid or expired reset token',
      });
      return;
    }

    // Update user password
    user.password = newPassword;
    
    // Clear reset token and expiration fields
    user.resetPasswordToken = undefined;
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
  req: Request,
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
