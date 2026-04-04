import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';
import { detectFace } from '../services/faceDetectionService';
import { generateSecureFilename, validatePathWithinDirectory } from '../services/fileStorageSecurityService';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate secure unique filename with user ID association
    const userId = ((req as any).user?._id || 'unknown').toString();
    const secureFilename = generateSecureFilename(userId, file.originalname);
    
    // Validate the generated filename and path
    const uploadsDir = path.join(__dirname, '../../uploads/profiles');
    const fullPath = path.join(uploadsDir, secureFilename);
    const pathValidation = validatePathWithinDirectory(fullPath, uploadsDir);
    
    if (!pathValidation.isValid) {
      cb(new Error('File path validation failed'), '');
      return;
    }
    
    cb(null, secureFilename);
  },
});

// File filter - only allow images
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, and PNG images are allowed'));
  }
};

// Create multer upload instance
export const uploadProfilePicture = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
});

/**
 * Middleware to validate face presence in uploaded profile picture - DISABLED for testing
 * This runs after multer has saved the file
 */
export const validateProfilePictureFace = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // Face validation temporarily disabled for testing
  console.log('[Profile Upload] Face validation SKIPPED (disabled for testing)');
  next();
};

// Error handling middleware
export const handleProfileUploadError = (err: any, req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large. Maximum size is 5MB.',
        guidance: [
          'Reduce the image file size to under 5MB',
          'Use image compression tools or apps',
          'Take a new photo with lower resolution',
          'Convert to JPEG format for smaller file size'
        ],
        requirements: {
          maxSize: '5MB',
          recommendedSize: 'Under 2MB for faster upload'
        },
        nextSteps: {
          action: 'compress_image',
          message: 'Please compress your image and try again'
        }
      });
    }
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      error: err.message || 'File upload failed',
      guidance: err.message?.includes('file type') ? [
        'Only JPEG, JPG, and PNG images are allowed',
        'Check that your file has the correct extension (.jpg, .jpeg, .png)',
        'Convert your image to a supported format if needed'
      ] : [
        'Please check your image file and try again',
        'Ensure the file is not corrupted',
        'Use a supported image format (JPEG, JPG, PNG)'
      ],
      requirements: {
        allowedTypes: ['JPEG', 'JPG', 'PNG'],
        maxSize: '5MB'
      },
      nextSteps: {
        action: 'check_file_format',
        message: 'Please ensure your image is in the correct format and try again'
      }
    });
  }
  next();
};
