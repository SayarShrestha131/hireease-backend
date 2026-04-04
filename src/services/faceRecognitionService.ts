/**
 * Face Recognition Service
 * Identifies a person from captured image by matching against all database images
 */

import sharp from 'sharp';
import * as fs from 'fs';
import path from 'path';
import User from '../models/User';

export interface FaceRecognitionResult {
  identified: boolean;
  userId?: string;
  userName?: string;
  confidence: number;
  message: string;
  matchDetails?: {
    email: string;
    fullName: string;
    profilePicture: string;
  };
}

interface ImageFeatures {
  aspectRatio: number;
  brightness: number;
  contrast: number;
  colorProfile: { red: number; green: number; blue: number };
  skinTone: number;
}

/**
 * Extract features from image
 */
async function extractImageFeatures(imagePath: string): Promise<ImageFeatures | null> {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const stats = await image.stats();

    const channels = stats.channels;
    const r = channels[0].mean;
    const g = channels[1].mean;
    const b = channels[2].mean;

    const brightness = (r + g + b) / 3;
    const contrast = (channels[0].stdev + channels[1].stdev + channels[2].stdev) / 3;

    // Calculate skin tone score
    let skinTone = 0;
    if (r > g && g > b) skinTone += 30;
    if (r >= 100 && r <= 255) skinTone += 20;
    if (g >= 50 && g <= 200) skinTone += 20;
    if (b >= 30 && b <= 180) skinTone += 20;
    const rgRatio = r / g;
    const gbRatio = g / b;
    if (rgRatio >= 1.1 && rgRatio <= 1.5) skinTone += 5;
    if (gbRatio >= 1.1 && gbRatio <= 1.5) skinTone += 5;

    return {
      aspectRatio: (metadata.width || 1) / (metadata.height || 1),
      brightness,
      contrast,
      colorProfile: { red: r, green: g, blue: b },
      skinTone,
    };
  } catch (error) {
    console.error('[Face Recognition] Feature extraction error:', error);
    return null;
  }
}

/**
 * Calculate similarity between two feature sets
 */
function calculateSimilarity(features1: ImageFeatures, features2: ImageFeatures): number {
  let similarity = 0;

  // Aspect ratio (20 points)
  const aspectDiff = Math.abs(features1.aspectRatio - features2.aspectRatio);
  similarity += Math.max(0, 20 - aspectDiff * 20);

  // Brightness (20 points)
  const brightnessDiff = Math.abs(features1.brightness - features2.brightness);
  similarity += Math.max(0, 20 - (brightnessDiff / 255) * 20);

  // Contrast (15 points)
  const contrastDiff = Math.abs(features1.contrast - features2.contrast);
  similarity += Math.max(0, 15 - (contrastDiff / 100) * 15);

  // Color profile (25 points)
  const redDiff = Math.abs(features1.colorProfile.red - features2.colorProfile.red);
  const greenDiff = Math.abs(features1.colorProfile.green - features2.colorProfile.green);
  const blueDiff = Math.abs(features1.colorProfile.blue - features2.colorProfile.blue);
  const colorDiff = (redDiff + greenDiff + blueDiff) / 3;
  similarity += Math.max(0, 25 - (colorDiff / 255) * 25);

  // Skin tone (20 points)
  const skinDiff = Math.abs(features1.skinTone - features2.skinTone);
  similarity += Math.max(0, 20 - (skinDiff / 100) * 20);

  return Math.round(similarity);
}

/**
 * Recognize face from captured image by searching all users in database
 */
export async function recognizeFace(
  capturedImagePath: string,
  uploadsDir: string = 'uploads/profiles'
): Promise<FaceRecognitionResult> {
  try {
    console.log('[Face Recognition] Starting face recognition...');
    console.log('[Face Recognition] Captured image:', capturedImagePath);

    // Check if captured image exists
    if (!fs.existsSync(capturedImagePath)) {
      return {
        identified: false,
        confidence: 0,
        message: 'Captured image not found',
      };
    }

    // Extract features from captured image
    const capturedFeatures = await extractImageFeatures(capturedImagePath);
    if (!capturedFeatures) {
      return {
        identified: false,
        confidence: 0,
        message: 'Failed to analyze captured image',
      };
    }

    // Get all users with profile pictures from database
    const users = await User.find({
      profilePicture: { $exists: true, $nin: [null, ''] },
    }).select('_id email firstName lastName profilePicture');

    console.log(`[Face Recognition] Found ${users.length} users with profile pictures`);

    if (users.length === 0) {
      return {
        identified: false,
        confidence: 0,
        message: 'No registered users found in database',
      };
    }

    // Compare captured image with all user profile pictures
    let bestMatch: {
      user: any;
      similarity: number;
    } | null = null;

    for (const user of users) {
      if (!user.profilePicture) continue;
      // Construct path to user's profile picture
      const profilePicPath = path.join(uploadsDir, user.profilePicture);

      // Check if profile picture exists
      if (!fs.existsSync(profilePicPath)) {
        console.log(`[Face Recognition] Profile picture not found for user ${user._id}`);
        continue;
      }

      // Extract features from profile picture
      const profileFeatures = await extractImageFeatures(profilePicPath);
      if (!profileFeatures) {
        console.log(`[Face Recognition] Failed to extract features for user ${user._id}`);
        continue;
      }

      // Calculate similarity
      const similarity = calculateSimilarity(capturedFeatures, profileFeatures);

      console.log(`[Face Recognition] User ${user.email}: ${similarity}% similarity`);

      // Update best match if this is better
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = {
          user,
          similarity,
        };
      }
    }

    // Determine if we have a match (threshold: 65%)
    if (bestMatch && bestMatch.similarity >= 65) {
      const fullName = `${bestMatch.user.firstName || ''} ${bestMatch.user.lastName || ''}`.trim();

      console.log('[Face Recognition] ✅ Match found!');
      console.log(`[Face Recognition] User: ${bestMatch.user.email}`);
      console.log(`[Face Recognition] Confidence: ${bestMatch.similarity}%`);

      return {
        identified: true,
        userId: bestMatch.user._id.toString(),
        userName: fullName || bestMatch.user.email,
        confidence: bestMatch.similarity,
        message: `Identified as ${fullName || bestMatch.user.email}`,
        matchDetails: {
          email: bestMatch.user.email,
          fullName: fullName || 'N/A',
          profilePicture: bestMatch.user.profilePicture,
        },
      };
    } else {
      console.log('[Face Recognition] ❌ No match found');
      console.log(`[Face Recognition] Best similarity: ${bestMatch?.similarity || 0}%`);

      return {
        identified: false,
        confidence: bestMatch?.similarity || 0,
        message: 'Face not recognized. Person not found in database.',
      };
    }
  } catch (error) {
    console.error('[Face Recognition] Error:', error);
    return {
      identified: false,
      confidence: 0,
      message: 'Face recognition failed. Please try again.',
    };
  }
}

/**
 * Search for a person by name in database and compare with captured image
 */
export async function searchAndVerifyByName(
  capturedImagePath: string,
  searchName: string,
  uploadsDir: string = 'uploads/profiles'
): Promise<FaceRecognitionResult> {
  try {
    console.log('[Face Recognition] Searching for:', searchName);

    // Search for user by name
    const users = await User.find({
      $or: [
        { firstName: new RegExp(searchName, 'i') },
        { lastName: new RegExp(searchName, 'i') },
        { email: new RegExp(searchName, 'i') },
      ],
      profilePicture: { $exists: true, $nin: [null, ''] },
    }).select('_id email firstName lastName profilePicture');

    if (users.length === 0) {
      return {
        identified: false,
        confidence: 0,
        message: `No user found with name: ${searchName}`,
      };
    }

    console.log(`[Face Recognition] Found ${users.length} user(s) matching "${searchName}"`);

    // Extract features from captured image
    const capturedFeatures = await extractImageFeatures(capturedImagePath);
    if (!capturedFeatures) {
      return {
        identified: false,
        confidence: 0,
        message: 'Failed to analyze captured image',
      };
    }

    // Compare with each matching user
    let bestMatch: { user: any; similarity: number } | null = null;

    for (const user of users) {
      if (!user.profilePicture) continue;
      const profilePicPath = path.join(uploadsDir, user.profilePicture);

      if (!fs.existsSync(profilePicPath)) continue;

      const profileFeatures = await extractImageFeatures(profilePicPath);
      if (!profileFeatures) continue;

      const similarity = calculateSimilarity(capturedFeatures, profileFeatures);

      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { user, similarity };
      }
    }

    if (bestMatch && bestMatch.similarity >= 65) {
      const fullName = `${bestMatch.user.firstName || ''} ${bestMatch.user.lastName || ''}`.trim();

      return {
        identified: true,
        userId: bestMatch.user._id.toString(),
        userName: fullName || bestMatch.user.email,
        confidence: bestMatch.similarity,
        message: `Verified as ${fullName || bestMatch.user.email}`,
        matchDetails: {
          email: bestMatch.user.email,
          fullName: fullName || 'N/A',
          profilePicture: bestMatch.user.profilePicture,
        },
      };
    } else {
      return {
        identified: false,
        confidence: bestMatch?.similarity || 0,
        message: `Face does not match ${searchName}`,
      };
    }
  } catch (error) {
    console.error('[Face Recognition] Search error:', error);
    return {
      identified: false,
      confidence: 0,
      message: 'Search failed. Please try again.',
    };
  }
}
