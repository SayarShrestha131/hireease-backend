/**
 * Identity Verification Service
 * Prevents identity fraud by matching captured face with claimed identity
 */

import * as faceapi from 'face-api.js';
import '@tensorflow/tfjs';
import * as canvas from 'canvas';
import * as fs from 'fs';
import path from 'path';
import User from '../models/User';

const { Canvas, Image, ImageData } = canvas;
// @ts-ignore
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

export interface IdentityVerificationResult {
  verified: boolean;
  isIdentityMatch: boolean;
  confidence: number;
  message: string;
  claimedIdentity?: {
    userId: string;
    name: string;
    email: string;
  };
  actualIdentity?: {
    userId: string;
    name: string;
    email: string;
  };
  fraudDetected: boolean;
}

async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  const modelsPath = path.join(__dirname, '../../models');
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath),
  ]);
  modelsLoaded = true;
}

async function descriptorFromImage(imagePath: string): Promise<Float32Array | null> {
  try {
    console.log('[Identity Verification] Loading models...');
    await loadModels();
    console.log('[Identity Verification] Models loaded successfully');
    
    console.log('[Identity Verification] Loading image:', imagePath);
    const img = await canvas.loadImage(imagePath);
    console.log('[Identity Verification] Image loaded, dimensions:', img.width, 'x', img.height);
    
    console.log('[Identity Verification] Detecting face with optimized settings...');
    // Use optimized detection options for better accuracy
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 608,  // Higher resolution for better accuracy
      scoreThreshold: 0.25  // Even lower threshold for better detection
    });
    const detection = await faceapi.detectSingleFace(img, options).withFaceLandmarks().withFaceDescriptor();
    
    if (!detection) {
      console.error('[Identity Verification] No face detected in image');
      return null;
    }
    
    console.log('[Identity Verification] Face detected successfully, descriptor length:', detection.descriptor.length);
    return detection.descriptor;
  } catch (error) {
    console.error('[Identity Verification] Error in descriptorFromImage:', error);
    return null;
  }
}

function toDisplayName(user: any): string {
  return (user.username || user.email || '').trim();
}

function similarityFromDistance(distance: number): number {
  // Improved similarity calculation for better accuracy
  // Face-api distances typically range from 0.0 (identical) to 1.0+ (very different)
  // For same person: 0.0-0.4 (should be 70-100% similarity)
  // For different people: 0.5+ (should be 0-50% similarity)
  
  if (distance <= 0.3) {
    // Very close match - scale from 85% to 100%
    const similarity = 85 + ((0.3 - distance) / 0.3) * 15;
    return Math.round(Math.min(100, similarity));
  } else if (distance <= 0.5) {
    // Good match - scale from 60% to 85%
    const similarity = 60 + ((0.5 - distance) / 0.2) * 25;
    return Math.round(similarity);
  } else if (distance <= 0.7) {
    // Poor match - scale from 20% to 60%
    const similarity = 20 + ((0.7 - distance) / 0.2) * 40;
    return Math.round(similarity);
  } else {
    // Very poor match - scale from 0% to 20%
    const similarity = Math.max(0, 20 - ((distance - 0.7) / 0.3) * 20);
    return Math.round(similarity);
  }
}

/**
 * Verify identity: Check if captured face matches the claimed identity
 * 
 * Use Cases:
 * 1. User claims to be "John" (email: john@example.com) and uploads photo
 *    - System checks if photo matches John's saved profile picture
 *    - If YES: Allow (legitimate user)
 *    - If NO: Reject (fraud attempt - someone trying to impersonate John)
 * 
 * 2. User already has account with photo, tries to register again with different details
 *    - System detects the face belongs to existing user
 *    - Reject (duplicate account attempt)
 */
export async function verifyIdentity(
  capturedImagePath: string,
  claimedUserId: string,
  uploadsDir: string = 'uploads/profiles'
): Promise<IdentityVerificationResult> {
  try {
    console.log('[Identity Verification] Starting verification...');
    console.log('[Identity Verification] Claimed User ID:', claimedUserId);

    // Step 1: Get claimed user from database
    const claimedUser = await User.findById(claimedUserId).select('_id email username profilePicture');

    if (!claimedUser) {
      return {
        verified: false,
        isIdentityMatch: false,
        confidence: 0,
        message: 'User account not found. Please ensure you are logged in with the correct account.',
        fraudDetected: false,
      };
    }

    const claimedName = toDisplayName(claimedUser);

    console.log('[Identity Verification] Claimed identity:', claimedUser.email);

    // Step 2: Check if claimed user has a profile picture
    if (!claimedUser.profilePicture) {
      return {
        verified: false,
        isIdentityMatch: false,
        confidence: 0,
        message: 'No profile picture found for verification. Please upload a clear profile picture first, then try KYC submission again.',
        claimedIdentity: {
          userId: claimedUser._id.toString(),
          name: claimedName,
          email: claimedUser.email,
        },
        fraudDetected: false,
      };
    }

    // Step 3: Extract descriptor from captured image
    const capturedDescriptor = await descriptorFromImage(capturedImagePath);
    if (!capturedDescriptor) {
      return {
        verified: false,
        isIdentityMatch: false,
        confidence: 0,
        message: 'Failed to analyze the selfie image. Please ensure the image is clear and contains your face, then try again.',
        fraudDetected: false,
      };
    }

    // Step 4: Extract descriptor from claimed user's profile picture
    const claimedUserPicPath = path.join(uploadsDir, claimedUser.profilePicture);

    if (!fs.existsSync(claimedUserPicPath)) {
      return {
        verified: false,
        isIdentityMatch: false,
        confidence: 0,
        message: 'Profile picture file not found on server. Please re-upload your profile picture and try again.',
        fraudDetected: false,
      };
    }

    const claimedUserDescriptor = await descriptorFromImage(claimedUserPicPath);
    if (!claimedUserDescriptor) {
      console.error('[Identity Verification] Failed to extract face descriptor from profile picture:', claimedUserPicPath);
      console.error('[Identity Verification] Using fallback basic image comparison...');
      
      // Fallback: Use basic image similarity when face detection fails
      try {
        const { matchFaces } = require('./faceMatchingService');
        const fallbackResult = await matchFaces(claimedUserPicPath, capturedImagePath);
        
        return {
          verified: fallbackResult.isMatch,
          isIdentityMatch: fallbackResult.isMatch,
          confidence: fallbackResult.confidence,
          message: fallbackResult.message + ' (Using fallback comparison)',
          claimedIdentity: {
            userId: claimedUser._id.toString(),
            name: claimedName,
            email: claimedUser.email,
          },
          fraudDetected: false,
        };
      } catch (fallbackError) {
        console.error('[Identity Verification] Fallback comparison also failed:', fallbackError);
        return {
          verified: false,
          isIdentityMatch: false,
          confidence: 0,
          message: 'Failed to analyze your profile picture. Please re-upload a clear profile picture and try again.',
          fraudDetected: false,
        };
      }
    }

    // Step 5: Compare captured face with claimed user's profile picture
    const claimedDistance = faceapi.euclideanDistance(capturedDescriptor, claimedUserDescriptor);
    const claimedSimilarity = similarityFromDistance(claimedDistance);

    console.log(`[Identity Verification] Similarity with claimed identity: ${claimedSimilarity}%`);

    // Step 6: Search ALL users to see if captured face matches someone else
    const allUsers = await User.find({
      _id: { $ne: claimedUser._id }, // Exclude claimed user
      profilePicture: { $exists: true, $nin: [null, ''] },
    }).select('_id email username profilePicture');

    let actualMatch: { user: any; similarity: number; distance: number } | null = null;

    for (const user of allUsers) {
      if (!user.profilePicture) continue;
      const userPicPath = path.join(uploadsDir, user.profilePicture);

      if (!fs.existsSync(userPicPath)) continue;

      const userDescriptor = await descriptorFromImage(userPicPath);
      if (!userDescriptor) continue;

      const distance = faceapi.euclideanDistance(capturedDescriptor, userDescriptor);
      const similarity = similarityFromDistance(distance);

      if (distance < 0.55 && (!actualMatch || distance < actualMatch.distance)) {
        actualMatch = { user, similarity, distance };
      }
    }

    // Step 7: Determine verification result

    // Case 1: Captured face matches claimed identity ✅
    // Lowered threshold from 0.45 to 0.35 for better same-person detection
    if (claimedDistance < 0.35) {
      console.log('[Identity Verification] ✅ Identity verified!');

      return {
        verified: true,
        isIdentityMatch: true,
        confidence: claimedSimilarity,
        message: `Identity verified successfully as ${claimedName || claimedUser.email}`,
        claimedIdentity: {
          userId: claimedUser._id.toString(),
          name: claimedName,
          email: claimedUser.email,
        },
        fraudDetected: false,
      };
    }

    // Case 2: Captured face matches DIFFERENT user (FRAUD DETECTED!) 🚨
    // Keep strict threshold for fraud detection
    if (actualMatch && actualMatch.distance < 0.45) {
      const actualName = toDisplayName(actualMatch.user);

      console.log('[Identity Verification] 🚨 FRAUD DETECTED!');
      console.log(`[Identity Verification] Claimed: ${claimedUser.email}`);
      console.log(`[Identity Verification] Actual: ${actualMatch.user.email}`);

      return {
        verified: false,
        isIdentityMatch: false,
        confidence: actualMatch.similarity,
        message: `FRAUD DETECTED: The selfie matches a different user (${actualName || actualMatch.user.email}), not your account. Please ensure you are taking your own selfie.`,
        claimedIdentity: {
          userId: claimedUser._id.toString(),
          name: claimedName,
          email: claimedUser.email,
        },
        actualIdentity: {
          userId: actualMatch.user._id.toString(),
          name: actualName,
          email: actualMatch.user.email,
        },
        fraudDetected: true,
      };
    }

    // Case 3: Face doesn't match anyone (new person or poor quality image)
    console.log('[Identity Verification] ❌ No match found');

    return {
      verified: false,
      isIdentityMatch: false,
      confidence: claimedSimilarity,
      message: `Face verification failed. The selfie does not match your profile picture (${claimedSimilarity}% similarity). Please ensure you are the account owner and retake the selfie with better lighting and positioning.`,
      claimedIdentity: {
        userId: claimedUser._id.toString(),
        name: claimedName,
        email: claimedUser.email,
      },
      fraudDetected: false,
    };
  } catch (error) {
    console.error('[Identity Verification] Error:', error);
    return {
      verified: false,
      isIdentityMatch: false,
      confidence: 0,
      message: 'Identity verification failed due to a technical error. Please try again, and contact support if the issue persists.',
      fraudDetected: false,
    };
  }
}

/**
 * Check if captured face already exists in database (duplicate detection)
 */
export async function checkDuplicateIdentity(
  capturedImagePath: string,
  uploadsDir: string = 'uploads/profiles'
): Promise<{
  isDuplicate: boolean;
  existingUser?: {
    userId: string;
    name: string;
    email: string;
  };
  confidence: number;
  message: string;
}> {
  try {
    console.log('[Duplicate Check] Checking for existing identity...');

    const capturedDescriptor = await descriptorFromImage(capturedImagePath);
    if (!capturedDescriptor) {
      return {
        isDuplicate: false,
        confidence: 0,
        message: 'Failed to analyze image',
      };
    }

    // Search all users
    const users = await User.find({
      profilePicture: { $exists: true, $nin: [null, ''] },
    }).select('_id email username profilePicture');

    for (const user of users) {
      if (!user.profilePicture) continue;
      const userPicPath = path.join(uploadsDir, user.profilePicture);

      if (!fs.existsSync(userPicPath)) continue;

      const userDescriptor = await descriptorFromImage(userPicPath);
      if (!userDescriptor) continue;

      const distance = faceapi.euclideanDistance(capturedDescriptor, userDescriptor);
      const similarity = similarityFromDistance(distance);

      if (distance < 0.35) {
        const userName = toDisplayName(user);

        console.log('[Duplicate Check] 🚨 Duplicate found!');
        console.log(`[Duplicate Check] Existing user: ${user.email}`);

        return {
          isDuplicate: true,
          existingUser: {
            userId: user._id.toString(),
            name: userName,
            email: user.email,
          },
          confidence: similarity,
          message: `This face is already registered under ${userName || user.email}`,
        };
      }
    }

    console.log('[Duplicate Check] ✅ No duplicate found');

    return {
      isDuplicate: false,
      confidence: 0,
      message: 'No existing account found with this face',
    };
  } catch (error) {
    console.error('[Duplicate Check] Error:', error);
    return {
      isDuplicate: false,
      confidence: 0,
      message: 'Duplicate check failed',
    };
  }
}
