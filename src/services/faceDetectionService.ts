/**
 * Face Detection Service
 * Simple face detection using image analysis
 * Checks if image contains face-like features
 */

import sharp from 'sharp';

export interface FaceDetectionResult {
  hasFace: boolean;
  faceCount?: number;
  confidence: number;
  message: string;
}

/**
 * Detect if image contains a human face
 * Uses simple heuristics: skin tone detection, face proportions, etc.
 */
export async function detectFace(imagePath: string): Promise<FaceDetectionResult> {
  try {
    console.log('[Face Detection] Analyzing image:', imagePath);
    
    // Get image metadata and stats
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const stats = await image.stats();
    
    // Basic checks
    const checks = {
      hasValidDimensions: false,
      hasGoodAspectRatio: false,
      hasSkinTones: false,
      hasGoodBrightness: false
    };
    
    // Check 1: Valid dimensions (face photos are usually at least 200x200)
    if (metadata.width && metadata.height) {
      checks.hasValidDimensions = metadata.width >= 200 && metadata.height >= 200;
    }
    
    // Check 2: Aspect ratio (faces are usually portrait or square, not too wide)
    if (metadata.width && metadata.height) {
      const aspectRatio = metadata.width / metadata.height;
      checks.hasGoodAspectRatio = aspectRatio >= 0.5 && aspectRatio <= 2.0;
    }
    
    // Check 3: Skin tone detection (check for presence of skin-like colors)
    // Skin tones typically have RGB values in certain ranges
    const channels = stats.channels;
    if (channels && channels.length >= 3) {
      const r = channels[0].mean;
      const g = channels[1].mean;
      const b = channels[2].mean;
      
      // Skin tone heuristic: R > G > B, and values in reasonable range
      const hasSkinLikeColors = r > g && g > b && r > 100 && r < 255 && g > 50 && b > 30;
      checks.hasSkinTones = hasSkinLikeColors;
    }
    
    // Check 4: Brightness (not too dark, not too bright)
    if (channels && channels.length >= 3) {
      const avgBrightness = (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
      checks.hasGoodBrightness = avgBrightness > 50 && avgBrightness < 220;
    }
    
    // Calculate confidence based on checks passed
    const checksArray = Object.values(checks);
    const passedChecks = checksArray.filter(Boolean).length;
    const confidence = (passedChecks / checksArray.length) * 100;
    
    // Determine if face is detected (at least 3 out of 4 checks should pass)
    const hasFace = passedChecks >= 3;
    
    const result: FaceDetectionResult = {
      hasFace,
      confidence,
      message: hasFace 
        ? 'Face detected successfully' 
        : 'No clear face detected. Please ensure the image shows a clear frontal face with good lighting.'
    };
    
    console.log('[Face Detection] ✅ Analysis complete:', {
      hasFace: result.hasFace,
      confidence: `${result.confidence.toFixed(1)}%`,
      checks: {
        dimensions: checks.hasValidDimensions ? '✓' : '✗',
        aspectRatio: checks.hasGoodAspectRatio ? '✓' : '✗',
        skinTones: checks.hasSkinTones ? '✓' : '✗',
        brightness: checks.hasGoodBrightness ? '✓' : '✗'
      }
    });
    
    return result;
  } catch (error) {
    console.error('[Face Detection] Error:', error);
    throw new Error('Failed to analyze image for face detection');
  }
}

/**
 * Validate selfie image
 * Ensures the selfie meets basic requirements
 */
export async function validateSelfie(imagePath: string): Promise<{
  isValid: boolean;
  message: string;
  faceDetection?: FaceDetectionResult;
}> {
  try {
    // Check if image exists and is readable
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // Basic validation
    if (!metadata.width || !metadata.height) {
      return {
        isValid: false,
        message: 'Invalid image file'
      };
    }
    
    // Check minimum dimensions
    if (metadata.width < 200 || metadata.height < 200) {
      return {
        isValid: false,
        message: 'Image resolution too low. Please use a higher quality image.'
      };
    }
    
    // Detect face
    const faceDetection = await detectFace(imagePath);
    
    return {
      isValid: faceDetection.hasFace && faceDetection.confidence >= 50,
      message: faceDetection.message,
      faceDetection
    };
  } catch (error) {
    console.error('[Face Detection] Validation error:', error);
    return {
      isValid: false,
      message: 'Failed to validate selfie image'
    };
  }
}
