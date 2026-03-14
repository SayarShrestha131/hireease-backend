/**
 * KYC Verification Service
 * Compares user-entered data with OCR-extracted data
 * Implements auto-verification logic based on confidence scores
 */

interface OCRData {
  licenseNumber?: string;
  fullName?: string;
  fatherName?: string;
  dateOfBirth?: string;
  expiryDate?: string;
  address?: string;
}

interface UserData {
  licenseNumber: string;
  fullName: string;
  fatherName?: string;
  dateOfBirth: Date;
  licenseExpiryDate: Date;
  address?: string;
}

interface VerificationResult {
  licenseNumberMatch: boolean;
  nameMatch: boolean;
  dobMatch: boolean;
  expiryDateMatch: boolean;
  matchScore: number;
  shouldAutoApprove: boolean;
  reason?: string;
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
 */
export function verifyKYCData(
  userData: UserData,
  ocrData: OCRData,
  ocrConfidence: number,
  faceConfidence: number
): VerificationResult {
  console.log('[KYC Verification] Starting data verification...');
  
  const checks = {
    licenseNumberMatch: false,
    nameMatch: false,
    dobMatch: false,
    expiryDateMatch: false,
  };
  
  // Check 1: License Number
  if (ocrData.licenseNumber) {
    const similarity = calculateStringSimilarity(userData.licenseNumber, ocrData.licenseNumber);
    checks.licenseNumberMatch = similarity >= 80;
    console.log(`[KYC Verification] License Number: ${similarity}% match`);
  }
  
  // Check 2: Full Name
  if (ocrData.fullName) {
    const similarity = calculateStringSimilarity(userData.fullName, ocrData.fullName);
    checks.nameMatch = similarity >= 70; // More lenient for names
    console.log(`[KYC Verification] Name: ${similarity}% match`);
  }
  
  // Check 3: Date of Birth
  if (ocrData.dateOfBirth) {
    checks.dobMatch = compareDates(userData.dateOfBirth, ocrData.dateOfBirth);
    console.log(`[KYC Verification] DOB: ${checks.dobMatch ? 'Match' : 'No match'}`);
  }
  
  // Check 4: Expiry Date
  if (ocrData.expiryDate) {
    checks.expiryDateMatch = compareDates(userData.licenseExpiryDate, ocrData.expiryDate);
    console.log(`[KYC Verification] Expiry: ${checks.expiryDateMatch ? 'Match' : 'No match'}`);
  }
  
  // Calculate match score (percentage of checks that passed)
  const checksArray = Object.values(checks);
  const passedChecks = checksArray.filter(Boolean).length;
  const matchScore = Math.round((passedChecks / checksArray.length) * 100);
  
  console.log(`[KYC Verification] Match Score: ${matchScore}%`);
  console.log(`[KYC Verification] OCR Confidence: ${ocrConfidence}%`);
  console.log(`[KYC Verification] Face Confidence: ${faceConfidence}%`);
  
  // Auto-approval criteria:
  // 1. OCR confidence >= 80%
  // 2. Face confidence >= 70%
  // 3. Match score >= 75% (at least 3 out of 4 fields match)
  const shouldAutoApprove =
    ocrConfidence >= 80 &&
    faceConfidence >= 70 &&
    matchScore >= 75;
  
  let reason = '';
  if (shouldAutoApprove) {
    reason = 'Auto-approved: High confidence scores and data match';
  } else if (ocrConfidence < 80) {
    reason = `OCR confidence too low (${ocrConfidence}%) - Manual review required`;
  } else if (faceConfidence < 70) {
    reason = `Face confidence too low (${faceConfidence}%) - Manual review required`;
  } else if (matchScore < 75) {
    reason = `Data match score too low (${matchScore}%) - Manual review required`;
  }
  
  console.log(`[KYC Verification] Decision: ${shouldAutoApprove ? 'AUTO-APPROVE' : 'MANUAL REVIEW'}`);
  console.log(`[KYC Verification] Reason: ${reason}`);
  
  return {
    ...checks,
    matchScore,
    shouldAutoApprove,
    reason,
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
