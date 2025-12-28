import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import User from '../models/User';
import Booking from '../models/Booking';
import { ValidationError } from '../utils/errors';

/**
 * Get current user profile
 * @route GET /api/profile
 */
export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * @route PUT /api/profile
 */
export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { username, dateOfBirth, contactInfo, notificationPreferences } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Update username if provided
    if (username !== undefined) {
      user.username = username;
    }

    // Update date of birth if provided
    if (dateOfBirth !== undefined) {
      user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;
    }

    // Update contact info if provided
    if (contactInfo !== undefined) {
      user.contactInfo = { ...user.contactInfo, ...contactInfo };
    }

    // Update notification preferences if provided
    if (notificationPreferences !== undefined) {
      user.notificationPreferences = { ...user.notificationPreferences, ...notificationPreferences };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user booking history
 * @route GET /api/profile/bookings
 */
export const getBookingHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    const bookings = await Booking.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        bookings,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add emergency contact
 * @route POST /api/profile/emergency-contacts
 */
export const addEmergencyContact = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { name, relationship, phone } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    if (!user.emergencyContacts) {
      user.emergencyContacts = [];
    }

    user.emergencyContacts.push({ name, relationship, phone });
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Emergency contact added successfully',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove emergency contact
 * @route DELETE /api/profile/emergency-contacts/:index
 */
export const removeEmergencyContact = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { index } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    if (!user.emergencyContacts || !user.emergencyContacts[parseInt(index)]) {
      res.status(404).json({
        success: false,
        error: 'Emergency contact not found',
      });
      return;
    }

    user.emergencyContacts.splice(parseInt(index), 1);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Emergency contact removed successfully',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user account
 * @route DELETE /api/profile
 */
export const deleteAccount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { password } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Verify password before deletion
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new ValidationError('Invalid password');
    }

    // Delete user account
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
