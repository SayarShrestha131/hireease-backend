/**
 * Identity Verification Controller
 * Prevents identity fraud and duplicate accounts
 */

import { Request, Response } from 'express';
import { verifyIdentity, checkDuplicateIdentity } from '../services/identityVerificationService';
import { detectFaceWithAPI } from '../services/faceApiService';
import path from 'path';
import fs from 'fs';

/**
 * Verify user identity
 * POST /api/identity/verify
 * 
 * Checks if captured face matches the claimed user identity
 * Prevents fraud: Someone trying to use another person's details
 */
export const verifyUserIdentity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'Please upload an image',
      });
      return;
    }

    const capturedImagePath = req.file.path;

    console.log('[Identity Verification] Verifying identity for user:', userId);

    // Step 1: Detect face in captured image
    const faceDetection = await detectFaceWithAPI(capturedImagePath);

    if (!faceDetection.hasFace || !faceDetection.isRealFace) {
      if (fs.existsSync(capturedImagePath)) {
        fs.unlinkSync(capturedImagePath);
      }

      res.status(400).json({
        success: false,
        error: faceDetection.message,
      });
      return;
    }

    // Step 2: Verify identity
    const uploadsDir = path.join(__dirname, '../../uploads/profiles');
    const verificationResult = await verifyIdentity(capturedImagePath, userId, uploadsDir);

    // Clean up
    if (fs.existsSync(capturedImagePath)) {
      fs.unlinkSync(capturedImagePath);
    }

    // Case 1: Identity verified ✅
    if (verificationResult.verified && verificationResult.isIdentityMatch) {
      res.status(200).json({
        success: true,
        message: verificationResult.message,
        data: {
          verified: true,
          resultCode: 'VERIFIED',
          isIdentityMatch: true,
          confidence: verificationResult.confidence,
          claimedIdentity: verificationResult.claimedIdentity,
          fraudDetected: false,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // Case 2: Fraud detected 🚨
    if (verificationResult.fraudDetected) {
      res.status(403).json({
        success: false,
        error: verificationResult.message,
        data: {
          verified: false,
          resultCode: 'REJECTED',
          isIdentityMatch: false,
          confidence: verificationResult.confidence,
          claimedIdentity: verificationResult.claimedIdentity,
          actualIdentity: verificationResult.actualIdentity,
          fraudDetected: true,
          fraudType: 'IDENTITY_THEFT_ATTEMPT',
        },
      });
      return;
    }

    // Case 3: No match ❌
    res.status(403).json({
      success: false,
      error: verificationResult.message,
      data: {
        verified: false,
        resultCode: 'REJECTED',
        isIdentityMatch: false,
        confidence: verificationResult.confidence,
        claimedIdentity: verificationResult.claimedIdentity,
        fraudDetected: false,
      },
    });
  } catch (error) {
    console.error('[Identity Verification] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Identity verification failed. Please try again.',
    });
  }
};

/**
 * Check for duplicate identity
 * POST /api/identity/check-duplicate
 * 
 * Checks if captured face already exists in database
 * Prevents duplicate accounts
 */
export const checkDuplicate = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'Please upload an image',
      });
      return;
    }

    const capturedImagePath = req.file.path;

    console.log('[Duplicate Check] Checking for duplicate identity...');

    // Detect face
    const faceDetection = await detectFaceWithAPI(capturedImagePath);

    if (!faceDetection.hasFace || !faceDetection.isRealFace) {
      if (fs.existsSync(capturedImagePath)) {
        fs.unlinkSync(capturedImagePath);
      }

      res.status(400).json({
        success: false,
        error: faceDetection.message,
      });
      return;
    }

    // Check for duplicate
    const uploadsDir = path.join(__dirname, '../../uploads/profiles');
    const duplicateResult = await checkDuplicateIdentity(capturedImagePath, uploadsDir);

    // Clean up
    if (fs.existsSync(capturedImagePath)) {
      fs.unlinkSync(capturedImagePath);
    }

    if (duplicateResult.isDuplicate) {
      res.status(409).json({
        success: false,
        error: duplicateResult.message,
        data: {
          isDuplicate: true,
          existingUser: duplicateResult.existingUser,
          confidence: duplicateResult.confidence,
        },
      });
    } else {
      res.status(200).json({
        success: true,
        message: duplicateResult.message,
        data: {
          isDuplicate: false,
          confidence: duplicateResult.confidence,
        },
      });
    }
  } catch (error) {
    console.error('[Duplicate Check] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Duplicate check failed. Please try again.',
    });
  }
};
