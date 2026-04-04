/**
 * Enhanced Face Detection Service
 * Using face-api.js for REAL AI-powered face detection
 */

import * as faceapi from 'face-api.js';
import '@tensorflow/tfjs';
import * as canvas from 'canvas';
import * as fs from 'fs';
import path from 'path';

// Setup canvas for face-api
const { Canvas, Image, ImageData } = canvas;
// @ts-ignore
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

/**
 * Load face-api models
 */
async function loadModels(): Promise<void> {
  if (modelsLoaded) return;

  try {
    const modelsPath = path.join(__dirname, '../../models');
    console.log('[Face API] Loading models from:', modelsPath);
    
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath),
    ]);

    modelsLoaded = true;
    console.log('[Face API] ✅ Models loaded successfully');
  } catch (error) {
    console.error('[Face API] ❌ Failed to load models:', error);
    throw new Error('Failed to load face detection models');
  }
}

export interface FaceDetectionResult {
  hasFace: boolean;
  faceCount: number;
  confidence: number;
  message: string;
  isRealFace: boolean;
}

/**
 * Detect face using REAL AI face detection
 */
export async function detectFaceWithAPI(imagePath: string): Promise<FaceDetectionResult> {
  try {
    console.log('[Face Detection] Analyzing image with AI:', imagePath);

    // Ensure models are loaded
    if (!modelsLoaded) {
      await loadModels();
    }

    // Load image
    const img = await canvas.loadImage(imagePath);
    
    // Detect all faces
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks();

    const faceCount = detections.length;
    const hasFace = faceCount > 0;

    let confidence = 0;
    let message = '';
    let isRealFace = false;

    if (faceCount === 0) {
      message = 'No face detected. Please take a clear selfie showing your face with good lighting and frontal view.';
      confidence = 0;
    } else if (faceCount === 1) {
      const detection = detections[0];
      confidence = Math.round(detection.detection.score * 100);
      isRealFace = confidence >= 70;
      
      if (confidence >= 90) {
        message = 'Excellent - Face detected with high confidence';
      } else if (confidence >= 70) {
        message = 'Good - Face detected successfully';
      } else {
        message = 'Face detected but confidence is low. Please ensure good lighting, clear visibility, and face the camera directly.';
      }
    } else {
      // Multiple faces detected
      const bestDetection = detections.reduce((best, current) => 
        current.detection.score > best.detection.score ? current : best
      );
      confidence = Math.round(bestDetection.detection.score * 100);
      message = `Multiple faces detected (${faceCount}). Please take a selfie with only your face visible - no other people in the background.`;
      isRealFace = false; // Reject if multiple faces
    }

    const result: FaceDetectionResult = {
      hasFace,
      faceCount,
      confidence,
      message,
      isRealFace,
    };

    console.log('[Face Detection] ✅ AI Analysis complete:', {
      faceCount,
      confidence: `${confidence}%`,
      isRealFace,
      message,
    });

    return result;
  } catch (error) {
    console.error('[Face Detection] Error:', error);
    return {
      hasFace: false,
      faceCount: 0,
      confidence: 0,
      message: 'Failed to analyze image. Please try again with a different photo - ensure good lighting and clear face visibility.',
      isRealFace: false,
    };
  }
}

/**
 * Validate selfie image with strict requirements
 */
export async function validateSelfie(
  imagePath: string
): Promise<{
  isValid: boolean;
  message: string;
  faceDetection: FaceDetectionResult;
}> {
  try {
    console.log('[Face Detection] Validating selfie:', imagePath);

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return {
        isValid: false,
        message: 'Image file not found - please upload a valid image file',
        faceDetection: {
          hasFace: false,
          faceCount: 0,
          confidence: 0,
          message: 'Image file not found - please upload a valid image file',
          isRealFace: false,
        },
      };
    }

    // Detect face
    const faceDetection = await detectFaceWithAPI(imagePath);

    // Strict validation
    const isValid =
      faceDetection.hasFace &&
      faceDetection.confidence >= 60 &&
      faceDetection.isRealFace;

    return {
      isValid,
      message: faceDetection.message,
      faceDetection,
    };
  } catch (error) {
    console.error('[Face Detection] Validation error:', error);
    return {
      isValid: false,
      message: 'Failed to validate selfie image. Please try again with a clear, well-lit photo.',
      faceDetection: {
        hasFace: false,
        faceCount: 0,
        confidence: 0,
        message: 'Validation failed - please ensure good image quality and try again',
        isRealFace: false,
      },
    };
  }
}

/**
 * Initialize face detection service
 */
export async function initializeFaceDetection(): Promise<void> {
  try {
    await loadModels();
    console.log('[Face Detection] ✅ Face detection service initialized with AI models');
  } catch (error) {
    console.error('[Face Detection] ❌ Failed to initialize:', error);
    throw error;
  }
}
