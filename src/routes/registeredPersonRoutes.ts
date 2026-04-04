/**
 * Registered Person Routes
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import {
  registerPerson,
  verifyPerson,
  identifyPerson,
  logVerifyAttempt,
  getAllPersons,
  getPersonByLicense,
  getPersonById,
  deletePerson,
} from '../controllers/registeredPersonController';

const router = express.Router();

// Configure multer for registered persons photos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/registered-persons/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'person-' + uniqueSuffix + path.extname(file.originalname));
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

// Configure multer for temporary verification photos
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'verify-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const tempUpload = multer({
  storage: tempStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
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
 * POST /api/registered-persons/register
 * Register new person with photo
 */
router.post('/register', upload.single('photo'), registerPerson);

/**
 * POST /api/registered-persons/verify
 * Verify person by user ID and captured photo
 */
router.post('/verify', tempUpload.fields([{ name: 'photo', maxCount: 1 }, { name: 'frames', maxCount: 5 }]), verifyPerson);

/**
 * POST /api/registered-persons/verify-attempts
 * Log verification attempts
 */
router.post('/verify-attempts', logVerifyAttempt);

/**
 * POST /api/registered-persons/identify
 * Identify person from captured photo (search all)
 */
router.post('/identify', tempUpload.single('photo'), identifyPerson);

/**
 * GET /api/registered-persons
 * Get all registered persons with pagination
 */
router.get('/', getAllPersons);

/**
 * GET /api/registered-persons/license/:licenseNumber
 * Get person by license number
 */
router.get('/license/:licenseNumber', getPersonByLicense);

/**
 * GET /api/registered-persons/:id
 * Get person by ID
 */
router.get('/:id', getPersonById);

/**
 * DELETE /api/registered-persons/:id
 * Delete person
 */
router.delete('/:id', deletePerson);

export default router;
