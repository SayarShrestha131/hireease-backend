import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import User from '../models/User';
// import Booking from '../models/Booking'; // TODO: Implement Booking model
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

    // Check if user can update profile (7-day restriction) - DISABLED for testing
    // Note: Notification preferences can be updated anytime
    const isProfileUpdate = username !== undefined || dateOfBirth !== undefined || contactInfo !== undefined;
    
    // Restriction disabled - always allow profile updates
    // if (isProfileUpdate) {
    //   const updateCheck = user.canUpdateProfile();
    //   
    //   if (!updateCheck.allowed) {
    //     res.status(403).json({
    //       success: false,
    //       error: `Profile can only be updated once every 7 days. You can update again in ${updateCheck.daysRemaining} day(s).`,
    //       data: {
    //         daysRemaining: updateCheck.daysRemaining,
    //         nextUpdateDate: updateCheck.nextUpdateDate,
    //         lastUpdateDate: user.lastProfileUpdate
    //       }
    //     });
    //     return;
    //   }
    // }

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

    // Update notification preferences if provided (no restriction)
    if (notificationPreferences !== undefined) {
      user.notificationPreferences = { ...user.notificationPreferences, ...notificationPreferences };
    }

    // Update lastProfileUpdate timestamp only for profile/contact changes
    if (isProfileUpdate) {
      user.lastProfileUpdate = new Date();
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user,
        nextUpdateAllowed: isProfileUpdate ? new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)) : undefined
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload profile picture
 * @route POST /api/profile/picture
 */
export const uploadProfilePicture = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const file = req.file;

    console.log('[ProfileController] ========== UPLOAD START ==========');
    console.log('[ProfileController] Upload request from user:', userId);
    console.log('[ProfileController] File received:', file ? file.filename : 'none');
    console.log('[ProfileController] File details:', file ? {
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    } : 'NO FILE');

    if (!file) {
      console.log('[ProfileController] ❌ No file provided');
      res.status(400).json({
        success: false,
        error: 'No image file provided',
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log('[ProfileController] ❌ User not found');
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    console.log('[ProfileController] User found:', user.email);

    // Delete old profile picture if exists
    if (user.profilePicture) {
      const fs = require('fs');
      const path = require('path');
      const oldImagePath = path.join(__dirname, '../../uploads/profiles', user.profilePicture);
      console.log('[ProfileController] Deleting old image:', oldImagePath);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
        console.log('[ProfileController] ✅ Old image deleted');
      }
    }

    // Update user's profile picture
    console.log('[ProfileController] Saving new profile picture:', file.filename);
    user.profilePicture = file.filename;
    await user.save();

    console.log('[ProfileController] ✅ Profile picture updated successfully');
    console.log('[ProfileController] ========== UPLOAD END ==========');

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        user,
        profilePictureUrl: `/api/profile/picture/${file.filename}`
      },
    });
  } catch (error) {
    console.error('[ProfileController] ❌ Error uploading profile picture:', error);
    next(error);
  }
};

/**
 * Get profile picture
 * @route GET /api/profile/picture/:filename
 */
export const getProfilePicture = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { filename } = req.params;
    const path = require('path');
    const fs = require('fs');

    console.log('[ProfileController] Fetching profile picture:', filename);

    // Validate filename
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      console.log('[ProfileController] Invalid filename:', filename);
      res.status(400).json({
        success: false,
        error: 'Invalid filename',
      });
      return;
    }

    const filePath = path.join(__dirname, '../../uploads/profiles', filename);
    console.log('[ProfileController] File path:', filePath);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log('[ProfileController] File not found:', filePath);
      res.status(404).json({
        success: false,
        error: 'Profile picture not found',
      });
      return;
    }

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    console.log('[ProfileController] Serving image with content type:', contentType);

    // Set headers and stream file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete profile picture
 * @route DELETE /api/profile/picture
 */
export const deleteProfilePicture = async (
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

    if (!user.profilePicture) {
      res.status(404).json({
        success: false,
        error: 'No profile picture to delete',
      });
      return;
    }

    // Delete file from filesystem
    const fs = require('fs');
    const path = require('path');
    const imagePath = path.join(__dirname, '../../uploads/profiles', user.profilePicture);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Remove from user document
    user.profilePicture = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile picture deleted successfully',
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
 * TODO: Implement once Booking model is created
 */
export const getBookingHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // const userId = req.user?._id;
    // const bookings = await Booking.find({ userId }).sort({ createdAt: -1 });

    // Temporary response until Booking model is implemented
    res.status(200).json({
      success: true,
      data: {
        bookings: [],
      },
      message: 'Booking history feature coming soon',
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
