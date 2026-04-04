/**
 * Registered Person Controller
 * Manage registered persons and verify them
 */

import { Request, Response } from 'express';
import RegisteredPerson from '../models/RegisteredPerson';
import VerificationAttempt, { VerificationResultCode } from '../models/VerificationAttempt';
import { verifyPersonWithFaceAPI, identifyPersonWithFaceAPI, loadFaceApiModels } from '../services/realFaceRecognitionService';
import { detectFaceWithAPI } from '../services/faceApiService';
import path from 'path';
import fs from 'fs';

// Load face-api models on startup
loadFaceApiModels().catch(err => {
  console.error('[Face API] Failed to load models on startup:', err);
});

const logVerificationAttempt = async (
  userId: string,
  result: VerificationResultCode,
  distance?: number
): Promise<void> => {
  try {
    await VerificationAttempt.create({
      userId: userId.toUpperCase(),
      result,
      distance,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('[Registered Person] Failed to log verification attempt:', error);
  }
};

/**
 * Register new person with photo
 * POST /api/registered-persons/register
 */
export const registerPerson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, licenseNumber, email, phone, address, dateOfBirth, notes } = req.body;

    // Validate required fields
    if (!fullName || !licenseNumber) {
      res.status(400).json({
        success: false,
        error: 'Full name and license number are required',
      });
      return;
    }

    // Validate phone number (must be exactly 10 digits)
    if (!phone || !/^\d{10}$/.test(phone)) {
      res.status(400).json({
        success: false,
        error: 'Phone number must be exactly 10 digits',
      });
      return;
    }

    // Check if photo was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'Photo is required',
      });
      return;
    }

    const photoPath = req.file.path;

    // Detect face in photo
    const faceDetection = await detectFaceWithAPI(photoPath);

    if (!faceDetection.hasFace || !faceDetection.isRealFace) {
      // Delete uploaded file
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }

      res.status(400).json({
        success: false,
        error: faceDetection.message,
      });
      return;
    }

    // Check if license number already exists
    const existing = await RegisteredPerson.findOne({
      licenseNumber: licenseNumber.toUpperCase(),
    });

    if (existing) {
      // Delete uploaded file
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }

      res.status(400).json({
        success: false,
        error: `License number ${licenseNumber} is already registered`,
      });
      return;
    }

    // Create new registered person
    const person = new RegisteredPerson({
      fullName,
      licenseNumber: licenseNumber.toUpperCase(),
      email,
      phone,
      address,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      photoPath: req.file.filename,
      notes,
    });

    await person.save();

    console.log('[Registered Person] New person registered:', person.fullName);

    res.status(201).json({
      success: true,
      message: 'Person registered successfully',
      data: {
        id: person._id,
        fullName: person.fullName,
        licenseNumber: person.licenseNumber,
        email: person.email,
        phone: person.phone,
        registeredAt: person.registeredAt,
      },
    });
  } catch (error) {
    console.error('[Registered Person] Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
};

/**
 * Verify person by license number and captured photo
 * POST /api/registered-persons/verify
 */
export const verifyPerson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { licenseNumber } = req.body;

    if (!licenseNumber) {
      res.status(400).json({
        success: false,
        error: 'License number is required',
      });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const singlePhoto = req.file;
    const primaryPhoto = singlePhoto || files?.photo?.[0];
    const liveFrames = files?.frames || [];

    if (!primaryPhoto) {
      res.status(400).json({
        success: false,
        error: 'Photo is required',
      });
      return;
    }

    const capturedPhotoPath = primaryPhoto.path;

    const person = await RegisteredPerson.findOne({
      licenseNumber: licenseNumber.toUpperCase(),
      isActive: true,
    });

    if (!person) {
      await logVerificationAttempt(licenseNumber, 'ERROR');
      if (fs.existsSync(capturedPhotoPath)) fs.unlinkSync(capturedPhotoPath);
      for (const frame of liveFrames) {
        if (fs.existsSync(frame.path)) fs.unlinkSync(frame.path);
      }
      res.status(404).json({
        success: false,
        error: 'User not registered',
      });
      return;
    }

    if (person.lockoutUntil && person.lockoutUntil.getTime() > Date.now()) {
      const retryAfterSeconds = Math.ceil((person.lockoutUntil.getTime() - Date.now()) / 1000);
      if (fs.existsSync(capturedPhotoPath)) fs.unlinkSync(capturedPhotoPath);
      for (const frame of liveFrames) {
        if (fs.existsSync(frame.path)) fs.unlinkSync(frame.path);
      }
      res.status(429).json({
        success: false,
        error: `Too many failed attempts. Retry in ${retryAfterSeconds}s.`,
        data: {
          retryAfterSeconds,
        },
      });
      return;
    }

    // Detect face in captured photo
    const faceDetection = await detectFaceWithAPI(capturedPhotoPath);

    if (!faceDetection.hasFace || !faceDetection.isRealFace) {
      if (fs.existsSync(capturedPhotoPath)) {
        fs.unlinkSync(capturedPhotoPath);
      }
      for (const frame of liveFrames) {
        if (fs.existsSync(frame.path)) fs.unlinkSync(frame.path);
      }

      person.failedVerificationCount += 1;
      if (person.failedVerificationCount >= 3) {
        person.lockoutUntil = new Date(Date.now() + 60_000);
      }
      await person.save();
      await logVerificationAttempt(licenseNumber, 'ERROR');

      res.status(400).json({
        success: false,
        error: faceDetection.message,
      });
      return;
    }

    // Verify person using REAL face recognition
    const registeredPhotosDir = path.join(__dirname, '../../uploads/registered-persons');
    const result = await verifyPersonWithFaceAPI(
      licenseNumber,
      capturedPhotoPath,
      registeredPhotosDir,
      liveFrames.map((frame) => frame.path)
    );

    // Clean up captured photo
    if (fs.existsSync(capturedPhotoPath)) {
      fs.unlinkSync(capturedPhotoPath);
    }
    for (const frame of liveFrames) {
      if (fs.existsSync(frame.path)) fs.unlinkSync(frame.path);
    }

    if (result.verified) {
      person.failedVerificationCount = 0;
      person.lockoutUntil = undefined;
      await person.save();
      await logVerificationAttempt(licenseNumber, 'VERIFIED', result.faceDistance);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          verified: true,
          resultCode: result.resultCode,
          confidence: result.confidence,
          distance: result.faceDistance,
          person: result.personDetails,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      const outcome = result.resultCode === 'UNCERTAIN' ? 'UNCERTAIN' : 'REJECTED';
      person.failedVerificationCount += 1;
      if (person.failedVerificationCount >= 3) {
        person.lockoutUntil = new Date(Date.now() + 60_000);
      }
      await person.save();
      await logVerificationAttempt(licenseNumber, outcome, result.faceDistance);

      res.status(403).json({
        success: false,
        error: result.message,
        data: {
          verified: false,
          resultCode: result.resultCode,
          confidence: result.confidence,
          distance: result.faceDistance,
          person: result.personDetails,
          failedAttempts: person.failedVerificationCount,
          lockoutUntil: person.lockoutUntil || null,
        },
      });
    }
  } catch (error) {
    console.error('[Registered Person] Verification error:', error);
    res.status(500).json({
      success: false,
      error: 'Verification failed',
    });
  }
};

export const logVerifyAttempt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, timestamp, distance, result } = req.body as {
      userId?: string;
      timestamp?: string;
      distance?: number;
      result?: VerificationResultCode;
    };

    if (!userId || !result) {
      res.status(400).json({
        success: false,
        error: 'userId and result are required',
      });
      return;
    }

    await VerificationAttempt.create({
      userId: userId.toUpperCase(),
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      distance: typeof distance === 'number' ? distance : undefined,
      result,
    });

    res.status(201).json({
      success: true,
      message: 'Verification attempt logged',
    });
  } catch (error) {
    console.error('[Registered Person] Log attempt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to log verification attempt',
    });
  }
};

/**
 * Search and identify person from captured photo
 * POST /api/registered-persons/identify
 */
export const identifyPerson = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'Photo is required',
      });
      return;
    }

    const capturedPhotoPath = req.file.path;

    // Detect face
    const faceDetection = await detectFaceWithAPI(capturedPhotoPath);

    if (!faceDetection.hasFace || !faceDetection.isRealFace) {
      if (fs.existsSync(capturedPhotoPath)) {
        fs.unlinkSync(capturedPhotoPath);
      }

      res.status(400).json({
        success: false,
        error: faceDetection.message,
      });
      return;
    }

    // Search and verify using REAL face recognition
    const registeredPhotosDir = path.join(__dirname, '../../uploads/registered-persons');
    const result = await identifyPersonWithFaceAPI(capturedPhotoPath, registeredPhotosDir);

    // Clean up
    if (fs.existsSync(capturedPhotoPath)) {
      fs.unlinkSync(capturedPhotoPath);
    }

    if (result.verified) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          verified: true,
          confidence: result.confidence,
          person: result.personDetails,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message,
        data: {
          verified: false,
          confidence: result.confidence,
        },
      });
    }
  } catch (error) {
    console.error('[Registered Person] Identification error:', error);
    res.status(500).json({
      success: false,
      error: 'Identification failed',
    });
  }
};

/**
 * Get all registered persons with pagination
 * GET /api/registered-persons
 */
export const getAllPersons = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const total = await RegisteredPerson.countDocuments({ isActive: true });
    const persons = await RegisteredPerson.find({ isActive: true })
      .select('-__v')
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        persons,
        total,
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    console.error('[Registered Person] Get all error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch persons',
    });
  }
};

/**
 * Get person by ID
 * GET /api/registered-persons/:id
 */
export const getPersonById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const person = await RegisteredPerson.findById(id);

    if (!person) {
      res.status(404).json({
        success: false,
        error: 'Person not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        person,
      },
    });
  } catch (error) {
    console.error('[Registered Person] Get by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch person',
    });
  }
};

/**
 * Get person by license number
 * GET /api/registered-persons/:licenseNumber
 */
export const getPersonByLicense = async (req: Request, res: Response): Promise<void> => {
  try {
    const { licenseNumber } = req.params;

    const person = await RegisteredPerson.findOne({
      licenseNumber: licenseNumber.toUpperCase(),
      isActive: true,
    });

    if (!person) {
      res.status(404).json({
        success: false,
        error: 'Person not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: person,
    });
  } catch (error) {
    console.error('[Registered Person] Get by license error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch person',
    });
  }
};

/**
 * Delete person
 * DELETE /api/registered-persons/:id
 */
export const deletePerson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const person = await RegisteredPerson.findById(id);

    if (!person) {
      res.status(404).json({
        success: false,
        error: 'Person not found',
      });
      return;
    }

    // Delete photo file
    const photoPath = path.join(__dirname, '../../uploads/registered-persons', person.photoPath);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }

    // Delete from database
    await RegisteredPerson.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Person deleted successfully',
    });
  } catch (error) {
    console.error('[Registered Person] Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete person',
    });
  }
};
