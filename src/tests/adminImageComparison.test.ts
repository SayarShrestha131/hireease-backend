import { Request, Response, NextFunction } from 'express';
import { getKYCSubmissionById, serveProfileImageForAdmin } from '../controllers/kycController';
import User from '../models/User';
import KYCSubmission from '../models/KYCSubmission';
import { AuthRequest } from '../types/auth';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import * as fileStorageSecurity from '../services/fileStorageSecurityService';

// Mock the models and fs
jest.mock('../models/User');
jest.mock('../models/KYCSubmission');
jest.mock('fs');
jest.mock('path');
jest.mock('jsonwebtoken');
jest.mock('../services/fileStorageSecurityService', () => ({
  validateFileAccess: jest.fn(),
  validatePathWithinDirectory: jest.fn(),
  generateSecureFilename: jest.fn(),
}));

describe('Admin Image Comparison Feature', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup mock response
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    setHeaderMock = jest.fn();
    
    mockResponse = {
      status: statusMock,
      json: jsonMock,
      setHeader: setHeaderMock,
    };

    mockNext = jest.fn();

    // Default: file access is valid
    (fileStorageSecurity.validateFileAccess as jest.Mock).mockReturnValue({
      isValid: true,
      sanitizedPath: '/uploads/profiles/test.jpg',
    });
    // Default path.join behavior
    (path.join as jest.Mock).mockImplementation((...args: string[]) => args.join('/'));
    (path.extname as jest.Mock).mockImplementation((f: string) => {
      const m = f.match(/\.[^.]+$/);
      return m ? m[0] : '';
    });
  });

  describe('KYC Submission with Profile Picture', () => {
    it('should include profile picture in populated user data', async () => {
      const mockSubmission = {
        _id: 'submission123',
        userId: {
          _id: 'user123',
          email: 'test@example.com',
          username: 'testuser',
          profilePicture: 'test_profile.jpg',
        },
        status: 'pending',
        licenseFrontImage: 'license_front.jpg',
        selfieImage: 'selfie.jpg',
        faceDetection: {
          identityConfidence: 87,
          identityMessage: 'Face match successful',
        },
      };

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockSubmission),
      };

      (KYCSubmission.findById as jest.Mock).mockReturnValue(mockChain);

      mockRequest = {
        params: { id: '507f1f77bcf86cd799439011' }, // Valid ObjectId format
      };

      await getKYCSubmissionById(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      // Verify that populate was called with profilePicture field
      expect(mockChain.populate).toHaveBeenCalledWith('userId', 'email username contactInfo profilePicture');
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        data: {
          submission: mockSubmission,
        },
      });
    });

    it('should handle submission not found', async () => {
      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(null),
      };

      (KYCSubmission.findById as jest.Mock).mockReturnValue(mockChain);

      mockRequest = {
        params: { id: '507f1f77bcf86cd799439012' }, // Valid ObjectId format
      };

      await getKYCSubmissionById(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'KYC submission not found',
      });
    });

    it('should validate submission ID format', async () => {
      mockRequest = {
        params: { id: 'invalid-id' },
      };

      await getKYCSubmissionById(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid submission ID format',
      });
    });
  });

  describe('Profile Image Serving for Admin', () => {
    it('should serve profile image for admin with valid token', async () => {
      const mockFilePath = '/uploads/profiles/test_profile.jpg';
      const mockFileStream = {
        pipe: jest.fn(),
        on: jest.fn(),
      };
      const mockUser = { _id: 'admin123', role: 'admin' };

      (path.join as jest.Mock).mockReturnValue(mockFilePath);
      (path.resolve as jest.Mock).mockReturnValueOnce('/resolved/uploads/profiles/test_profile.jpg')
                                  .mockReturnValueOnce('/resolved/uploads/profiles');
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (path.extname as jest.Mock).mockReturnValue('.jpg');
      (fs.createReadStream as jest.Mock).mockReturnValue(mockFileStream);
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'admin123' });
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      mockRequest = {
        params: { filename: 'test_profile.jpg' },
        query: { token: 'valid-admin-token' },
        headers: {},
      };

      try {
        await serveProfileImageForAdmin(mockRequest as AuthRequest, mockResponse as Response, mockNext);
        
        expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
        expect(setHeaderMock).toHaveBeenCalledWith('Cache-Control', 'private, max-age=3600');
        expect(mockFileStream.pipe).toHaveBeenCalledWith(mockResponse);
      } catch (error) {
        console.error('Test error:', error);
        expect(mockNext).toHaveBeenCalledWith(error);
      }
    });

    it('should reject request without token', async () => {
      mockRequest = {
        params: { filename: 'test_profile.jpg' },
        headers: {},
        query: {},
      };

      await serveProfileImageForAdmin(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should reject request with invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      mockRequest = {
        params: { filename: 'test_profile.jpg' },
        query: { token: 'invalid-token' },
      };

      await serveProfileImageForAdmin(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired token',
      });
    });

    it('should reject request from non-admin user', async () => {
      const mockUser = { _id: 'user123', role: 'user' };

      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'user123' });
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      mockRequest = {
        params: { filename: 'test_profile.jpg' },
        query: { token: 'valid-user-token' },
      };

      await serveProfileImageForAdmin(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Admin access required',
      });
    });

    it('should reject invalid filename with path traversal', async () => {
      const mockUser = { _id: 'admin123', role: 'admin' };
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'admin123' });
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (fileStorageSecurity.validateFileAccess as jest.Mock).mockReturnValue({
        isValid: false,
        error: 'Invalid filename: path traversal detected',
      });

      mockRequest = {
        params: { filename: '../../../etc/passwd' },
        query: { token: 'valid-admin-token' },
      };

      await serveProfileImageForAdmin(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should return 404 for non-existent file', async () => {
      const mockUser = { _id: 'admin123', role: 'admin' };

      (fileStorageSecurity.validateFileAccess as jest.Mock).mockReturnValue({
        isValid: false,
        error: 'File not found',
      });
      (jwt.verify as jest.Mock).mockReturnValue({ userId: 'admin123' });
      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      mockRequest = {
        params: { filename: 'nonexistent.jpg' },
        query: { token: 'valid-admin-token' },
      };

      await serveProfileImageForAdmin(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it('should handle different image formats', async () => {
      const testCases = [
        { filename: 'test.jpg', ext: '.jpg', contentType: 'image/jpeg' },
        { filename: 'test.jpeg', ext: '.jpeg', contentType: 'image/jpeg' },
        { filename: 'test.png', ext: '.png', contentType: 'image/png' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        const mockFilePath = `/uploads/profiles/${testCase.filename}`;
        const mockFileStream = { pipe: jest.fn(), on: jest.fn() };
        const mockUser = { _id: 'admin123', role: 'admin' };

        (fileStorageSecurity.validateFileAccess as jest.Mock).mockReturnValue({
          isValid: true,
          sanitizedPath: mockFilePath,
        });
        (path.extname as jest.Mock).mockReturnValue(testCase.ext);
        (fs.createReadStream as jest.Mock).mockReturnValue(mockFileStream);
        (jwt.verify as jest.Mock).mockReturnValue({ userId: 'admin123' });
        (User.findById as jest.Mock).mockResolvedValue(mockUser);

        mockRequest = {
          params: { filename: testCase.filename },
          query: { token: 'valid-admin-token' },
        };

        await serveProfileImageForAdmin(mockRequest as AuthRequest, mockResponse as Response, mockNext);

        expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', testCase.contentType);
      }
    });
  });

  describe('Face Confidence Data Structure', () => {
    it('should handle face detection data correctly', async () => {
      const mockSubmission = {
        _id: 'submission123',
        userId: {
          _id: 'user123',
          email: 'test@example.com',
          profilePicture: 'profile.jpg',
        },
        faceDetection: {
          hasFace: true,
          faceCount: 1,
          confidence: 95,
          isRealFace: true,
          isIdentityMatch: true,
          identityConfidence: 87,
          identityMessage: 'Face match successful',
          message: 'Face detected successfully',
          verifiedAt: new Date(),
        },
        ocrData: {
          frontImage: {
            confidence: 92,
            rawText: 'Test OCR data',
          },
          overallConfidence: 90,
          qualityCheck: {
            isGoodQuality: true,
            issues: [],
          },
        },
      };

      const mockChain = {
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(mockSubmission),
      };

      (KYCSubmission.findById as jest.Mock).mockReturnValue(mockChain);

      mockRequest = {
        params: { id: '507f1f77bcf86cd799439013' }, // Valid ObjectId format
      };

      await getKYCSubmissionById(mockRequest as AuthRequest, mockResponse as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(200);
      const responseData = jsonMock.mock.calls[0][0];
      expect(responseData.success).toBe(true);
      expect(responseData.data.submission.faceDetection.identityConfidence).toBe(87);
      expect(responseData.data.submission.ocrData.overallConfidence).toBe(90);
    });
  });
});