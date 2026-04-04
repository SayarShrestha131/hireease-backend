/**
 * OCR Service
 * Extracts text from license images using Tesseract.js
 * Enhanced for Nepal Driving License format
 */

import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export interface ExtractedLicenseData {
  licenseNumber?: string;
  fullName?: string;
  fatherName?: string; // F/H Name
  dateOfBirth?: string;
  expiryDate?: string;
  issueDate?: string;
  issuedBy?: string; // Government of Nepal
  licenseOffice?: string; // Issuing office
  fullAddress?: string;
  citizenshipNumber?: string;
  licenseType?: string;
  contactNumber?: string;
  rawText: string;
  confidence: number;
  fieldConfidence: {
    licenseNumber?: number;
    fullName?: number;
    fatherName?: number;
    dateOfBirth?: number;
    expiryDate?: number;
    issueDate?: number;
    issuedBy?: number;
    licenseOffice?: number;
    address?: number;
    citizenshipNumber?: number;
    licenseType?: number;
    contactNumber?: number;
    bloodGroup?: number;
  };
}

export interface QualityCheckResult {
  isGoodQuality: boolean;
  issues: string[];
  recommendation?: string;
  guidance?: string[];
}

function normalizeExtractedDate(value: string): string {
  const compact = value.trim().replace(/\s+/g, '/').replace(/-/g, '/');
  const parts = compact.split('/');
  if (parts.length !== 3) return compact;

  const [day, month, year] = parts;
  const normalizedYear = year.length === 2 ? `20${year}` : year;
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${normalizedYear}`;
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
        issues.push('Image resolution is too low. Minimum 800x600 required for clear text recognition.');
      }
    } else {
      issues.push('Unable to determine image dimensions. Please ensure the image file is valid.');
    }
    
    // Check 2: Brightness
    if (stats.channels && stats.channels.length >= 3) {
      const avgBrightness = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3;
      if (avgBrightness < 50) {
        issues.push('Image is too dark. Please take photo in better lighting or increase brightness.');
      } else if (avgBrightness > 220) {
        issues.push('Image is too bright. Avoid direct flash or sunlight - use indirect lighting.');
      }
    }
    
    // Check 3: Sharpness (using standard deviation as proxy)
    if (stats.channels && stats.channels.length >= 3) {
      const avgStdDev = (stats.channels[0].stdev + stats.channels[1].stdev + stats.channels[2].stdev) / 3;
      if (avgStdDev < 15) {
        issues.push('Image appears blurry. Please hold camera steady and focus properly on the license text.');
      }
    }
    
    // Check 4: File size (too small might indicate compression issues)
    const fileStats = await fs.promises.stat(imagePath);
    if (fileStats.size < 50000) { // Less than 50KB
      issues.push('Image file size is too small. This may indicate poor quality or excessive compression.');
    }
    
    const isGoodQuality = issues.length === 0;
    
    let recommendation;
    if (!isGoodQuality) {
      recommendation = 'To improve text recognition: ' + issues.map(issue => {
        if (issue.includes('resolution')) return 'Use a higher resolution camera or get closer to the license';
        if (issue.includes('dark')) return 'Take the photo in brighter lighting';
        if (issue.includes('bright')) return 'Avoid direct flash, use natural or indirect lighting';
        if (issue.includes('blurry')) return 'Hold the camera steady and tap to focus before taking the photo';
        if (issue.includes('file size')) return 'Use a higher quality camera setting';
        return 'Retake the photo with better conditions';
      }).join('. ');
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
      guidance: [
        'Ensure the image file is not corrupted',
        'Try taking a new photo of your license',
        'Use better lighting when photographing the license',
        'Make sure the license is flat and fully visible'
      ]
    };
  }
}

/**
 * Preprocess image for better OCR results
 * Enhanced for Nepal Driving License with multiple preprocessing strategies
 */
async function preprocessImage(imagePath: string): Promise<Buffer> {
  try {
    // Enhance image for better OCR with aggressive preprocessing
    const processedImage = await sharp(imagePath)
      .resize(3000, null, { // Larger resize for better text recognition
        withoutEnlargement: true,
        fit: 'inside'
      })
      .greyscale() // Convert to grayscale
      .normalize() // Normalize contrast
      .linear(1.5, -(128 * 1.5) + 128) // Increase contrast significantly
      .sharpen({ sigma: 2 }) // Stronger sharpening
      .threshold(128) // Binary threshold to remove noise
      .toBuffer();
    
    return processedImage;
  } catch (error) {
    console.error('[OCR] Image preprocessing error:', error);
    throw new Error('Failed to preprocess image');
  }
}

/**
 * Alternative preprocessing for difficult images
 */
async function preprocessImageAggressive(imagePath: string): Promise<Buffer> {
  try {
    // Very aggressive preprocessing for poor quality images
    const processedImage = await sharp(imagePath)
      .resize(3500, null, {
        withoutEnlargement: true,
        fit: 'inside',
        kernel: sharp.kernel.lanczos3 // Better quality resize
      })
      .greyscale()
      .normalize()
      .linear(2.0, -(128 * 2.0) + 128) // Very high contrast
      .sharpen({ sigma: 3, m1: 2, m2: 3 }) // Very strong sharpening
      .median(3) // Noise reduction
      .threshold(140) // Higher threshold for cleaner text
      .toBuffer();
    
    return processedImage;
  } catch (error) {
    console.error('[OCR] Aggressive preprocessing error:', error);
    throw new Error('Failed to preprocess image aggressively');
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
 * Enhanced for Nepal Driving License with field-level confidence
 */
export function parseLicenseData(rawText: string, ocrConfidence?: number): ExtractedLicenseData {
  console.log('[OCR] Parsing license data...');

  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const fullText = rawText;

  const data: ExtractedLicenseData = {
    rawText,
    confidence: 0,
    fieldConfidence: {}
  };

  // Helper function to extract with confidence based on pattern strength and context
  const extractWithConfidence = <T>(
    patterns: Array<{ regex: RegExp; strength: number; context?: string }>,
    extractor: (match: RegExpMatchArray) => T,
    validator?: (value: T) => boolean
  ): { value?: T; confidence: number } => {
    for (const { regex, strength, context } of patterns) {
      // Try matching in full text first
      let match = fullText.match(regex);
      
      // If no match and context provided, try line-by-line near context
      if (!match && context) {
        for (const line of lines) {
          if (line.toLowerCase().includes(context.toLowerCase())) {
            match = line.match(regex);
            if (match) break;
          }
        }
      }

      if (match && match[1]) {
        const value = extractor(match);
        const isValid = !validator || validator(value);
        
        if (isValid) {
          // Confidence = OCR confidence * pattern strength * validation bonus
          const baseConfidence = ocrConfidence || 70;
          const calculatedConfidence = Math.round(baseConfidence * strength * (isValid ? 1.1 : 0.8));
          return { value, confidence: Math.min(calculatedConfidence, 100) };
        }
      }
    }
    return { value: undefined, confidence: 0 };
  };

  // License Number patterns (Nepal format: D.L.No with various separators)
  const licenseNumberResult = extractWithConfidence(
    [
      { regex: /D\.?\s*L\.?\s*No\.?\s*:?\s*([0-9]{2}[-\s]?[0-9]{2}[-\s]?[0-9]{8})/i, strength: 0.98, context: 'D.L.No' },
      { regex: /D\.?\s*L\.?\s*No\.?\s*:?\s*([A-Z0-9\-\/\s]+)/i, strength: 0.95, context: 'D.L.No' },
      { regex: /(?:license|lic no|dl no|driving license)\s*:?\s*([0-9]{2}[-\s]?[0-9]{2}[-\s]?[0-9]{8})/i, strength: 0.93, context: 'license' },
      { regex: /\b([0-9]{2}[-\s][0-9]{2}[-\s][0-9]{8})\b/, strength: 0.95 }, // 04-06-01018658 or 04 06 01018658
      { regex: /\b([0-9]{12,14})\b/, strength: 0.85 }, // 040601018658 (no separators)
      { regex: /(?:license|lic no|dl no|driving license)\s*:?\s*([A-Z0-9\-\/]+)/i, strength: 0.90, context: 'license' },
    ],
    (match) => {
      let cleaned = match[1].replace(/\s+/g, '').toUpperCase();
      // Add dashes if missing (format: 04-06-01018658)
      if (/^\d{12,14}$/.test(cleaned)) {
        cleaned = `${cleaned.slice(0,2)}-${cleaned.slice(2,4)}-${cleaned.slice(4)}`;
      }
      return cleaned;
    },
    (val) => val.length >= 10
  );
  data.licenseNumber = licenseNumberResult.value;
  data.fieldConfidence.licenseNumber = licenseNumberResult.confidence;

  // Full Name patterns (Nepal format: Name)
  const nameResult = extractWithConfidence(
    [
      { regex: /^Name\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})/im, strength: 0.98, context: 'Name' },
      { regex: /(?:name|holder name|full name)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/i, strength: 0.95, context: 'name' },
      { regex: /^(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})$/m, strength: 0.8 },
    ],
    (match) => match[1].trim(),
    (val) => val.length > 3 && val.length < 50 && !/\d/.test(val)
  );
  data.fullName = nameResult.value;
  data.fieldConfidence.fullName = nameResult.confidence;

  // Father's Name / F/H Name patterns (Nepal format: F/H Name)
  const fatherNameResult = extractWithConfidence(
    [
      { regex: /F\/H\s*Name\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,4})/i, strength: 0.98, context: 'F/H Name' },
      { regex: /(?:f\/h|father|father's|guardian|parent)\s*(?:name)?\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/i, strength: 0.95, context: 'father' },
      { regex: /(?:s\/o|son of|d\/o|daughter of)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/i, strength: 0.9, context: 'father' },
    ],
    (match) => match[1].trim(),
    (val) => val.length > 3 && val.length < 50 && !/\d/.test(val)
  );
  data.fatherName = fatherNameResult.value;
  data.fieldConfidence.fatherName = fatherNameResult.confidence;

  // Date of Birth patterns (Nepal format: D.O.B with flexible date formats)
  const dobResult = extractWithConfidence(
    [
      { regex: /D\.?\s*O\.?\s*B\.?\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, strength: 0.98, context: 'D.O.B' },
      { regex: /D\.?\s*O\.?\s*B\.?\s*:?\s*(\d{1,2}\s+\d{1,2}\s+\d{2,4})/i, strength: 0.95, context: 'D.O.B' },
      { regex: /(?:dob|date of birth|birth)\s*:?\s*(\d{1,2}[-\/\s]\d{1,2}[-\/\s]\d{2,4})/i, strength: 0.93, context: 'birth' },
      { regex: /(?:born)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, strength: 0.85 },
      { regex: /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\b/, strength: 0.80 }, // Generic date
    ],
    (match) => normalizeExtractedDate(match[1]),
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date < new Date();
    }
  );
  data.dateOfBirth = dobResult.value;
  data.fieldConfidence.dateOfBirth = dobResult.confidence;

  // Expiry Date patterns (Nepal format: D.O.E with flexible formats)
  const expiryResult = extractWithConfidence(
    [
      { regex: /D\.?\s*O\.?\s*E\.?\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, strength: 0.98, context: 'D.O.E' },
      { regex: /D\.?\s*O\.?\s*E\.?\s*:?\s*(\d{1,2}\s+\d{1,2}\s+\d{2,4})/i, strength: 0.95, context: 'D.O.E' },
      { regex: /(?:exp|expiry|valid till|valid until|expires)\s*:?\s*(\d{1,2}[-\/\s]\d{1,2}[-\/\s]\d{2,4})/i, strength: 0.93, context: 'expir' },
      { regex: /(?:validity)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, strength: 0.85 },
    ],
    (match) => normalizeExtractedDate(match[1]),
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    }
  );
  data.expiryDate = expiryResult.value;
  data.fieldConfidence.expiryDate = expiryResult.confidence;

  // Issue Date patterns (Nepal format: D.O.I with flexible formats)
  const issueResult = extractWithConfidence(
    [
      { regex: /D\.?\s*O\.?\s*I\.?\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, strength: 0.98, context: 'D.O.I' },
      { regex: /D\.?\s*O\.?\s*I\.?\s*:?\s*(\d{1,2}\s+\d{1,2}\s+\d{2,4})/i, strength: 0.95, context: 'D.O.I' },
      { regex: /(?:issue|issued|date of issue)\s*:?\s*(\d{1,2}[-\/\s]\d{1,2}[-\/\s]\d{2,4})/i, strength: 0.9, context: 'issue' },
      { regex: /(?:from)\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i, strength: 0.75 },
    ],
    (match) => normalizeExtractedDate(match[1]),
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date < new Date();
    }
  );
  data.issueDate = issueResult.value;
  data.fieldConfidence.issueDate = issueResult.confidence;

  // Issued By patterns (Government of Nepal)
  const issuedByResult = extractWithConfidence(
    [
      { regex: /Government\s+of\s+Nepal/i, strength: 0.98 },
      { regex: /(?:issued by|government of)\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i, strength: 0.95, context: 'government' },
      { regex: /(?:govt\.?|government)\s+(?:of\s+)?([A-Z][a-z]+)/i, strength: 0.9, context: 'govt' },
      { regex: /(nepal(?:\s+government)?|nepalese\s+government)/i, strength: 0.95 },
    ],
    (match) => match[0] || match[1] ? (match[0] || match[1]).trim() : 'Government of Nepal',
    (val) => val.length > 3
  );
  data.issuedBy = issuedByResult.value || 'Government of Nepal';
  data.fieldConfidence.issuedBy = issuedByResult.confidence;

  // License Office patterns (Nepal format: License Office)
  const officeResult = extractWithConfidence(
    [
      { regex: /License\s+Office\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i, strength: 0.98, context: 'License Office' },
      { regex: /(?:transport(?:\s+management)?|dto|rto)\s*(?:office)?\s*:?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i, strength: 0.95, context: 'transport' },
      { regex: /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:transport|traffic)\s+office/i, strength: 0.9 },
      { regex: /(?:issued from|from)\s*:?\s*([A-Z][a-z]+(?:\s+office)*)/i, strength: 0.8 },
    ],
    (match) => match[1].trim(),
    (val) => val.length > 3
  );
  data.licenseOffice = officeResult.value;
  data.fieldConfidence.licenseOffice = officeResult.confidence;

  // Address patterns (Nepal format: Address)
  const addressResult = extractWithConfidence(
    [
      { regex: /^Address\s*:?\s*([A-Z0-9][a-z0-9\s,\.\-]+)/im, strength: 0.98, context: 'Address' },
      { regex: /(?:address|permanent|present|residence)\s*:?\s*([A-Z][a-z0-9\s,\.\-]+)/i, strength: 0.85, context: 'address' },
      { regex: /(?:residing at|living at)\s*:?\s*([A-Z][a-z0-9\s,\.\-]+)/i, strength: 0.8 },
    ],
    (match) => match[1].trim(),
    (val) => val.length > 5
  );
  data.fullAddress = addressResult.value;
  data.fieldConfidence.address = addressResult.confidence;

  // Contact Number patterns (Nepal format: Contact No.)
  const contactResult = extractWithConfidence(
    [
      { regex: /Contact\s+No\.?\s*:?\s*([0-9\-\+\(\)\s]{10,15})/i, strength: 0.98, context: 'Contact No' },
      { regex: /(?:phone|mobile|contact|tel)\s*(?:no|number)?\s*:?\s*([0-9\-\+\(\)\s]{10,15})/i, strength: 0.9, context: 'contact' },
      { regex: /\b(9[78]\d{8})\b/, strength: 0.95 }, // Nepal mobile: 98XXXXXXXX
      { regex: /\b(\+?977[0-9]{10})\b/, strength: 0.9 },
      { regex: /\b([0-9]{10})\b/, strength: 0.75 },
    ],
    (match) => match[1].replace(/[\s\-\(\)]/g, ''),
    (val) => val.length >= 10 && val.length <= 15
  );
  data.contactNumber = contactResult.value;
  data.fieldConfidence.contactNumber = contactResult.confidence;

  // Citizenship Number patterns (Nepal format: Citizenship No.)
  const citizenshipResult = extractWithConfidence(
    [
      { regex: /Citizenship\s+No\.?\s*:?\s*([A-Z0-9\-\/\s]+)/i, strength: 0.98, context: 'Citizenship No' },
      { regex: /(?:citizenship|cit no|national id)\s*(?:no|number)?\s*:?\s*([A-Z0-9\-\/]+)/i, strength: 0.9, context: 'citizen' },
      { regex: /\b([0-9]{10,12})\b/, strength: 0.75 },
    ],
    (match) => match[1].replace(/\s+/g, ''),
    (val) => val.length >= 8 && val !== data.licenseNumber
  );
  data.citizenshipNumber = citizenshipResult.value;
  data.fieldConfidence.citizenshipNumber = citizenshipResult.confidence;

  // License Type/Category patterns (Nepal format: Category)
  const typeResult = extractWithConfidence(
    [
      { regex: /Category\s*:?\s*([A-Z](?:\s*\+\s*[A-Z])?)/i, strength: 0.98, context: 'Category' },
      { regex: /(?:type|category|class)\s*:?\s*([A-Z](?:\s*\+\s*[A-Z])?)/i, strength: 0.9, context: 'type' },
      { regex: /\b(A\+B|A\+C|B\+C|A|B|C|D|E)\b/, strength: 0.95 },
    ],
    (match) => match[1].replace(/\s+/g, '').toUpperCase(),
    (val) => /^[A-E](\+[A-E])?$/.test(val)
  );
  data.licenseType = typeResult.value;
  data.fieldConfidence.licenseType = typeResult.confidence;

  // Blood Group patterns (Nepal format: B.G.)
  const bloodGroupResult = extractWithConfidence(
    [
      { regex: /B\.?G\.?\s*:?\s*([ABO][+-]?|AB[+-]?)/i, strength: 0.95, context: 'B.G' },
      { regex: /Blood\s+Group\s*:?\s*([ABO][+-]?|AB[+-]?)/i, strength: 0.9, context: 'Blood' },
    ],
    (match) => match[1].toUpperCase(),
    (val) => /^(A|B|AB|O)[+-]?$/.test(val)
  );
  // Store blood group in a custom field if needed
  if (bloodGroupResult.value) {
    (data as any).bloodGroup = bloodGroupResult.value;
    data.fieldConfidence.bloodGroup = bloodGroupResult.confidence;
  }

  // Calculate overall confidence based on field-level confidence
  const criticalFields = ['licenseNumber', 'fullName', 'dateOfBirth', 'expiryDate'];
  const importantFields = ['fatherName', 'issuedBy', 'licenseOffice'];
  const optionalFields = ['address', 'contactNumber', 'citizenshipNumber', 'licenseType', 'issueDate'];

  let totalConfidence = 0;
  let fieldCount = 0;

  // Weight critical fields higher (60% of total)
  criticalFields.forEach(field => {
    const key = field as keyof typeof data.fieldConfidence;
    if (data.fieldConfidence[key]) {
      totalConfidence += data.fieldConfidence[key]! * 1.5;
      fieldCount += 1.5;
    }
  });

  // Important fields (30% of total)
  importantFields.forEach(field => {
    const key = field as keyof typeof data.fieldConfidence;
    if (data.fieldConfidence[key]) {
      totalConfidence += data.fieldConfidence[key]!;
      fieldCount += 1;
    }
  });

  // Optional fields (10% of total)
  optionalFields.forEach(field => {
    const key = field as keyof typeof data.fieldConfidence;
    if (data.fieldConfidence[key]) {
      totalConfidence += data.fieldConfidence[key]! * 0.5;
      fieldCount += 0.5;
    }
  });

  data.confidence = fieldCount > 0 ? Math.round(totalConfidence / fieldCount) : 0;

  // Ensure confidence is within 0-100 range
  data.confidence = Math.max(0, Math.min(100, data.confidence));

  console.log('[OCR] ✅ Parsed data with field confidence:', {
    licenseNumber: data.licenseNumber || 'Not found',
    fullName: data.fullName || 'Not found',
    fatherName: data.fatherName || 'Not found',
    dateOfBirth: data.dateOfBirth || 'Not found',
    expiryDate: data.expiryDate || 'Not found',
    issuedBy: data.issuedBy || 'Not found',
    licenseOffice: data.licenseOffice || 'Not found',
    overallConfidence: `${data.confidence}%`,
    fieldConfidence: data.fieldConfidence
  });

  return data;
}

/**
 * Process license image and extract structured data with quality check
 * Uses multiple OCR passes for better accuracy
 */
export async function processLicenseImage(imagePath: string): Promise<{
  data: ExtractedLicenseData;
  qualityCheck: QualityCheckResult;
}> {
  try {
    // First, check image quality
    const qualityCheck = await checkImageQuality(imagePath);

    console.log('[OCR] Starting multi-pass OCR processing...');
    
    // Pass 1: Standard preprocessing
    console.log('[OCR] Pass 1: Standard preprocessing');
    const processedImage1 = await preprocessImage(imagePath);
    const tesseractResult1 = await Tesseract.recognize(
      processedImage1,
      'eng',
      {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`[OCR] Pass 1 Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      }
    );
    
    const rawText1 = tesseractResult1.data.text;
    const confidence1 = tesseractResult1.data.confidence;
    console.log('[OCR] Pass 1 Confidence:', confidence1);
    
    // Pass 2: Aggressive preprocessing (if first pass confidence is low)
    let rawText2 = '';
    let confidence2 = 0;
    
    if (confidence1 < 75) {
      console.log('[OCR] Pass 2: Aggressive preprocessing (low confidence detected)');
      const processedImage2 = await preprocessImageAggressive(imagePath);
      const tesseractResult2 = await Tesseract.recognize(
        processedImage2,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`[OCR] Pass 2 Progress: ${Math.round(m.progress * 100)}%`);
            }
          }
        }
      );
      
      rawText2 = tesseractResult2.data.text;
      confidence2 = tesseractResult2.data.confidence;
      console.log('[OCR] Pass 2 Confidence:', confidence2);
    }
    
    // Use the result with higher confidence
    const bestRawText = confidence2 > confidence1 ? rawText2 : rawText1;
    const bestConfidence = Math.max(confidence1, confidence2);
    
    // If we have both passes, combine the text for better field extraction
    const combinedText = confidence2 > 0 ? `${rawText1}\n\n${rawText2}` : rawText1;
    
    console.log('[OCR] ✅ Best confidence:', bestConfidence);
    console.log('[OCR] Using combined text from', confidence2 > 0 ? 'both passes' : 'single pass');

    // Parse and structure the data with best OCR confidence
    const licenseData = parseLicenseData(combinedText, bestConfidence);

    return {
      data: licenseData,
      qualityCheck,
    };
  } catch (error) {
    console.error('[OCR] License processing error:', error);
    throw error;
  }
}
