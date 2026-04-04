import { Request, Response, NextFunction } from 'express';
import { submitKYC } from '../controllers/kycController';
import KYCSubmission from '../models/KYCSubmission';
import { AuthRequest } from '../types/auth';

// Mock the models and services
jest.mock('../models/KYCSubmission');
jest.mock('../models/User');
jest.mock('../services/ocrService');
jest.mock('../services/faceApiService');
jest.mock('../services/identityVerificationService');
jest.mock('../services/kycVerificationService');

describe('KYC Resubmission Window Enforcement', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup mock response
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();
  });

  describe('24-Hour Resubmission Window Enforcement', () => {
    it('should block resubmission within 24 hours of rejection', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const rejectionTime = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      
      mockRequest = {
        user: { _id: userId } as any,
        body: {
          licenseNumber: 'TEST123',
          fullName: 'Test User',
          fatherName: 'Test Father',
          dateOfBirth: '1990-01-01',
          licenseExpiryDate: '2025-12-31',
          issuedBy: 'Government of Nepal',
          licenseOffice: 'Kathmandu',
          address: 'Test Address',
          contactNumber: '9841234567',
        },
        files: {
          licenseFrontImage: [{ filename: 'front.jpg' }],
          selfieImage: [{ filename: 'selfie.jpg' }],
        } as any,
      };

      // Mock no pending submission
      (KYCSubmission.findOne as jest.Mock).mockImplementation((query) => {
        if (query.status === 'pending') {
          return Promise.resolve(null);
        }
        if (query.status === 'rejected') {
          return {
            sort: jest.fn().mockResolvedValue({
              _id: 'rejected123',
              userId,
              status: 'rejected',
              reviewedAt: rejectionTime,
            }),
          };
        }
        return Promise.resolve(null);
      });

      // Act
      await submitKYC(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Resubmission not allowed yet',
          message: expect.stringContaining('You must wait 24 hours after rejection'),
          remainingTimeMs: expect.any(Number),
          remainingHours: expect.any(Number),
          remainingMinutes: expect.any(Number),
          rejectedSubmissionId: 'rejected123',
        })
      );
    });

    it('should calculate correct remaining time for resubmission', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const rejectionTime = new Date(Date.now() - 20 * 60 * 60 * 1000); // 20 hours ago
      
      mockRequest = {
        user: { _id: userId } as any,
        body: {
          licenseNumber: 'TEST123',
          fullName: 'Test User',
          fatherName: 'Test Father',
          dateOfBirth: '1990-01-01',
          licenseExpiryDate: '2025-12-31',
          issuedBy: 'Government of Nepal',
          licenseOffice: 'Kathmandu',
          address: 'Test Address',
          contactNumber: '9841234567',
        },
        files: {
          licenseFrontImage: [{ filename: 'front.jpg' }],
          selfieImage: [{ filename: 'selfie.jpg' }],
        } as any,
      };

      // Mock no pending submission
      (KYCSubmission.findOne as jest.Mock).mockImplementation((query) => {
        if (query.status === 'pending') {
          return Promise.resolve(null);
        }
        if (query.status === 'rejected') {
          return {
            sort: jest.fn().mockResolvedValue({
              _id: 'rejected123',
              userId,
              status: 'rejected',
              reviewedAt: rejectionTime,
            }),
          };
        }
        return Promise.resolve(null);
      });

      // Act
      await submitKYC(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      const callArgs = jsonMock.mock.calls[0][0];
      expect(callArgs.remainingHours).toBeLessThanOrEqual(4);
      expect(callArgs.remainingHours).toBeGreaterThanOrEqual(3);
    });

    it('should block resubmission 1 minute before 24-hour window expires', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const rejectionTime = new Date(Date.now() - (24 * 60 * 60 * 1000 - 60 * 1000)); // 23 hours 59 minutes ago
      
      mockRequest = {
        user: { _id: userId } as any,
        body: {
          licenseNumber: 'TEST123',
          fullName: 'Test User',
          fatherName: 'Test Father',
          dateOfBirth: '1990-01-01',
          licenseExpiryDate: '2025-12-31',
          issuedBy: 'Government of Nepal',
          licenseOffice: 'Kathmandu',
          address: 'Test Address',
          contactNumber: '9841234567',
        },
        files: {
          licenseFrontImage: [{ filename: 'front.jpg' }],
          selfieImage: [{ filename: 'selfie.jpg' }],
        } as any,
      };

      // Mock no pending submission
      (KYCSubmission.findOne as jest.Mock).mockImplementation((query) => {
        if (query.status === 'pending') {
          return Promise.resolve(null);
        }
        if (query.status === 'rejected') {
          return {
            sort: jest.fn().mockResolvedValue({
              _id: 'rejected123',
              userId,
              status: 'rejected',
              reviewedAt: rejectionTime,
            }),
          };
        }
        return Promise.resolve(null);
      });

      // Act
      await submitKYC(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Resubmission not allowed yet',
          remainingHours: 0,
          remainingMinutes: 0,
        })
      );
    });
  });

  describe('Resubmission After 24-Hour Window', () => {
    it('should allow resubmission exactly 24 hours after rejection', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const rejectionTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Exactly 24 hours ago
      
      mockRequest = {
        user: { _id: userId } as any,
        body: {
          licenseNumber: 'TEST123',
          fullName: 'Test User',
          fatherName: 'Test Father',
          dateOfBirth: '1990-01-01',
          licenseExpiryDate: '2025-12-31',
          issuedBy: 'Government of Nepal',
          licenseOffice: 'Kathmandu',
          address: 'Test Address',
          contactNumber: '9841234567',
        },
        files: {
          licenseFrontImage: [{ filename: 'front.jpg' }],
          selfieImage: [{ filename: 'selfie.jpg' }],
        } as any,
      };

      // Mock no pending submission and rejected submission 24 hours ago
      (KYCSubmission.findOne as jest.Mock).mockImplementation((query) => {
        if (query.status === 'pending') {
          return Promise.resolve(null);
        }
        if (query.status === 'rejected') {
          return {
            sort: jest.fn().mockResolvedValue({
              _id: 'rejected123',
              userId,
              status: 'rejected',
              reviewedAt: rejectionTime,
            }),
          };
        }
        return Promise.resolve(null);
      });

      // Act
      await submitKYC(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should not return 400 with resubmission error
      // The function will continue processing (may fail on other validations, but not on time window)
      if (statusMock.mock.calls.length > 0) {
        const callArgs = jsonMock.mock.calls[0][0];
        expect(callArgs.error).not.toBe('Resubmission not allowed yet');
      }
    });

    it('should allow resubmission 25 hours after rejection', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const rejectionTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      
      mockRequest = {
        user: { _id: userId } as any,
        body: {
          licenseNumber: 'TEST123',
          fullName: 'Test User',
          fatherName: 'Test Father',
          dateOfBirth: '1990-01-01',
          licenseExpiryDate: '2025-12-31',
          issuedBy: 'Government of Nepal',
          licenseOffice: 'Kathmandu',
          address: 'Test Address',
          contactNumber: '9841234567',
        },
        files: {
          licenseFrontImage: [{ filename: 'front.jpg' }],
          selfieImage: [{ filename: 'selfie.jpg' }],
        } as any,
      };

      // Mock no pending submission and rejected submission 25 hours ago
      (KYCSubmission.findOne as jest.Mock).mockImplementation((query) => {
        if (query.status === 'pending') {
          return Promise.resolve(null);
        }
        if (query.status === 'rejected') {
          return {
            sort: jest.fn().mockResolvedValue({
              _id: 'rejected123',
              userId,
              status: 'rejected',
              reviewedAt: rejectionTime,
            }),
          };
        }
        return Promise.resolve(null);
      });

      // Act
      await submitKYC(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should not return 400 with resubmission error
      if (statusMock.mock.calls.length > 0) {
        const callArgs = jsonMock.mock.calls[0][0];
        expect(callArgs.error).not.toBe('Resubmission not allowed yet');
      }
    });

    it('should allow resubmission 48 hours after rejection', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const rejectionTime = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      
      mockRequest = {
        user: { _id: userId } as any,
        body: {
          licenseNumber: 'TEST123',
          fullName: 'Test User',
          fatherName: 'Test Father',
          dateOfBirth: '1990-01-01',
          licenseExpiryDate: '2025-12-31',
          issuedBy: 'Government of Nepal',
          licenseOffice: 'Kathmandu',
          address: 'Test Address',
          contactNumber: '9841234567',
        },
        files: {
          licenseFrontImage: [{ filename: 'front.jpg' }],
          selfieImage: [{ filename: 'selfie.jpg' }],
        } as any,
      };

      // Mock no pending submission and rejected submission 48 hours ago
      (KYCSubmission.findOne as jest.Mock).mockImplementation((query) => {
        if (query.status === 'pending') {
          return Promise.resolve(null);
        }
        if (query.status === 'rejected') {
          return {
            sort: jest.fn().mockResolvedValue({
              _id: 'rejected123',
              userId,
              status: 'rejected',
              reviewedAt: rejectionTime,
            }),
          };
        }
        return Promise.resolve(null);
      });

      // Act
      await submitKYC(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should not return 400 with resubmission error
      if (statusMock.mock.calls.length > 0) {
        const callArgs = jsonMock.mock.calls[0][0];
        expect(callArgs.error).not.toBe('Resubmission not allowed yet');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should allow submission if no rejected submission exists', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      
      mockRequest = {
        user: { _id: userId } as any,
        body: {
          licenseNumber: 'TEST123',
          fullName: 'Test User',
          fatherName: 'Test Father',
          dateOfBirth: '1990-01-01',
          licenseExpiryDate: '2025-12-31',
          issuedBy: 'Government of Nepal',
          licenseOffice: 'Kathmandu',
          address: 'Test Address',
          contactNumber: '9841234567',
        },
        files: {
          licenseFrontImage: [{ filename: 'front.jpg' }],
          selfieImage: [{ filename: 'selfie.jpg' }],
        } as any,
      };

      // Mock no pending or rejected submissions
      (KYCSubmission.findOne as jest.Mock).mockImplementation((query) => {
        if (query.status === 'pending') {
          return Promise.resolve(null);
        }
        if (query.status === 'rejected') {
          return {
            sort: jest.fn().mockResolvedValue(null),
          };
        }
        return Promise.resolve(null);
      });

      // Act
      await submitKYC(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should not return 400 with resubmission error
      if (statusMock.mock.calls.length > 0) {
        const callArgs = jsonMock.mock.calls[0][0];
        expect(callArgs.error).not.toBe('Resubmission not allowed yet');
      }
    });

    it('should allow submission if rejected submission has no reviewedAt timestamp', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      
      mockRequest = {
        user: { _id: userId } as any,
        body: {
          licenseNumber: 'TEST123',
          fullName: 'Test User',
          fatherName: 'Test Father',
          dateOfBirth: '1990-01-01',
          licenseExpiryDate: '2025-12-31',
          issuedBy: 'Government of Nepal',
          licenseOffice: 'Kathmandu',
          address: 'Test Address',
          contactNumber: '9841234567',
        },
        files: {
          licenseFrontImage: [{ filename: 'front.jpg' }],
          selfieImage: [{ filename: 'selfie.jpg' }],
        } as any,
      };

      // Mock rejected submission without reviewedAt
      (KYCSubmission.findOne as jest.Mock).mockImplementation((query) => {
        if (query.status === 'pending') {
          return Promise.resolve(null);
        }
        if (query.status === 'rejected') {
          return {
            sort: jest.fn().mockResolvedValue({
              _id: 'rejected123',
              userId,
              status: 'rejected',
              reviewedAt: null,
            }),
          };
        }
        return Promise.resolve(null);
      });

      // Act
      await submitKYC(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert - Should not return 400 with resubmission error
      if (statusMock.mock.calls.length > 0) {
        const callArgs = jsonMock.mock.calls[0][0];
        expect(callArgs.error).not.toBe('Resubmission not allowed yet');
      }
    });

    it('should use the most recent rejected submission for time calculation', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const recentRejectionTime = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
      
      mockRequest = {
        user: { _id: userId } as any,
        body: {
          licenseNumber: 'TEST123',
          fullName: 'Test User',
          fatherName: 'Test Father',
          dateOfBirth: '1990-01-01',
          licenseExpiryDate: '2025-12-31',
          issuedBy: 'Government of Nepal',
          licenseOffice: 'Kathmandu',
          address: 'Test Address',
          contactNumber: '9841234567',
        },
        files: {
          licenseFrontImage: [{ filename: 'front.jpg' }],
          selfieImage: [{ filename: 'selfie.jpg' }],
        } as any,
      };

      // Mock most recent rejected submission (sorted by reviewedAt descending)
      (KYCSubmission.findOne as jest.Mock).mockImplementation((query) => {
        if (query.status === 'pending') {
          return Promise.resolve(null);
        }
        if (query.status === 'rejected') {
          return {
            sort: jest.fn().mockResolvedValue({
              _id: 'rejected_recent',
              userId,
              status: 'rejected',
              reviewedAt: recentRejectionTime,
            }),
          };
        }
        return Promise.resolve(null);
      });

      // Act
      await submitKYC(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Resubmission not allowed yet',
          rejectedSubmissionId: 'rejected_recent',
        })
      );
    });
  });
});
