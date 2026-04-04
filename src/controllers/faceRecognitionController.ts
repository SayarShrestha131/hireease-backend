/**
 * Face Recognition Controller
 * Identifies people from captured images
 */

import { Request, Response } from 'express';
import { recognizeFace, searchAndVerifyByName } from '../services/faceRecognitionService';
import { detectFaceWithAPI } from '../services/faceApiService';
import path from 'path';
import fs from 'fs';

/**
 * Identify person from captured image
 * POST /api/face-recognition/identify
 */
export const identifyPerson = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if image was uploaded
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'Please upload an image',
      });
      return;
    }

    const capturedImagePath = req.file.path;

    console.log('[Face Recognition] Starting identification...');

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

    // Step 2: Search database for matching face
    const uploadsDir = path.join(__dirname, '../../uploads/profiles');
    const recognitionResult = await recognizeFace(capturedImagePath, uploadsDir);

    // Clean up uploaded file
    if (fs.existsSync(capturedImagePath)) {
      fs.unlinkSync(capturedImagePath);
    }

    if (recognitionResult.identified) {
      res.status(200).json({
        success: true,
        message: recognitionResult.message,
        data: {
          identified: true,
          userId: recognitionResult.userId,
          userName: recognitionResult.userName,
          confidence: recognitionResult.confidence,
          matchDetails: recognitionResult.matchDetails,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: recognitionResult.message,
        data: {
          identified: false,
          confidence: recognitionResult.confidence,
          message: 'Person not found in database',
        },
      });
    }
  } catch (error) {
    console.error('[Face Recognition] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Face recognition failed. Please try again.',
    });
  }
};

/**
 * Search for person by name and verify with captured image
 * POST /api/face-recognition/search
 */
export const searchByName = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        error: 'Please provide a name to search',
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

    console.log('[Face Recognition] Searching for:', name);

    // Detect face in captured image
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

    // Search and verify
    const uploadsDir = path.join(__dirname, '../../uploads/profiles');
    const result = await searchAndVerifyByName(capturedImagePath, name, uploadsDir);

    // Clean up
    if (fs.existsSync(capturedImagePath)) {
      fs.unlinkSync(capturedImagePath);
    }

    if (result.identified) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          identified: true,
          userId: result.userId,
          userName: result.userName,
          confidence: result.confidence,
          matchDetails: result.matchDetails,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message,
        data: {
          identified: false,
          confidence: result.confidence,
        },
      });
    }
  } catch (error) {
    console.error('[Face Recognition] Search error:', error);
    res.status(500).json({
      success: false,
      error: 'Search failed. Please try again.',
    });
  }
};
