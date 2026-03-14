/**
 * OCR Service
 * Extracts text from license images using Tesseract.js
 */

import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export interface ExtractedLicenseData {
  licenseNumber?: string;
  fullName?: string;
  fatherName?: string;
  dateOfBirth?: string;
  expiryDate?: string;
  issueDate?: string;
  issuingAuthority?: string;
  address?: string;
  citizenshipNumber?: string;
  licenseType?: string;
  rawText: string;
  confidence: number;
}

export interface QualityCheckResult {
  isGoodQuality: boolean;
  issues: string[];
  recommendation?: string;
}

/**
 * Check image quality before OCR processing
 */
async function checkImageQuality(imagePath: string): Promise<QualityCheckResult> {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    const stats = await image.stats();
    
    const issues: string[] = [];
    
    // Check 1: Resolution
    if (metadata.width && metadata.height) {
      if (metadata.width < 800 || metadata.height < 600) {
        issues.push('Image resolution is too low. Minimum 800x600 required.');
      }
    } else {
      issues.push('Unable to determine image dimensions.');
    }
    
    // Check 2: Brightness
    if (stats.channels && stats.channels.length >= 3) {
      const avgBrightness = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3;
      if (avgBrightness < 50) {
        issues.push('Image is too dark. Please take photo in better lighting.');
      } else if (avgBrightness > 220) {
        issues.push('Image is too bright. Avoid direct flash or sunlight.');
      }
    }
    
    // Check 3: Sharpness (using standard deviation as proxy)
    if (stats.channels && stats.channels.length >= 3) {
      const avgStdDev = (stats.channels[0].stdev + stats.channels[1].stdev + stats.channels[2].stdev) / 3;
      if (avgStdDev < 15) {
        issues.push('Image appears blurry. Please hold camera steady and focus properly.');
      }
    }
    
    // Check 4: File size (too small might indicate compression issues)
    const fileStats = await fs.promises.stat(imagePath);
    if (fileStats.size < 50000) { // Less than 50KB
      issues.push('Image file size is too small. This may indicate poor quality.');
    }
    
    const isGoodQuality = issues.length === 0;
    
    let recommendation;
    if (!isGoodQuality) {
      recommendation = 'Please retake the photo: ' + issues.join(' ');
    }
    
    return {
      isGoodQuality,
      issues,
      recommendation,
    };
  } catch (error) {
    console.error('[OCR] Quality check error:', error);
    return {
      isGoodQuality: false,
      issues: ['Failed to check image quality'],
      recommendation: 'Please try uploading the image again.',
    };
  }
}

/**
 * Preprocess image for better OCR results
 */
async function preprocessImage(imagePath: string): Promise<Buffer> {
  try {
    // Enhance image for better OCR
    const processedImage = await sharp(imagePath)
      .resize(2000, null, { // Resize to optimal width
        withoutEnlargement: true,
        fit: 'inside'
      })
      .greyscale() // Convert to grayscale
      .normalize() // Normalize contrast
      .sharpen() // Sharpen edges
      .toBuffer();
    
    return processedImage;
  } catch (error) {
    console.error('[OCR] Image preprocessing error:', error);
    throw new Error('Failed to preprocess image');
  }
}

/**
 * Extract text from image using OCR
 */
export async function extractTextFromImage(imagePath: string): Promise<string> {
  try {
    console.log('[OCR] Processing image:', imagePath);
    
    // Preprocess image
    const processedImage = await preprocessImage(imagePath);
    
    // Perform OCR
    const result = await Tesseract.recognize(
      processedImage,
      'eng', // English language
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );
    
    console.log('[OCR] ✅ Text extraction complete');
    console.log('[OCR] Confidence:', result.data.confidence);
    
    return result.data.text;
  } catch (error) {
    console.error('[OCR] Text extraction error:', error);
    throw new Error('Failed to extract text from image');
  }
}

/**
 * Parse extracted text to identify license fields
 */
export function parseLicenseData(rawText: string): ExtractedLicenseData {
  console.log('[OCR] Parsing license data...');
  
  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const data: ExtractedLicenseData = {
    rawText,
    confidence: 0
  };
  
  // Patterns for different fields
  const patterns = {
    // License number patterns (various formats)
    licenseNumber: [
      /(?:license|lic|dl|driving)\s*(?:no|number|#)?\s*:?\s*([A-Z0-9\-\/]+)/i,
      /\b([A-Z]{2}[0-9]{2}\s?[0-9]{11})\b/, // Indian DL format
      /\b([A-Z0-9]{8,15})\b/ // Generic alphanumeric
    ],
    
    // Date patterns
    date: [
      /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
      /(\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2})/,
      /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/i
    ],
    
    // Name patterns
    name: [
      /(?:name|holder)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})$/
    ],
    
    // DOB patterns
    dob: [
      /(?:dob|birth|born)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(?:date\s+of\s+birth)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i
    ],
    
    // Expiry patterns
    expiry: [
      /(?:exp|expiry|valid\s+till|valid\s+until)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
      /(?:valid\s+till)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i
    ],
    
    // Father's name patterns
    fatherName: [
      /(?:father|father's\s+name|s\/o|son\s+of|d\/o|daughter\s+of)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
      /(?:guardian)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i
    ],
    
    // Issuing authority patterns
    issuingAuthority: [
      /(?:issued\s+by|authority|office)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i,
      /(?:transport\s+office|dto|rto)\s*:?\s*([A-Z0-9\s]+)/i
    ],
    
    // Citizenship number patterns
    citizenshipNumber: [
      /(?:citizenship|citizen|national\s+id)\s*(?:no|number|#)?\s*:?\s*([A-Z0-9\-\/]+)/i,
      /\b([0-9]{10,15})\b/ // Generic number pattern
    ],
    
    // License type/category patterns
    licenseType: [
      /(?:type|category|class)\s*:?\s*([A-Z][+]?[A-Z]?)/i,
      /\b(A\+B|A|B|C|D|E)\b/ // Common license categories
    ],
    
    // Issue date patterns
    issueDate: [
      /(?:issue|issued|from)\s*(?:date)?\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i
    ]
  };
  
  // Extract license number
  for (const pattern of patterns.licenseNumber) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1]) {
        data.licenseNumber = match[1].replace(/\s+/g, '');
        break;
      }
    }
    if (data.licenseNumber) break;
  }
  
  // Extract DOB
  for (const pattern of patterns.dob) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1]) {
        data.dateOfBirth = match[1];
        break;
      }
    }
    if (data.dateOfBirth) break;
  }
  
  // Extract expiry date
  for (const pattern of patterns.expiry) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1]) {
        data.expiryDate = match[1];
        break;
      }
    }
    if (data.expiryDate) break;
  }
  
  // Extract name (look for capitalized words)
  for (const pattern of patterns.name) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1] && match[1].length > 5) {
        // Avoid matching license numbers or dates
        if (!/\d{4}/.test(match[1]) && !/[0-9]{2,}/.test(match[1])) {
          data.fullName = match[1];
          break;
        }
      }
    }
    if (data.fullName) break;
  }
  
  // Extract father's name
  for (const pattern of patterns.fatherName) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1] && match[1].length > 5) {
        // Avoid matching the same as fullName
        if (match[1] !== data.fullName && !/\d{4}/.test(match[1])) {
          data.fatherName = match[1];
          break;
        }
      }
    }
    if (data.fatherName) break;
  }
  
  // Extract issuing authority
  for (const pattern of patterns.issuingAuthority) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1]) {
        data.issuingAuthority = match[1].trim();
        break;
      }
    }
    if (data.issuingAuthority) break;
  }
  
  // Extract citizenship number
  for (const pattern of patterns.citizenshipNumber) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1] && match[1] !== data.licenseNumber) {
        data.citizenshipNumber = match[1].replace(/\s+/g, '');
        break;
      }
    }
    if (data.citizenshipNumber) break;
  }
  
  // Extract license type
  for (const pattern of patterns.licenseType) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1]) {
        data.licenseType = match[1].toUpperCase();
        break;
      }
    }
    if (data.licenseType) break;
  }
  
  // Extract issue date
  for (const pattern of patterns.issueDate) {
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1]) {
        data.issueDate = match[1];
        break;
      }
    }
    if (data.issueDate) break;
  }
  
  // Calculate confidence based on fields found
  const fieldsFound = [
    data.licenseNumber,
    data.fullName,
    data.dateOfBirth,
    data.expiryDate,
    data.fatherName,
    data.issuingAuthority,
    data.licenseType
  ].filter(Boolean).length;
  
  data.confidence = Math.round((fieldsFound / 7) * 100);
  
  console.log('[OCR] ✅ Parsed data:', {
    licenseNumber: data.licenseNumber || 'Not found',
    fullName: data.fullName || 'Not found',
    fatherName: data.fatherName || 'Not found',
    dateOfBirth: data.dateOfBirth || 'Not found',
    expiryDate: data.expiryDate || 'Not found',
    issueDate: data.issueDate || 'Not found',
    issuingAuthority: data.issuingAuthority || 'Not found',
    licenseType: data.licenseType || 'Not found',
    citizenshipNumber: data.citizenshipNumber || 'Not found',
    confidence: `${data.confidence}%`
  });
  
  return data;
}

/**
 * Process license image and extract structured data with quality check
 */
export async function processLicenseImage(imagePath: string): Promise<{
  data: ExtractedLicenseData;
  qualityCheck: QualityCheckResult;
}> {
  try {
    // First, check image quality
    const qualityCheck = await checkImageQuality(imagePath);
    
    // Extract text using OCR
    const rawText = await extractTextFromImage(imagePath);
    
    // Parse and structure the data
    const licenseData = parseLicenseData(rawText);
    
    return {
      data: licenseData,
      qualityCheck,
    };
  } catch (error) {
    console.error('[OCR] License processing error:', error);
    throw error;
  }
}
