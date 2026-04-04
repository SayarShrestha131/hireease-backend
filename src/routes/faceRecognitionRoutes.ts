/**
 * Face Recognition Routes
 * Identify people from captured images
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { identifyPerson, searchByName } from '../controllers/faceRecognitionController';

const router = express.Router();

// Configure multer for temporary file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'face-recognition-' + uniqueSuffix + path.extname(file.originalname));
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
 * POST /api/face-recognition/identify
 * Identify person from captured image by searching all users in database
 * No authentication required (public endpoint for identification)
 */
router.post('/identify', upload.single('image'), identifyPerson);

/**
 * POST /api/face-recognition/search
 * Search for person by name and verify with captured image
 * No authentication required (public endpoint for search)
 */
router.post('/search', upload.single('image'), searchByName);

export default router;
