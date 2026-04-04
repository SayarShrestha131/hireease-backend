/**
 * Person Recognition Service
 * Matches captured photo with registered person's photo and details
 */

import sharp from 'sharp';
import * as fs from 'fs';
import path from 'path';
import RegisteredPerson from '../models/RegisteredPerson';

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
    console.error('[Person Recognition] Feature extraction error:', error);
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
 * Verify person by license number and captured photo
 */
export async function verifyPersonByLicense(
  licenseNumber: string,
  capturedImagePath: string,
  registeredPhotosDir: string = 'uploads/registered-persons'
): Promise<{
  verified: boolean;
  confidence: number;
  message: string;
  personDetails?: any;
}> {
  try {
    console.log('[Person Recognition] Verifying license:', licenseNumber);

    // Find person in database by license number
    const person = await RegisteredPerson.findOne({
      licenseNumber: licenseNumber.toUpperCase(),
      isActive: true,
    });

    if (!person) {
      return {
        verified: false,
        confidence: 0,
        message: `License number ${licenseNumber} not found in database`,
      };
    }

    console.log('[Person Recognition] Found person:', person.fullName);

    // Get registered photo path
    const registeredPhotoPath = path.join(registeredPhotosDir, person.photoPath);

    if (!fs.existsSync(registeredPhotoPath)) {
      return {
        verified: false,
        confidence: 0,
        message: 'Registered photo not found',
      };
    }

    // Extract features from both images
    const capturedFeatures = await extractImageFeatures(capturedImagePath);
    const registeredFeatures = await extractImageFeatures(registeredPhotoPath);

    if (!capturedFeatures || !registeredFeatures) {
      return {
        verified: false,
        confidence: 0,
        message: 'Failed to analyze images',
      };
    }

    // Calculate similarity
    const similarity = calculateSimilarity(capturedFeatures, registeredFeatures);

    console.log('[Person Recognition] Similarity:', similarity + '%');

    // Verify (threshold: 80% - STRICTER to reduce false positives)
    if (similarity >= 80) {
      // Update verification stats
      person.lastVerifiedAt = new Date();
      person.verificationCount += 1;
      await person.save();

      return {
        verified: true,
        confidence: similarity,
        message: `Verified as ${person.fullName}`,
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
        confidence: similarity,
        message: `Face does not match registered photo for ${person.fullName}`,
        personDetails: {
          fullName: person.fullName,
          licenseNumber: person.licenseNumber,
        },
      };
    }
  } catch (error) {
    console.error('[Person Recognition] Error:', error);
    return {
      verified: false,
      confidence: 0,
      message: 'Verification failed',
    };
  }
}

/**
 * Search and verify person (search all registered persons)
 */
export async function searchAndVerifyPerson(
  capturedImagePath: string,
  registeredPhotosDir: string = 'uploads/registered-persons'
): Promise<{
  verified: boolean;
  confidence: number;
  message: string;
  personDetails?: any;
}> {
  try {
    console.log('[Person Recognition] Searching all registered persons...');

    // Get all active registered persons
    const persons = await RegisteredPerson.find({ isActive: true });

    if (persons.length === 0) {
      return {
        verified: false,
        confidence: 0,
        message: 'No registered persons in database',
      };
    }

    console.log(`[Person Recognition] Comparing with ${persons.length} registered persons`);

    // Extract features from captured image
    const capturedFeatures = await extractImageFeatures(capturedImagePath);
    if (!capturedFeatures) {
      return {
        verified: false,
        confidence: 0,
        message: 'Failed to analyze captured image',
      };
    }

    // Compare with all registered persons
    let bestMatch: { person: any; similarity: number } | null = null;

    for (const person of persons) {
      const registeredPhotoPath = path.join(registeredPhotosDir, person.photoPath);

      if (!fs.existsSync(registeredPhotoPath)) {
        console.log(`[Person Recognition] Photo not found for ${person.fullName}`);
        continue;
      }

      const registeredFeatures = await extractImageFeatures(registeredPhotoPath);
      if (!registeredFeatures) continue;

      const similarity = calculateSimilarity(capturedFeatures, registeredFeatures);

      console.log(`[Person Recognition] ${person.fullName}: ${similarity}%`);

      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { person, similarity };
      }
    }

    if (bestMatch && bestMatch.similarity >= 80) {
      // Update verification stats
      bestMatch.person.lastVerifiedAt = new Date();
      bestMatch.person.verificationCount += 1;
      await bestMatch.person.save();

      return {
        verified: true,
        confidence: bestMatch.similarity,
        message: `Identified as ${bestMatch.person.fullName}`,
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
      };
    }
  } catch (error) {
    console.error('[Person Recognition] Error:', error);
    return {
      verified: false,
      confidence: 0,
      message: 'Search failed',
    };
  }
}
