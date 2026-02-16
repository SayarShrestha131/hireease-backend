/**
 * OCR Service
 * Extracts text from license images using Tesseract.js
 */

import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';

export interface ExtractedLicenseData {
  licenseNumber?: string;
  fullName?: string;
  dateOfBirth?: string;
  expiryDate?: string;
  address?: string;
  rawText: string;
  confidence: number;
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
  
  // Calculate confidence based on fields found
  const fieldsFound = [
    data.licenseNumber,
    data.fullName,
    data.dateOfBirth,
    data.expiryDate
  ].filter(Boolean).length;
  
  data.confidence = (fieldsFound / 4) * 100;
  
  console.log('[OCR] ✅ Parsed data:', {
    licenseNumber: data.licenseNumber || 'Not found',
    fullName: data.fullName || 'Not found',
    dateOfBirth: data.dateOfBirth || 'Not found',
    expiryDate: data.expiryDate || 'Not found',
    confidence: `${data.confidence}%`
  });
  
  return data;
}

/**
 * Process license image and extract structured data
 */
export async function processLicenseImage(imagePath: string): Promise<ExtractedLicenseData> {
  try {
    // Extract text using OCR
    const rawText = await extractTextFromImage(imagePath);
    
    // Parse and structure the data
    const licenseData = parseLicenseData(rawText);
    
    return licenseData;
  } catch (error) {
    console.error('[OCR] License processing error:', error);
    throw error;
  }
}
