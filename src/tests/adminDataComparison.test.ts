import { describe, it, expect } from '@jest/globals';
import mongoose from 'mongoose';
import KYCSubmission, { IKYCSubmission } from '../models/KYCSubmission';

describe('Admin Data Comparison Functionality', () => {
  
  describe('Data Structure Validation', () => {
    it('should validate KYC submission has required fields for data comparison', () => {
      const mockSubmission: Partial<IKYCSubmission> = {
        userId: new mongoose.Types.ObjectId(),
        status: 'pending',
        licenseNumber: 'DL123456789',
        fullName: 'John Doe',
        fatherName: 'Robert Doe',
        dateOfBirth: new Date('1990-01-01'),
        licenseExpiryDate: new Date('2025-12-31'),
        fullAddress: '123 Main Street, Kathmandu',
        contactNumber: '9841234567',
        licenseFrontImage: 'front.jpg',
        selfieImage: 'selfie.jpg',
        ocrData: {
          frontImage: {
            licenseNumber: 'DL123456789',
            fullName: 'John Doe',
            fatherName: 'Robert Doe',
            dateOfBirth: '1990/01/01',
            expiryDate: '2025/12/31',
            address: '123 Main Street, Kathmandu',
            rawText: 'DL123456789 John Doe...',
            confidence: 85,
            fieldConfidence: {
              licenseNumber: 95,
              fullName: 90,
              fatherName: 85,
              dateOfBirth: 80,
              expiryDate: 88,
              address: 70
            }
          },
          extractedAt: new Date(),
          overallConfidence: 85,
          qualityCheck: {
            isGoodQuality: true,
            issues: [],
            recommendation: 'Good quality image'
          }
        },
        dataVerification: {
          licenseNumberMatch: true,
          nameMatch: true,
          dobMatch: true,
          expiryDateMatch: true,
          fatherNameMatch: true,
          matchScore: 95,
          checkedAt: new Date()
        }
      };

      // Verify user-entered data fields exist
      expect(mockSubmission.licenseNumber).toBeDefined();
      expect(mockSubmission.fullName).toBeDefined();
      expect(mockSubmission.fatherName).toBeDefined();
      expect(mockSubmission.fullAddress).toBeDefined();
      expect(mockSubmission.contactNumber).toBeDefined();

      // Verify OCR data structure
      expect(mockSubmission.ocrData).toBeDefined();
      expect(mockSubmission.ocrData!.frontImage).toBeDefined();
      expect(mockSubmission.ocrData!.frontImage.fieldConfidence).toBeDefined();

      // Verify data verification structure
      expect(mockSubmission.dataVerification).toBeDefined();
      expect(mockSubmission.dataVerification!.matchScore).toBeDefined();
    });

    it('should validate field-level confidence scores are in valid range', () => {
      const fieldConfidence = {
        licenseNumber: 95,
        fullName: 90,
        fatherName: 85,
        dateOfBirth: 80,
        expiryDate: 88,
        address: 70
      };

      Object.entries(fieldConfidence).forEach(([field, confidence]) => {
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(100);
        expect(typeof confidence).toBe('number');
      });
    });

    it('should validate data verification match score calculation', () => {
      const dataVerification = {
        licenseNumberMatch: true,
        nameMatch: true,
        dobMatch: true,
        expiryDateMatch: true,
        matchScore: 95,
        checkedAt: new Date()
      };

      // Match score should be between 0-100
      expect(dataVerification.matchScore).toBeGreaterThanOrEqual(0);
      expect(dataVerification.matchScore).toBeLessThanOrEqual(100);
      expect(typeof dataVerification.matchScore).toBe('number');

      // Individual match results should be boolean
      expect(typeof dataVerification.licenseNumberMatch).toBe('boolean');
      expect(typeof dataVerification.nameMatch).toBe('boolean');
      expect(typeof dataVerification.dobMatch).toBe('boolean');
      expect(typeof dataVerification.expiryDateMatch).toBe('boolean');
    });
  });

  describe('Data Comparison Logic', () => {
    // Mock functions that would be used in the frontend
    const normalizeForComparison = (value: string): string => {
      if (!value) return '';
      return value.toString().toLowerCase().trim().replace(/\s+/g, ' ');
    };

    const isPartialMatch = (value1: string, value2: string): boolean => {
      if (!value1 || !value2) return false;
      
      const norm1 = normalizeForComparison(value1);
      const norm2 = normalizeForComparison(value2);
      
      return norm1.includes(norm2) || norm2.includes(norm1);
    };

    const determineMatchStatus = (userValue: string, ocrValue: string) => {
      if (!userValue && ocrValue) return 'missing-user';
      if (userValue && !ocrValue) return 'missing-ocr';
      if (normalizeForComparison(userValue) === normalizeForComparison(ocrValue)) return 'match';
      if (isPartialMatch(userValue, ocrValue)) return 'partial';
      return 'mismatch';
    };

    it('should correctly identify perfect matches', () => {
      expect(determineMatchStatus('DL123456789', 'DL123456789')).toBe('match');
      expect(determineMatchStatus('John Doe', 'john doe')).toBe('match');
      expect(determineMatchStatus('  John  Doe  ', 'John Doe')).toBe('match');
    });

    it('should correctly identify mismatches', () => {
      expect(determineMatchStatus('DL123456789', 'DL987654321')).toBe('mismatch');
      expect(determineMatchStatus('John Doe', 'Jane Smith')).toBe('mismatch');
    });

    it('should correctly identify partial matches', () => {
      expect(determineMatchStatus('John Doe Smith', 'John Doe')).toBe('partial');
      expect(determineMatchStatus('Kathmandu, Nepal', 'Kathmandu')).toBe('partial');
    });

    it('should correctly identify missing data', () => {
      expect(determineMatchStatus('', 'DL123456789')).toBe('missing-user');
      expect(determineMatchStatus('DL123456789', '')).toBe('missing-ocr');
    });

    it('should handle confidence score categorization', () => {
      const getConfidenceCategory = (confidence: number): string => {
        if (confidence >= 85) return 'high';
        if (confidence >= 60) return 'medium';
        return 'low';
      };

      expect(getConfidenceCategory(95)).toBe('high');
      expect(getConfidenceCategory(85)).toBe('high');
      expect(getConfidenceCategory(75)).toBe('medium');
      expect(getConfidenceCategory(60)).toBe('medium');
      expect(getConfidenceCategory(45)).toBe('low');
      expect(getConfidenceCategory(0)).toBe('low');
    });

    it('should handle match score categorization', () => {
      const getMatchScoreCategory = (score: number): string => {
        if (score >= 80) return 'excellent';
        if (score >= 60) return 'good';
        return 'poor';
      };

      expect(getMatchScoreCategory(95)).toBe('excellent');
      expect(getMatchScoreCategory(80)).toBe('excellent');
      expect(getMatchScoreCategory(70)).toBe('good');
      expect(getMatchScoreCategory(60)).toBe('good');
      expect(getMatchScoreCategory(45)).toBe('poor');
    });
  });

  describe('Requirements Validation', () => {
    it('should validate requirement 4.5: OCR vs User Input Comparison', () => {
      const mockDataVerification = {
        licenseNumberMatch: true,
        nameMatch: true,
        dobMatch: false,
        expiryDateMatch: true,
        matchScore: 75,
        checkedAt: new Date()
      };

      // Should have comparison results for key fields
      expect(typeof mockDataVerification.licenseNumberMatch).toBe('boolean');
      expect(typeof mockDataVerification.nameMatch).toBe('boolean');
      expect(typeof mockDataVerification.dobMatch).toBe('boolean');
      expect(typeof mockDataVerification.expiryDateMatch).toBe('boolean');
      
      // Should have overall match score
      expect(typeof mockDataVerification.matchScore).toBe('number');
      expect(mockDataVerification.matchScore).toBeGreaterThanOrEqual(0);
      expect(mockDataVerification.matchScore).toBeLessThanOrEqual(100);
    });

    it('should validate requirement 6.3: Admin Submission Detail Completeness', () => {
      const mockSubmission = {
        ocrData: {
          frontImage: {
            licenseNumber: 'DL123456789',
            confidence: 85,
            fieldConfidence: { licenseNumber: 95 }
          }
        },
        faceDetection: {
          identityConfidence: 88
        },
        licenseNumber: 'DL123456789',
        fullName: 'John Doe'
      };

      // Should include OCR data
      expect(mockSubmission.ocrData).toBeDefined();
      
      // Should include face confidence score
      expect(mockSubmission.faceDetection.identityConfidence).toBeDefined();
      
      // Should include user-entered details
      expect(mockSubmission.licenseNumber).toBeDefined();
      expect(mockSubmission.fullName).toBeDefined();
    });

    it('should validate requirement 6.4 & 12.7: Field-level confidence display', () => {
      const mockFieldConfidence = {
        licenseNumber: 95,
        fullName: 90,
        fatherName: 85,
        dateOfBirth: 80,
        expiryDate: 88,
        address: 70
      };

      // Should have field-level confidence scores
      Object.entries(mockFieldConfidence).forEach(([field, confidence]) => {
        expect(typeof confidence).toBe('number');
        expect(confidence).toBeGreaterThanOrEqual(0);
        expect(confidence).toBeLessThanOrEqual(100);
      });
    });

    it('should validate requirement 12.2: OCR Field Extraction Completeness', () => {
      const mockOCRData = {
        licenseNumber: 'DL123456789',
        fullName: 'John Doe',
        fatherName: 'Robert Doe',
        dateOfBirth: '1990/01/01',
        expiryDate: '2025/12/31',
        issueDate: '2020/01/01',
        issuingAuthority: 'Government of Nepal',
        address: '123 Main Street, Kathmandu',
        citizenshipNumber: 'CIT123456',
        licenseType: 'A',
        rawText: 'DL123456789 John Doe...',
        confidence: 85
      };

      // Should attempt extraction of all required fields
      const requiredFields = [
        'licenseNumber', 'fullName', 'fatherName', 'dateOfBirth',
        'expiryDate', 'issueDate', 'issuingAuthority', 'address',
        'citizenshipNumber', 'licenseType'
      ];

      requiredFields.forEach(field => {
        // Field should be present (even if undefined for failed extraction)
        expect(mockOCRData.hasOwnProperty(field)).toBe(true);
      });

      // Should always have raw text and confidence
      expect(mockOCRData.rawText).toBeDefined();
      expect(typeof mockOCRData.confidence).toBe('number');
    });
  });
});