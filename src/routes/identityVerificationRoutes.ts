/**
 * Identity Verification Routes
 * Anti-fraud and duplicate detection
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { verifyUserIdentity, checkDuplicate } from '../controllers/identityVerificationController';

const router = express.Router();

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'identity-verify-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
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
 * POST /api/identity/verify
 * Verify if captured face matches claimed user identity
 * Body: userId (string), image (file)
 */
router.post('/verify', upload.single('image'), verifyUserIdentity);

/**
 * POST /api/identity/check-duplicate
 * Check if captured face already exists in database
 * Body: image (file)
 */
router.post('/check-duplicate', upload.single('image'), checkDuplicate);

export default router;
