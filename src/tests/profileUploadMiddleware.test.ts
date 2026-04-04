import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { validateProfilePictureFace } from '../middleware/profileUploadMiddleware';
import * as faceDetectionService from '../services/faceDetectionService';

// Mock the face detection service
jest.mock('../services/faceDetectionService');

describe('Profile Upload Middleware - Face Validation', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockFile: Express.Multer.File;
  let testFilePath: string;

  beforeEach(() => {
    // Setup mock request, response, and next
    mockRequest = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    // Setup mock file
    testFilePath = path.join(__dirname, '../../uploads/profiles/test_image.jpg');
    mockFile = {
      fieldname: 'profilePicture',
      originalname: 'test.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      destination: path.join(__dirname, '../../uploads/profiles'),
      filename: 'test_image.jpg',
      path: testFilePath,
      size: 1024,
      stream: {} as any,
      buffer: Buffer.from(''),
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up test file if it exists
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  describe('Face Detection Success', () => {
    test('should proceed to next middleware when face is detected', async () => {
      // Mock successful face detection
      (faceDetectionService.detectFace as jest.Mock).mockResolvedValue({
        hasFace: true,
        confidence: 85,
        message: 'Face detected successfully',
      });

      // Create a dummy file
      fs.writeFileSync(testFilePath, 'dummy image content');

      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(faceDetectionService.detectFace).toHaveBeenCalledWith(testFilePath);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    test('should log success message when face validation passes', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      (faceDetectionService.detectFace as jest.Mock).mockResolvedValue({
        hasFace: true,
        confidence: 90,
        message: 'Face detected successfully',
      });

      fs.writeFileSync(testFilePath, 'dummy image content');
      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Profile Upload] Validating face in uploaded image:',
        testFilePath
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        '[Profile Upload] ✅ Face validation passed:',
        expect.objectContaining({
          confidence: expect.any(String),
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Face Detection Failure', () => {
    test('should delete file and return error when no face is detected', async () => {
      (faceDetectionService.detectFace as jest.Mock).mockResolvedValue({
        hasFace: false,
        confidence: 30,
        message: 'No clear face detected. Please ensure the image shows a clear frontal face with good lighting.',
      });

      fs.writeFileSync(testFilePath, 'dummy image content');
      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(faceDetectionService.detectFace).toHaveBeenCalledWith(testFilePath);
      expect(fs.existsSync(testFilePath)).toBe(false); // File should be deleted
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'No face detected in image',
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should provide user-friendly guidance when face validation fails', async () => {
      (faceDetectionService.detectFace as jest.Mock).mockResolvedValue({
        hasFace: false,
        confidence: 25,
        message: 'No clear face detected.',
      });

      fs.writeFileSync(testFilePath, 'dummy image content');
      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.guidance).toBeDefined();
      expect(Array.isArray(jsonCall.guidance)).toBe(true);
      expect(jsonCall.guidance.length).toBeGreaterThan(0);
      expect(jsonCall.guidance).toContain('Ensure your face is clearly visible and centered in the photo');
    });
  });

  describe('No File Uploaded', () => {
    test('should proceed to next middleware when no file is uploaded', async () => {
      mockRequest.file = undefined;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(faceDetectionService.detectFace).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should delete file and return 500 error when face detection throws error', async () => {
      (faceDetectionService.detectFace as jest.Mock).mockRejectedValue(
        new Error('Face detection service unavailable')
      );

      fs.writeFileSync(testFilePath, 'dummy image content');
      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(fs.existsSync(testFilePath)).toBe(false); // File should be deleted
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Failed to validate profile picture',
        message: 'An error occurred while validating your image. Please try again.',
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should handle file deletion error gracefully', async () => {
      (faceDetectionService.detectFace as jest.Mock).mockResolvedValue({
        hasFace: false,
        confidence: 20,
        message: 'No face detected',
      });

      // Don't create the file, so deletion will fail silently
      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should still return error response even if file deletion fails
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalled();
    });

    test('should log error when face validation fails', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      (faceDetectionService.detectFace as jest.Mock).mockRejectedValue(
        new Error('Service error')
      );

      fs.writeFileSync(testFilePath, 'dummy image content');
      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Profile Upload] Face validation error:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('File Cleanup', () => {
    test('should delete uploaded file when face detection fails', async () => {
      (faceDetectionService.detectFace as jest.Mock).mockResolvedValue({
        hasFace: false,
        confidence: 15,
        message: 'No face detected',
      });

      fs.writeFileSync(testFilePath, 'dummy image content');
      expect(fs.existsSync(testFilePath)).toBe(true);

      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(fs.existsSync(testFilePath)).toBe(false);
    });

    test('should delete uploaded file when validation throws error', async () => {
      (faceDetectionService.detectFace as jest.Mock).mockRejectedValue(
        new Error('Validation error')
      );

      fs.writeFileSync(testFilePath, 'dummy image content');
      expect(fs.existsSync(testFilePath)).toBe(true);

      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(fs.existsSync(testFilePath)).toBe(false);
    });

    test('should not delete file when face detection succeeds', async () => {
      (faceDetectionService.detectFace as jest.Mock).mockResolvedValue({
        hasFace: true,
        confidence: 95,
        message: 'Face detected successfully',
      });

      fs.writeFileSync(testFilePath, 'dummy image content');
      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(fs.existsSync(testFilePath)).toBe(true);
      
      // Clean up
      fs.unlinkSync(testFilePath);
    });
  });

  describe('Response Format', () => {
    test('should include confidence score in error response', async () => {
      (faceDetectionService.detectFace as jest.Mock).mockResolvedValue({
        hasFace: false,
        confidence: 42,
        message: 'No face detected',
      });

      fs.writeFileSync(testFilePath, 'dummy image content');
      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall.details?.confidence ?? jsonCall.confidence).toBe(42);
    });

    test('should include all required fields in error response', async () => {
      (faceDetectionService.detectFace as jest.Mock).mockResolvedValue({
        hasFace: false,
        confidence: 35,
        message: 'Face not clear',
      });

      fs.writeFileSync(testFilePath, 'dummy image content');
      mockRequest.file = mockFile;

      await validateProfilePictureFace(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const jsonCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(jsonCall).toHaveProperty('success', false);
      expect(jsonCall).toHaveProperty('error');
      expect(jsonCall).toHaveProperty('message');
      expect(jsonCall).toHaveProperty('guidance');
      // confidence is now nested in details
      expect(jsonCall).toHaveProperty('details.confidence');
    });
  });
});
