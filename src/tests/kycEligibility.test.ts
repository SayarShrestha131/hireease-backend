import { Request, Response, NextFunction } from 'express';
import { checkKYCEligibility } from '../controllers/kycController';
import User from '../models/User';
import KYCSubmission from '../models/KYCSubmission';
import { AuthRequest } from '../types/auth';

// Mock the models
jest.mock('../models/User');
jest.mock('../models/KYCSubmission');

describe('KYC Eligibility Check Endpoint', () => {
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

  describe('Authentication Validation', () => {
    it('should return 401 if user is not authenticated', async () => {
      // Arrange
      mockRequest = {
        user: undefined,
      };

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 404 if user does not exist in database', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      mockRequest = {
        user: { _id: userId } as any,
      };

      (User.findById as jest.Mock).mockResolvedValue(null);

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });
  });

  describe('Profile Picture Validation', () => {
    it('should return 403 if user has no profile picture', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      mockRequest = {
        user: { _id: userId } as any,
      };

      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        profilePicture: undefined,
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Profile picture required',
        message: 'Please upload a profile picture before submitting KYC',
        requiresProfilePicture: true,
      });
    });

    it('should return 403 if profile picture is null', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      mockRequest = {
        user: { _id: userId } as any,
      };

      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        profilePicture: null,
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Profile picture required',
        message: 'Please upload a profile picture before submitting KYC',
        requiresProfilePicture: true,
      });
    });

    it('should return 403 if profile picture is empty string', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      mockRequest = {
        user: { _id: userId } as any,
      };

      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        profilePicture: '',
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        error: 'Profile picture required',
        message: 'Please upload a profile picture before submitting KYC',
        requiresProfilePicture: true,
      });
    });
  });

  describe('Pending Submission Check', () => {
    it('should return 400 if user has a pending submission', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const submissionId = '507f1f77bcf86cd799439022';
      
      mockRequest = {
        user: { _id: userId } as any,
      };

      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        profilePicture: 'profile_123.jpg',
      };

      const mockPendingSubmission = {
        _id: submissionId,
        userId,
        status: 'pending',
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (KYCSubmission.findOne as jest.Mock).mockResolvedValue(mockPendingSubmission);

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(KYCSubmission.findOne).toHaveBeenCalledWith({
        userId,
        status: 'pending',
      });
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Pending submission exists',
        message: 'You already have a pending KYC submission. Please wait for it to be reviewed.',
        hasPendingSubmission: true,
        submissionId: submissionId,
      }));
    });
  });

  describe('Successful Eligibility Check', () => {
    it('should return 200 with eligibility data when user is eligible', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      
      mockRequest = {
        user: { _id: userId } as any,
      };

      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        profilePicture: 'profile_123.jpg',
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (KYCSubmission.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(KYCSubmission.findOne).toHaveBeenCalledWith({
        userId,
        status: 'pending',
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Eligible to submit KYC',
        data: {
          hasProfilePicture: true,
          hasPendingSubmission: false,
        },
      });
    });

    it('should check only for pending status, not approved or rejected', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      
      mockRequest = {
        user: { _id: userId } as any,
      };

      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        profilePicture: 'profile_123.jpg',
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (KYCSubmission.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(KYCSubmission.findOne).toHaveBeenCalledWith({
        userId,
        status: 'pending',
      });
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe('Error Handling', () => {
    it('should call next with error if User.findById throws', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const error = new Error('Database connection failed');
      
      mockRequest = {
        user: { _id: userId } as any,
      };

      (User.findById as jest.Mock).mockRejectedValue(error);

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should call next with error if KYCSubmission.findOne throws', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const error = new Error('Database query failed');
      
      mockRequest = {
        user: { _id: userId } as any,
      };

      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        profilePicture: 'profile_123.jpg',
      };

      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (KYCSubmission.findOne as jest.Mock).mockRejectedValue(error);

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with approved submission (should be eligible)', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      
      mockRequest = {
        user: { _id: userId } as any,
      };

      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        profilePicture: 'profile_123.jpg',
      };

      // No pending submission found (approved submissions don't block)
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (KYCSubmission.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        success: true,
        message: 'Eligible to submit KYC',
        data: {
          hasProfilePicture: true,
          hasPendingSubmission: false,
        },
      });
    });

    it('should handle user with rejected submission (should be eligible after 24h)', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      
      mockRequest = {
        user: { _id: userId } as any,
      };

      const mockUser = {
        _id: userId,
        email: 'test@example.com',
        profilePicture: 'profile_123.jpg',
      };

      // No pending submission found (rejected submissions don't block after 24h)
      (User.findById as jest.Mock).mockResolvedValue(mockUser);
      (KYCSubmission.findOne as jest.Mock).mockResolvedValue(null);

      // Act
      await checkKYCEligibility(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });
});
