import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/kyc');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Configure multer storage with unique filename generation
 */
const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    // Generate unique filename: {userId}_{timestamp}_{uuid}.{ext}
    const userId = (req as any).user?._id || 'anonymous';
    const timestamp = Date.now();
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${userId}_${timestamp}_${uniqueId}${ext}`;
    cb(null, filename);
  },
});

/**
 * File filter to validate file types
 * Only accept JPEG, JPG, PNG, and PDF files
 */
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        'Invalid file type. Only JPEG, JPG, PNG, and PDF files are allowed.'
      )
    );
  }
};

/**
 * Configure multer with storage, file filter, and size limits
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 3, // Maximum 3 files (front, back, selfie)
  },
});

/**
 * Middleware for uploading KYC documents (front and back of license + selfie)
 */
export const uploadKYCDocuments = upload.fields([
  { name: 'licenseFrontImage', maxCount: 1 },
  { name: 'licenseBackImage', maxCount: 1 },
  { name: 'selfieImage', maxCount: 1 },
]);

/**
 * Error handling middleware for multer upload errors
 * Must be used after uploadKYCDocuments middleware
 */
export const handleUploadError = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    console.error('[Upload Error] Multer error:', err.message);
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        res.status(413).json({
          success: false,
          error: 'File size exceeds the 5MB limit. Please upload smaller images.',
        });
        return;
      
      case 'LIMIT_FILE_COUNT':
        res.status(400).json({
          success: false,
          error: 'Too many files. Please upload front, back, and optionally a selfie image.',
        });
        return;
      
      case 'LIMIT_UNEXPECTED_FILE':
        res.status(400).json({
          success: false,
          error: 'Unexpected file field. Please upload only licenseFrontImage and licenseBackImage.',
        });
        return;
      
      default:
        res.status(400).json({
          success: false,
          error: `File upload error: ${err.message}`,
        });
        return;
    }
  } else if (err) {
    // Other errors (e.g., file filter errors)
    console.error('[Upload Error] File validation error:', err.message);
    
    if (err.message.includes('file type')) {
      res.status(400).json({
        success: false,
        error: err.message,
      });
      return;
    }
    
    // Pass other errors to the global error handler
    next(err);
  } else {
    // No error, continue to next middleware
    next();
  }
};
