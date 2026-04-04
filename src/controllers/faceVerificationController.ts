/**
 * Face Verification Controller
 * Handles face matching and verification requests
 */

import { Request, Response } from 'express';
import { matchFaces, verifyUserIdentity } from '../services/faceMatchingService';
import { detectFaceWithAPI } from '../services/faceApiService';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../types/auth';

/**
 * Verify user by comparing captured image with saved profile picture
 * POST /api/face-verification/verify
 */
export const verifyFace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    // Check if image was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'Please upload an image for verification',
      });
      return;
    }

    const capturedImagePath = req.file.path;

    console.log('[Face Verification] Starting verification for user:', userId);

    // Step 1: Detect face in captured image
    const faceDetection = await detectFaceWithAPI(capturedImagePath);

    if (!faceDetection.hasFace || !faceDetection.isRealFace) {
      // Clean up uploaded file
      if (fs.existsSync(capturedImagePath)) {
        fs.unlinkSync(capturedImagePath);
      }

      res.status(400).json({
        success: false,
        error: faceDetection.message,
      });
      return;
    }

    // Step 2: Match with saved profile picture
    const uploadsDir = path.join(__dirname, '../../uploads/profiles');
    const matchResult = await verifyUserIdentity(userId, capturedImagePath, uploadsDir);

    // Clean up uploaded file
    if (fs.existsSync(capturedImagePath)) {
      fs.unlinkSync(capturedImagePath);
    }

    if (matchResult.isMatch) {
      res.status(200).json({
        success: true,
        message: matchResult.message,
        data: {
          verified: true,
          confidence: matchResult.confidence,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      res.status(403).json({
        success: false,
        error: matchResult.message,
        data: {
          verified: false,
          confidence: matchResult.confidence,
        },
      });
    }
  } catch (error) {
    console.error('[Face Verification] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Face verification failed. Please try again.',
    });
  }
};

/**
 * Compare two uploaded images
 * POST /api/face-verification/compare
 */
export const compareFaces = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if both images were uploaded
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files || !files.image1 || !files.image2) {
      res.status(400).json({
        success: false,
        error: 'Please upload both images for comparison',
      });
      return;
    }

    const image1Path = files.image1[0].path;
    const image2Path = files.image2[0].path;

    console.log('[Face Verification] Comparing two images');

    // Detect faces in both images
    const face1Detection = await detectFaceWithAPI(image1Path);
    const face2Detection = await detectFaceWithAPI(image2Path);

    // Check if both have valid faces
    if (!face1Detection.hasFace || !face1Detection.isRealFace) {
      // Clean up
      if (fs.existsSync(image1Path)) fs.unlinkSync(image1Path);
      if (fs.existsSync(image2Path)) fs.unlinkSync(image2Path);

      res.status(400).json({
        success: false,
        error: `First image: ${face1Detection.message}`,
      });
      return;
    }

    if (!face2Detection.hasFace || !face2Detection.isRealFace) {
      // Clean up
      if (fs.existsSync(image1Path)) fs.unlinkSync(image1Path);
      if (fs.existsSync(image2Path)) fs.unlinkSync(image2Path);

      res.status(400).json({
        success: false,
        error: `Second image: ${face2Detection.message}`,
      });
      return;
    }

    // Compare faces
    const matchResult = await matchFaces(image1Path, image2Path);

    // Clean up
    if (fs.existsSync(image1Path)) fs.unlinkSync(image1Path);
    if (fs.existsSync(image2Path)) fs.unlinkSync(image2Path);

    res.status(200).json({
      success: true,
      message: matchResult.message,
      data: {
        isMatch: matchResult.isMatch,
        confidence: matchResult.confidence,
        similarity: matchResult.details.similarity,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Face Verification] Comparison error:', error);
    res.status(500).json({
      success: false,
      error: 'Face comparison failed. Please try again.',
    });
  }
};
