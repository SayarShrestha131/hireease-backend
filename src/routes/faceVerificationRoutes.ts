/**
 * Face Verification Routes
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { verifyFace, compareFaces } from '../controllers/faceVerificationController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Configure multer for temporary file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'face-verify-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, JPG, and PNG images are allowed'));
    }
  },
});

/**
 * POST /api/face-verification/verify
 * Verify user identity by comparing captured image with saved profile picture
 * Requires authentication
 */
router.post('/verify', authenticate, upload.single('image'), verifyFace);

/**
 * POST /api/face-verification/compare
 * Compare two uploaded images
 * Requires authentication
 */
router.post(
  '/compare',
  authenticate,
  upload.fields([
    { name: 'image1', maxCount: 1 },
    { name: 'image2', maxCount: 1 },
  ]),
  compareFaces
);

export default router;
