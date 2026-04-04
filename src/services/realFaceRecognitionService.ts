/**
 * Real Face Recognition Service using face-api.js
 * This uses actual facial feature detection and comparison
 */

import * as faceapi from 'face-api.js';
import '@tensorflow/tfjs';
import * as canvas from 'canvas';
import * as fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import RegisteredPerson from '../models/RegisteredPerson';

// Setup canvas for face-api
const { Canvas, Image, ImageData } = canvas;
// @ts-ignore
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;
const FACE_CONFIG = {
  verifiedDistance: 0.45,
  uncertainDistance: 0.55,
  similarityDenominator: 0.6,
  minLivenessFrames: 5,
  minLivenessMovement: 1.5,
  detectionScoreThreshold: 0.3, // Lower threshold for better detection (default is 0.5)
  detectionInputSize: 416, // Larger input size for better accuracy (default is 416)
};

/**
 * Load face-api models
 */
export async function loadFaceApiModels(): Promise<void> {
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
    throw new Error('Failed to load face recognition models');
  }
}

/**
 * Get face descriptor (128-dimensional vector representing the face)
 */
async function getFaceDescriptor(imagePath: string): Promise<Float32Array | null> {
  try {
    // Load image
    const img = await canvas.loadImage(imagePath);

    // Configure detection options with lower threshold for better detection
    const detectionOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: FACE_CONFIG.detectionInputSize,
      scoreThreshold: FACE_CONFIG.detectionScoreThreshold,
    });

    const detections = await faceapi.detectAllFaces(img, detectionOptions);
    const faceCount = detections.length;
    if (faceCount !== 1) {
      console.log('[Face API] Expected exactly one face, found:', faceCount);
      return null;
    }
    
    // Detect face with landmarks and descriptor
    const detection = await faceapi
      .detectSingleFace(img, detectionOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.log('[Face API] No face detected in:', imagePath);
      return null;
    }

    console.log('[Face API] Face detected with confidence:', detection.detection.score);
    
    return detection.descriptor;
  } catch (error) {
    console.error('[Face API] Error getting face descriptor:', error);
    return null;
  }
}

async function getDetectionDetails(imagePath: string): Promise<{
  descriptor: Float32Array;
  centerX: number;
  centerY: number;
} | null> {
  try {
    const img = await canvas.loadImage(imagePath);
    
    // Configure detection options with lower threshold
    const detectionOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: FACE_CONFIG.detectionInputSize,
      scoreThreshold: FACE_CONFIG.detectionScoreThreshold,
    });
    
    const detection = await faceapi
      .detectSingleFace(img, detectionOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;

    const { x, y, width, height } = detection.detection.box;
    return {
      descriptor: detection.descriptor,
      centerX: x + width / 2,
      centerY: y + height / 2,
    };
  } catch (error) {
    console.error('[Face API] Error getting detection details:', error);
    return null;
  }
}

/**
 * Calculate Euclidean distance between two face descriptors
 * Lower distance = more similar faces
 */
function calculateFaceDistance(descriptor1: Float32Array, descriptor2: Float32Array): number {
  return faceapi.euclideanDistance(descriptor1, descriptor2);
}

function averageDescriptors(descriptors: Float32Array[]): Float32Array {
  const size = descriptors[0].length;
  const sum = new Float32Array(size);
  for (const descriptor of descriptors) {
    for (let i = 0; i < size; i += 1) {
      sum[i] += descriptor[i];
    }
  }
  for (let i = 0; i < size; i += 1) {
    sum[i] /= descriptors.length;
  }
  return sum;
}

/**
 * Convert distance to similarity percentage
 * Distance typically ranges from 0 (identical) to 1+ (very different)
 * We convert to 0-100% similarity
 */
function distanceToSimilarity(distance: number): number {
  const similarity = Math.max(0, Math.min(100, (1 - distance / FACE_CONFIG.similarityDenominator) * 100));
  return Math.round(similarity);
}

export type MatchResultCode = 'VERIFIED' | 'UNCERTAIN' | 'REJECTED';

function classifyDistance(distance: number): MatchResultCode {
  if (distance < FACE_CONFIG.verifiedDistance) return 'VERIFIED';
  if (distance <= FACE_CONFIG.uncertainDistance) return 'UNCERTAIN';
  return 'REJECTED';
}

async function analyzeLiveness(framePaths: string[]): Promise<{
  ok: boolean;
  reason?: string;
  averagedDescriptor?: Float32Array;
}> {
  if (framePaths.length < FACE_CONFIG.minLivenessFrames) {
    return { ok: false, reason: `At least ${FACE_CONFIG.minLivenessFrames} frames are required for anti-spoofing check.` };
  }

  const hashes = new Set<string>();
  const centers: Array<{ x: number; y: number }> = [];
  const descriptors: Float32Array[] = [];

  for (const framePath of framePaths.slice(0, 5)) {
    const frameBuffer = fs.readFileSync(framePath);
    hashes.add(crypto.createHash('sha256').update(frameBuffer).digest('hex'));

    const details = await getDetectionDetails(framePath);
    if (!details) {
      return { ok: false, reason: 'No face detected in one or more liveness frames.' };
    }
    centers.push({ x: details.centerX, y: details.centerY });
    descriptors.push(details.descriptor);
  }

  if (hashes.size <= 1) {
    return { ok: false, reason: 'Frames are identical. Possible spoofing attempt detected.' };
  }

  let movementSum = 0;
  for (let i = 1; i < centers.length; i += 1) {
    const dx = centers[i].x - centers[i - 1].x;
    const dy = centers[i].y - centers[i - 1].y;
    movementSum += Math.sqrt(dx * dx + dy * dy);
  }

  const averageMovement = movementSum / (centers.length - 1);
  if (averageMovement < FACE_CONFIG.minLivenessMovement) {
    return { ok: false, reason: 'Insufficient natural movement detected. Please move slightly and retry.' };
  }

  return {
    ok: true,
    averagedDescriptor: averageDescriptors(descriptors),
  };
}

/**
 * Verify person by license number using REAL face recognition
 */
export async function verifyPersonWithFaceAPI(
  licenseNumber: string,
  capturedImagePath: string,
  registeredPhotosDir: string = 'uploads/registered-persons',
  liveFramePaths: string[] = []
): Promise<{
  verified: boolean;
  resultCode: MatchResultCode;
  confidence: number;
  message: string;
  personDetails?: any;
  faceDistance?: number;
}> {
  try {
    // Ensure models are loaded
    if (!modelsLoaded) {
      await loadFaceApiModels();
    }

    console.log('[Face API] Verifying license:', licenseNumber);

    // Find person in database
    const person = await RegisteredPerson.findOne({
      licenseNumber: licenseNumber.toUpperCase(),
      isActive: true,
    });

    if (!person) {
      return {
        verified: false,
        resultCode: 'REJECTED',
        confidence: 0,
        message: `License number ${licenseNumber} not found in database`,
      };
    }

    console.log('[Face API] Found person:', person.fullName);

    // Get registered photo path
    const registeredPhotoPath = path.join(registeredPhotosDir, person.photoPath);

    if (!fs.existsSync(registeredPhotoPath)) {
      return {
        verified: false,
        resultCode: 'REJECTED',
        confidence: 0,
        message: 'Registered photo not found',
      };
    }

    // Get face descriptors
    console.log('[Face API] Analyzing registered photo...');
    const registeredDescriptor = await getFaceDescriptor(registeredPhotoPath);
    
    if (!registeredDescriptor) {
      return {
        verified: false,
        resultCode: 'REJECTED',
        confidence: 0,
        message: 'No face detected in registered photo. Please re-register with a clear face photo.',
      };
    }

    let capturedDescriptor: Float32Array | null = null;
    if (liveFramePaths.length >= FACE_CONFIG.minLivenessFrames) {
      console.log('[Face API] Running multi-frame liveness check...');
      const liveness = await analyzeLiveness(liveFramePaths);
      if (!liveness.ok) {
        return {
          verified: false,
          resultCode: 'REJECTED',
          confidence: 0,
          message: liveness.reason || 'Liveness check failed',
        };
      }
      capturedDescriptor = liveness.averagedDescriptor || null;
    } else {
      console.log('[Face API] Analyzing captured photo...');
      capturedDescriptor = await getFaceDescriptor(capturedImagePath);
    }
    
    if (!capturedDescriptor) {
      return {
        verified: false,
        resultCode: 'REJECTED',
        confidence: 0,
        message: 'No face detected in captured photo. Please take a clear selfie showing your face.',
      };
    }

    // Calculate face distance
    const distance = calculateFaceDistance(registeredDescriptor, capturedDescriptor);
    const similarity = distanceToSimilarity(distance);

    console.log('[Face API] Face distance:', distance.toFixed(4));
    console.log('[Face API] Similarity:', similarity + '%');

    // Threshold: distance < 0.6 is same person (similarity > 0%)
    // We use 50% similarity as threshold (distance ~0.3)
    const resultCode = classifyDistance(distance);
    const isMatch = resultCode === 'VERIFIED';

    if (isMatch) {
      // Update verification stats
      person.lastVerifiedAt = new Date();
      person.verificationCount += 1;
      await person.save();

      let message = '';
      if (similarity >= 80) {
        message = `Excellent match! Verified as ${person.fullName}`;
      } else if (similarity >= 65) {
        message = `Good match! Verified as ${person.fullName}`;
      } else {
        message = `Verified as ${person.fullName}`;
      }

      return {
        verified: true,
        resultCode,
        confidence: similarity,
        message,
        faceDistance: distance,
        personDetails: {
          id: person._id,
          fullName: person.fullName,
          licenseNumber: person.licenseNumber,
          email: person.email,
          phone: person.phone,
          verificationCount: person.verificationCount,
        },
      };
    } else {
      return {
        verified: false,
        resultCode,
        confidence: similarity,
        message:
          resultCode === 'UNCERTAIN'
            ? `Face match is uncertain for ${person.fullName}. Please retry with better lighting.`
            : `Face does not match ${person.fullName}. Please ensure you are the registered person.`,
        faceDistance: distance,
        personDetails: {
          fullName: person.fullName,
          licenseNumber: person.licenseNumber,
        },
      };
    }
  } catch (error) {
    console.error('[Face API] Verification error:', error);
    return {
      verified: false,
      resultCode: 'REJECTED',
      confidence: 0,
      message: 'Face verification failed. Please try again.',
    };
  }
}

/**
 * Search and identify person using REAL face recognition
 */
export async function identifyPersonWithFaceAPI(
  capturedImagePath: string,
  registeredPhotosDir: string = 'uploads/registered-persons'
): Promise<{
  verified: boolean;
  confidence: number;
  message: string;
  personDetails?: any;
  faceDistance?: number;
}> {
  try {
    // Ensure models are loaded
    if (!modelsLoaded) {
      await loadFaceApiModels();
    }

    console.log('[Face API] Identifying person from photo...');

    // Get captured face descriptor
    const capturedDescriptor = await getFaceDescriptor(capturedImagePath);
    
    if (!capturedDescriptor) {
      return {
        verified: false,
        confidence: 0,
        message: 'No face detected in captured photo. Please take a clear selfie.',
      };
    }

    // Get all registered persons
    const persons = await RegisteredPerson.find({ isActive: true });

    if (persons.length === 0) {
      return {
        verified: false,
        confidence: 0,
        message: 'No registered persons in database',
      };
    }

    console.log(`[Face API] Comparing with ${persons.length} registered persons...`);

    // Compare with all registered persons
    let bestMatch: {
      person: any;
      distance: number;
      similarity: number;
    } | null = null;

    for (const person of persons) {
      const registeredPhotoPath = path.join(registeredPhotosDir, person.photoPath);

      if (!fs.existsSync(registeredPhotoPath)) {
        continue;
      }

      const registeredDescriptor = await getFaceDescriptor(registeredPhotoPath);
      
      if (!registeredDescriptor) {
        continue;
      }

      const distance = calculateFaceDistance(capturedDescriptor, registeredDescriptor);
      const similarity = distanceToSimilarity(distance);

      console.log(`[Face API] ${person.fullName}: distance=${distance.toFixed(4)}, similarity=${similarity}%`);

      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = {
          person,
          distance,
          similarity,
        };
      }
    }

    if (bestMatch && bestMatch.distance < 0.6 && bestMatch.similarity >= 50) {
      // Update verification stats
      bestMatch.person.lastVerifiedAt = new Date();
      bestMatch.person.verificationCount += 1;
      await bestMatch.person.save();

      return {
        verified: true,
        confidence: bestMatch.similarity,
        message: `Identified as ${bestMatch.person.fullName}`,
        faceDistance: bestMatch.distance,
        personDetails: {
          id: bestMatch.person._id,
          fullName: bestMatch.person.fullName,
          licenseNumber: bestMatch.person.licenseNumber,
          email: bestMatch.person.email,
          phone: bestMatch.person.phone,
          verificationCount: bestMatch.person.verificationCount,
        },
      };
    } else {
      return {
        verified: false,
        confidence: bestMatch?.similarity || 0,
        message: 'Person not recognized in database',
        faceDistance: bestMatch?.distance,
      };
    }
  } catch (error) {
    console.error('[Face API] Identification error:', error);
    return {
      verified: false,
      confidence: 0,
      message: 'Face identification failed. Please try again.',
    };
  }
}

/**
 * Extract face descriptor from an image (exported for face verification test)
 * @param imagePath - Path to the image file
 * @returns Face descriptor (128-dimensional vector) or null if no face found
 */
export async function extractFaceDescriptor(imagePath: string): Promise<Float32Array | null> {
  return await getFaceDescriptor(imagePath);
}

/**
 * Compare two face descriptors and determine if they match (exported for face verification test)
 * @param descriptor1 - First face descriptor
 * @param descriptor2 - Second face descriptor
 * @returns Comparison result with match status, confidence, distance, and message
 */
export function compareFaceDescriptors(
  descriptor1: Float32Array,
  descriptor2: Float32Array
): {
  isMatch: boolean;
  confidence: number;
  distance: number;
  message: string;
} {
  const distance = calculateFaceDistance(descriptor1, descriptor2);
  const confidence = distanceToSimilarity(distance);
  const matchCode = classifyDistance(distance);

  let isMatch = false;
  let message = '';

  switch (matchCode) {
    case 'VERIFIED':
      isMatch = true;
      if (confidence >= 90) {
        message = 'Excellent match! Face verified with high confidence.';
      } else if (confidence >= 80) {
        message = 'Very good match! Face verified successfully.';
      } else {
        message = 'Good match! Face verified.';
      }
      break;
    case 'UNCERTAIN':
      isMatch = false;
      message = 'Uncertain match. Please ensure good lighting and face the camera directly.';
      break;
    case 'REJECTED':
      isMatch = false;
      message = 'Face does not match. Please ensure you are the account owner.';
      break;
  }

  console.log('[Face API] Comparison result:', {
    distance: distance.toFixed(4),
    confidence: `${confidence}%`,
    matchCode,
    isMatch,
  });

  return {
    isMatch,
    confidence,
    distance,
    message,
  };
}
