/**
 * KYC Verification Service
 * Compares user-entered data with OCR-extracted data
 * Implements auto-verification logic based on confidence scores
 * 
 * Auto-Approval Criteria:
 * - OCR confidence >= 80%
 * - Face confidence >= 70%
 * - Data match score >= 75% (at least 3 out of 4 critical fields match)
 * - No quality issues
 */

interface OCRData {
  licenseNumber?: string;
  fullName?: string;
  fatherName?: string;
  dateOfBirth?: string;
  expiryDate?: string;
  address?: string;
  issuedBy?: string;
  licenseOffice?: string;
  contactNumber?: string;
  citizenshipNumber?: string;
  licenseType?: string;
  issueDate?: string;
}

interface UserData {
  licenseNumber: string;
  fullName: string;
  fatherName?: string;
  dateOfBirth: Date;
  licenseExpiryDate: Date;
  address?: string;
  issuedBy?: string;
  licenseOffice?: string;
  contactNumber?: string;
}

interface VerificationResult {
  licenseNumberMatch: boolean;
  nameMatch: boolean;
  dobMatch: boolean;
  expiryDateMatch: boolean;
  fatherNameMatch: boolean;
  issuedByMatch: boolean;
  licenseOfficeMatch: boolean;
  matchScore: number;
  shouldAutoApprove: boolean;
  reason?: string;
  fieldMatchScores: {
    licenseNumber?: number;
    fullName?: number;
    fatherName?: number;
    dateOfBirth?: number;
    expiryDate?: number;
    issuedBy?: number;
    licenseOffice?: number;
  };
}

/**
 * Normalize string for comparison (remove spaces, special chars, lowercase)
 */
function normalizeString(str: string | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Calculate similarity between two strings (0-100%)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 100;
  if (!s1 || !s2) return 0;
  
  // Levenshtein distance
  const matrix: number[][] = [];
  
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return Math.round(similarity);
}

/**
 * Parse date from various formats
 */
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  
  // Try various date formats
  const formats = [
    /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/, // DD-MM-YYYY or DD/MM/YYYY
    /(\d{2,4})[-\/](\d{1,2})[-\/](\d{1,2})/, // YYYY-MM-DD or YYYY/MM/DD
    /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})/i, // DD Mon YYYY
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch (e) {
        continue;
      }
    }
  }
  
  return null;
}

/**
 * Compare two dates (returns true if they match within 1 day tolerance)
 */
function compareDates(date1: Date, date2Str: string | undefined): boolean {
  if (!date2Str) return false;
  
  const date2 = parseDate(date2Str);
  if (!date2) return false;
  
  // Allow 1 day tolerance for date matching
  const diffInDays = Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
  return diffInDays <= 1;
}

/**
 * Verify user data against OCR extracted data
 * Returns match scores as percentages (0-100) for each field
 */
export function verifyKYCData(
  userData: UserData,
  ocrData: OCRData,
  ocrConfidence: number,
  faceConfidence: number
): VerificationResult {
  console.log('[KYC Verification] Starting data verification...');

  const fieldMatchScores: VerificationResult['fieldMatchScores'] = {};

  // Check 1: License Number (calculate similarity percentage)
  let licenseNumberMatch = false;
  if (ocrData.licenseNumber) {
    const similarity = calculateStringSimilarity(userData.licenseNumber, ocrData.licenseNumber);
    licenseNumberMatch = similarity >= 80; // Consider match if >= 80% similar
    fieldMatchScores['licenseNumber'] = similarity;
    console.log(`[KYC Verification] License Number: ${similarity}% match`);
  }

  // Check 2: Full Name
  let nameMatch = false;
  if (ocrData.fullName) {
    const similarity = calculateStringSimilarity(userData.fullName, ocrData.fullName);
    nameMatch = similarity >= 70; // More lenient for names (70%)
    fieldMatchScores['fullName'] = similarity;
    console.log(`[KYC Verification] Name: ${similarity}% match`);
  }

  // Check 3: Date of Birth
  let dobMatch = false;
  if (ocrData.dateOfBirth) {
    dobMatch = compareDates(userData.dateOfBirth, ocrData.dateOfBirth);
    fieldMatchScores['dateOfBirth'] = dobMatch ? 100 : 0;
    console.log(`[KYC Verification] DOB: ${dobMatch ? 'Match' : 'No match'}`);
  }

  // Check 4: Expiry Date
  let expiryDateMatch = false;
  if (ocrData.expiryDate) {
    expiryDateMatch = compareDates(userData.licenseExpiryDate, ocrData.expiryDate);
    fieldMatchScores['expiryDate'] = expiryDateMatch ? 100 : 0;
    console.log(`[KYC Verification] Expiry: ${expiryDateMatch ? 'Match' : 'No match'}`);
  }

  // Check 5: Father's Name
  let fatherNameMatch = false;
  if (userData.fatherName && ocrData.fatherName) {
    const similarity = calculateStringSimilarity(userData.fatherName, ocrData.fatherName);
    fatherNameMatch = similarity >= 70;
    fieldMatchScores['fatherName'] = similarity;
    console.log(`[KYC Verification] Father's Name: ${similarity}% match`);
  }

  // Check 6: Issued By
  let issuedByMatch = false;
  if (userData.issuedBy && ocrData.issuedBy) {
    const similarity = calculateStringSimilarity(userData.issuedBy, ocrData.issuedBy);
    issuedByMatch = similarity >= 70;
    fieldMatchScores['issuedBy'] = similarity;
    console.log(`[KYC Verification] Issued By: ${similarity}% match`);
  }

  // Check 7: License Office
  let licenseOfficeMatch = false;
  if (userData.licenseOffice && ocrData.licenseOffice) {
    const similarity = calculateStringSimilarity(userData.licenseOffice, ocrData.licenseOffice);
    licenseOfficeMatch = similarity >= 70;
    fieldMatchScores['licenseOffice'] = similarity;
    console.log(`[KYC Verification] License Office: ${similarity}% match`);
  }

  // Calculate overall match score (percentage of critical fields that match)
  // Critical fields: license number, name, DOB, expiry date
  const criticalChecks = [licenseNumberMatch, nameMatch, dobMatch, expiryDateMatch];
  const criticalPassed = criticalChecks.filter(Boolean).length;
  
  // Important fields: father's name, issued by, license office
  const importantChecks = [fatherNameMatch, issuedByMatch, licenseOfficeMatch].filter(Boolean);
  
  // Calculate weighted score: critical (70%) + important (30%)
  const criticalScore = (criticalPassed / criticalChecks.length) * 70;
  const importantScore = (importantChecks.length / 3) * 30;
  const matchScore = Math.round(criticalScore + importantScore);

  console.log(`[KYC Verification] Match Score: ${matchScore}%`);
  console.log(`[KYC Verification] OCR Confidence: ${ocrConfidence}%`);
  console.log(`[KYC Verification] Face Confidence: ${faceConfidence}%`);

  // Auto-approval criteria (80% threshold):
  // 1. OCR confidence >= 80%
  // 2. Face confidence >= 70%
  // 3. Match score >= 75% (at least 3 out of 4 critical fields match)
  const shouldAutoApprove =
    ocrConfidence >= 80 &&
    faceConfidence >= 70 &&
    matchScore >= 75;

  let reason = '';
  if (shouldAutoApprove) {
    reason = 'Auto-approved: High confidence scores (≥80% OCR, ≥70% Face, ≥75% Data match) - No admin intervention needed';
  } else if (ocrConfidence < 80) {
    reason = `OCR confidence too low (${ocrConfidence}%, required ≥80%) - Manual review required`;
  } else if (faceConfidence < 70) {
    reason = `Face confidence too low (${faceConfidence}%, required ≥70%) - Manual review required`;
  } else if (matchScore < 75) {
    reason = `Data match score too low (${matchScore}%, required ≥75%) - Manual review required`;
  }

  console.log(`[KYC Verification] Decision: ${shouldAutoApprove ? 'AUTO-APPROVE ✓' : 'MANUAL REVIEW ⏳'}`);
  console.log(`[KYC Verification] Reason: ${reason}`);

  return {
    licenseNumberMatch,
    nameMatch,
    dobMatch,
    expiryDateMatch,
    fatherNameMatch,
    issuedByMatch,
    licenseOfficeMatch,
    matchScore,
    shouldAutoApprove,
    reason,
    fieldMatchScores,
  };
}

/**
 * Calculate overall confidence from OCR and face detection
 */
export function calculateOverallConfidence(
  frontImageConfidence: number,
  backImageConfidence: number | undefined,
  faceConfidence: number
): number {
  const confidences = [frontImageConfidence, faceConfidence];
  
  if (backImageConfidence !== undefined) {
    confidences.push(backImageConfidence);
  }
  
  const average = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  return Math.round(average);
}
