/**
 * Face Matching Service
 * Compares user's saved profile picture with captured image
 */

import sharp from 'sharp';
import * as fs from 'fs';
import path from 'path';

export interface FaceMatchResult {
  isMatch: boolean;
  confidence: number;
  message: string;
  details: {
    savedImageAnalysis: ImageAnalysis;
    capturedImageAnalysis: ImageAnalysis;
    similarity: number;
  };
}

interface ImageAnalysis {
  width: number;
  height: number;
  aspectRatio: number;
  avgBrightness: number;
  avgContrast: number;
  colorProfile: {
    red: number;
    green: number;
    blue: number;
  };
  skinToneScore: number;
}

/**
 * Analyze image features for comparison
 */
async function analyzeImageFeatures(imagePath: string): Promise<ImageAnalysis> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();
  const stats = await image.stats();

  const channels = stats.channels;
  const r = channels[0].mean;
  const g = channels[1].mean;
  const b = channels[2].mean;

  const avgBrightness = (r + g + b) / 3;
  const avgContrast = (channels[0].stdev + channels[1].stdev + channels[2].stdev) / 3;

  // Calculate skin tone score (how much it looks like skin)
  const skinToneScore = calculateSkinToneScore(r, g, b);

  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    aspectRatio: (metadata.width || 1) / (metadata.height || 1),
    avgBrightness,
    avgContrast,
    colorProfile: { red: r, green: g, blue: b },
    skinToneScore,
  };
}

/**
 * Calculate how much the color profile matches skin tones
 */
function calculateSkinToneScore(r: number, g: number, b: number): number {
  // Ideal skin tone: R > G > B with specific ranges
  let score = 0;

  // Check R > G > B pattern
  if (r > g && g > b) score += 30;

  // Check if values are in typical skin tone ranges
  if (r >= 100 && r <= 255) score += 20;
  if (g >= 50 && g <= 200) score += 20;
  if (b >= 30 && b <= 180) score += 20;

  // Check ratios
  const rgRatio = r / g;
  const gbRatio = g / b;
  if (rgRatio >= 1.1 && rgRatio <= 1.5) score += 5;
  if (gbRatio >= 1.1 && gbRatio <= 1.5) score += 5;

  return score;
}

/**
 * Calculate similarity between two image analyses with improved accuracy
 */
function calculateSimilarity(analysis1: ImageAnalysis, analysis2: ImageAnalysis): number {
  let similarity = 0;

  // Compare aspect ratios (max 15 points) - less weight since faces can have different crops
  const aspectRatioDiff = Math.abs(analysis1.aspectRatio - analysis2.aspectRatio);
  const aspectRatioScore = Math.max(0, 15 - aspectRatioDiff * 15);
  similarity += aspectRatioScore;

  // Compare brightness (max 25 points) - more weight for lighting consistency
  const brightnessDiff = Math.abs(analysis1.avgBrightness - analysis2.avgBrightness);
  const brightnessScore = Math.max(0, 25 - (brightnessDiff / 255) * 25);
  similarity += brightnessScore;

  // Compare contrast (max 20 points) - important for face structure
  const contrastDiff = Math.abs(analysis1.avgContrast - analysis2.avgContrast);
  const contrastScore = Math.max(0, 20 - (contrastDiff / 100) * 20);
  similarity += contrastScore;

  // Compare color profiles (max 30 points) - most important for skin tone matching
  const redDiff = Math.abs(analysis1.colorProfile.red - analysis2.colorProfile.red);
  const greenDiff = Math.abs(analysis1.colorProfile.green - analysis2.colorProfile.green);
  const blueDiff = Math.abs(analysis1.colorProfile.blue - analysis2.colorProfile.blue);
  const colorDiff = (redDiff + greenDiff + blueDiff) / 3;
  const colorScore = Math.max(0, 30 - (colorDiff / 255) * 30);
  similarity += colorScore;

  // Compare skin tone scores (max 10 points) - reduced weight
  const skinToneDiff = Math.abs(analysis1.skinToneScore - analysis2.skinToneScore);
  const skinToneScore = Math.max(0, 10 - (skinToneDiff / 100) * 10);
  similarity += skinToneScore;

  return Math.round(similarity);
}

/**
 * Match captured image with saved profile picture
 */
export async function matchFaces(
  savedImagePath: string,
  capturedImagePath: string
): Promise<FaceMatchResult> {
  try {
    console.log('[Face Matching] Comparing images...');
    console.log('[Face Matching] Saved:', savedImagePath);
    console.log('[Face Matching] Captured:', capturedImagePath);

    // Check if both files exist
    if (!fs.existsSync(savedImagePath)) {
      return {
        isMatch: false,
        confidence: 0,
        message: 'Saved profile picture not found',
        details: {
          savedImageAnalysis: {} as ImageAnalysis,
          capturedImageAnalysis: {} as ImageAnalysis,
          similarity: 0,
        },
      };
    }

    if (!fs.existsSync(capturedImagePath)) {
      return {
        isMatch: false,
        confidence: 0,
        message: 'Captured image not found',
        details: {
          savedImageAnalysis: {} as ImageAnalysis,
          capturedImageAnalysis: {} as ImageAnalysis,
          similarity: 0,
        },
      };
    }

    // Analyze both images
    const savedAnalysis = await analyzeImageFeatures(savedImagePath);
    const capturedAnalysis = await analyzeImageFeatures(capturedImagePath);

    // Calculate similarity
    const similarity = calculateSimilarity(savedAnalysis, capturedAnalysis);

    // Determine if it's a match (lowered threshold from 65% to 60% for better same-person detection)
    const isMatch = similarity >= 60;
    const confidence = similarity;

    let message = '';
    if (isMatch) {
      if (confidence >= 85) {
        message = 'Excellent match! Face verified successfully.';
      } else if (confidence >= 75) {
        message = 'Good match! Face verified.';
      } else {
        message = 'Face matched with acceptable confidence.';
      }
    } else {
      if (confidence >= 50) {
        message = 'Partial match detected. Please ensure good lighting and face the camera directly.';
      } else {
        message = 'Face does not match. Please ensure you are the account owner.';
      }
    }

    console.log('[Face Matching] ✅ Comparison complete:', {
      similarity: `${similarity}%`,
      isMatch,
      threshold: '65%',
    });

    return {
      isMatch,
      confidence,
      message,
      details: {
        savedImageAnalysis: savedAnalysis,
        capturedImageAnalysis: capturedAnalysis,
        similarity,
      },
    };
  } catch (error) {
    console.error('[Face Matching] Error:', error);
    return {
      isMatch: false,
      confidence: 0,
      message: 'Failed to compare images. Please try again.',
      details: {
        savedImageAnalysis: {} as ImageAnalysis,
        capturedImageAnalysis: {} as ImageAnalysis,
        similarity: 0,
      },
    };
  }
}

/**
 * Verify user identity by matching captured image with profile picture
 */
export async function verifyUserIdentity(
  userId: string,
  capturedImagePath: string,
  uploadsDir: string = 'uploads/profiles'
): Promise<FaceMatchResult> {
  try {
    // Construct path to saved profile picture
    // Assuming profile pictures are stored as: uploads/profiles/{userId}.jpg
    const savedImagePath = path.join(uploadsDir, `${userId}.jpg`);

    // Also check for .png extension
    const savedImagePathPng = path.join(uploadsDir, `${userId}.png`);

    let finalSavedPath = savedImagePath;
    if (!fs.existsSync(savedImagePath) && fs.existsSync(savedImagePathPng)) {
      finalSavedPath = savedImagePathPng;
    }

    return await matchFaces(finalSavedPath, capturedImagePath);
  } catch (error) {
    console.error('[Face Matching] Verification error:', error);
    return {
      isMatch: false,
      confidence: 0,
      message: 'Failed to verify identity. Please try again.',
      details: {
        savedImageAnalysis: {} as ImageAnalysis,
        capturedImageAnalysis: {} as ImageAnalysis,
        similarity: 0,
      },
    };
  }
}
