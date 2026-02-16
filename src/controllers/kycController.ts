import { Response, NextFunction } from 'express';
import KYCSubmission from '../models/KYCSubmission';
import User from '../models/User';
import { AuthRequest } from '../types/auth';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { processLicenseImage } from '../services/ocrService';
import { validateSelfie } from '../services/faceApiService';

/**
 * Submit new KYC application
 * @route POST /api/kyc/submit
 * @access Private (authenticated users)
 */
export const submitKYC = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { licenseNumber, fullName, dateOfBirth, licenseExpiryDate, previousSubmissionId } = req.body;
    const userId = req.user?._id;

    // Check if user is authenticated
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in to submit KYC.',
      });
      return;
    }

    // Check for uploaded files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files || !files.licenseFrontImage) {
      res.status(400).json({
        success: false,
        error: 'License front image is required. Please upload a clear photo of the front of your license.',
      });
      return;
    }

    if (!files.selfieImage) {
      res.status(400).json({
        success: false,
        error: 'Selfie image is required. Please upload a clear selfie showing your face.',
      });
      return;
    }

    // Extract filenames from uploaded files
    const licenseFrontImage = files.licenseFrontImage[0].filename;
    const licenseBackImage = files.licenseBackImage ? files.licenseBackImage[0].filename : undefined;
    const selfieImage = files.selfieImage[0].filename;

    console.log('[KYC] Processing images with OCR and face detection...');

    // Process OCR on license images
    let ocrData;
    let faceDetectionResult;

    try {
      const uploadsDir = path.join(__dirname, '../../uploads/kyc');
      const frontImagePath = path.join(uploadsDir, licenseFrontImage);

      // Extract text from front image
      console.log('[KYC] Extracting text from front image...');
      const frontOCR = await processLicenseImage(frontImagePath);

      ocrData = {
        frontImage: frontOCR,
        extractedAt: new Date(),
      };

      // Extract text from back image if provided
      if (licenseBackImage) {
        console.log('[KYC] Extracting text from back image...');
        const backImagePath = path.join(uploadsDir, licenseBackImage);
        const backOCR = await processLicenseImage(backImagePath);
        
        ocrData.backImage = {
          rawText: backOCR.rawText,
          confidence: backOCR.confidence,
          address: backOCR.address,
        };
      }

      console.log('[KYC] ✅ OCR processing complete');

      // Process selfie (MANDATORY)
      console.log('[KYC] Processing selfie image...');
      const selfiePath = path.join(uploadsDir, selfieImage);
      
      const selfieValidation = await validateSelfie(selfiePath);
      
      if (!selfieValidation.isValid) {
        // Delete uploaded files if selfie validation fails
        try {
          fs.unlinkSync(frontImagePath);
          if (licenseBackImage) {
            fs.unlinkSync(path.join(uploadsDir, licenseBackImage));
          }
          fs.unlinkSync(selfiePath);
        } catch (cleanupError) {
          console.error('[KYC] Error cleaning up files:', cleanupError);
        }
        
        res.status(400).json({
          success: false,
          error: selfieValidation.message || 'Selfie validation failed. Please upload a clear selfie showing your face.',
        });
        return;
      }
      
      faceDetectionResult = {
        hasFace: selfieValidation.faceDetection.hasFace,
        faceCount: selfieValidation.faceDetection.faceCount,
        confidence: selfieValidation.faceDetection.confidence,
        isRealFace: selfieValidation.faceDetection.isRealFace,
        message: selfieValidation.message,
        verifiedAt: new Date(),
      };
      
      console.log('[KYC] ✅ Selfie validated successfully');
    } catch (error) {
      console.error('[KYC] OCR/Face detection error:', error);
      // Continue with submission even if OCR fails
      console.log('[KYC] ⚠️ Continuing without OCR data');
    }

    // Check for existing pending submission
    const existingPendingSubmission = await KYCSubmission.findOne({
      userId,
      status: 'pending',
    });

    if (existingPendingSubmission) {
      res.status(400).json({
        success: false,
        error: 'You already have a pending KYC submission. Please wait for it to be reviewed before submitting again.',
        submissionId: existingPendingSubmission._id,
      });
      return;
    }

    // Validate previousSubmissionId if provided (for resubmissions)
    if (previousSubmissionId) {
      // Verify the previous submission exists and belongs to the user
      const previousSubmission = await KYCSubmission.findOne({
        _id: previousSubmissionId,
        userId,
      });

      if (!previousSubmission) {
        res.status(400).json({
          success: false,
          error: 'Invalid previous submission ID',
        });
        return;
      }

      // Optionally verify that the previous submission was rejected
      if (previousSubmission.status !== 'rejected') {
        res.status(400).json({
          success: false,
          error: 'Previous submission must be rejected to resubmit',
        });
        return;
      }
    }

    // Create new KYC submission
    const kycSubmission = await KYCSubmission.create({
      userId,
      status: 'pending',
      licenseNumber,
      fullName,
      dateOfBirth: new Date(dateOfBirth),
      licenseExpiryDate: new Date(licenseExpiryDate),
      licenseFrontImage,
      licenseBackImage,
      selfieImage,
      ocrData,
      faceDetection: faceDetectionResult,
      submittedAt: new Date(),
      ...(previousSubmissionId && { previousSubmissionId }),
    });

    // Return success response with submission details
    res.status(201).json({
      success: true,
      message: 'KYC submission successful. Verification typically takes 24-48 hours.',
      data: {
        submission: kycSubmission,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's KYC status
 * @route GET /api/kyc/status
 * @access Private (authenticated users)
 */
export const getKYCStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    // Check if user is authenticated
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    // Find the latest submission for the user
    const latestSubmission = await KYCSubmission.findOne({ userId })
      .sort({ submittedAt: -1 })
      .select('-licenseFrontImage -licenseBackImage -__v');

    // Handle case where user has no submissions
    if (!latestSubmission) {
      res.status(200).json({
        success: true,
        data: {
          submission: null,
        },
      });
      return;
    }

    // Return full submission object for frontend to use
    res.status(200).json({
      success: true,
      data: {
        submission: latestSubmission,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's KYC submission history
 * @route GET /api/kyc/history
 * @access Private (authenticated users)
 */
export const getKYCHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    // Check if user is authenticated
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    // Find all submissions for the user, sorted by date (newest first)
    const submissions = await KYCSubmission.find({ userId })
      .sort({ submittedAt: -1 })
      .select('-licenseFrontImage -licenseBackImage -__v');

    // Return submissions array
    res.status(200).json({
      success: true,
      data: {
        submissions,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all KYC submissions with filtering and pagination (Admin only)
 * @route GET /api/kyc/admin/submissions
 * @access Private (admin only)
 */
export const getAllKYCSubmissions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract query parameters
    const {
      status = 'all',
      search = '',
      page = '1',
      limit = '10',
    } = req.query;

    // Parse pagination parameters
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter: any = {};

    // Add status filter if not 'all'
    if (status !== 'all') {
      filter.status = status;
    }

    // Add search filter for name or license number
    if (search && typeof search === 'string' && search.trim() !== '') {
      filter.$or = [
        { fullName: { $regex: search.trim(), $options: 'i' } },
        { licenseNumber: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Get total count for pagination
    const totalCount = await KYCSubmission.countDocuments(filter);

    // Get pending count
    const pendingCount = await KYCSubmission.countDocuments({ status: 'pending' });

    // Fetch submissions with pagination, sorted by submittedAt (newest first)
    const submissions = await KYCSubmission.find(filter)
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('userId', 'email username contactInfo')
      .select('-__v');

    // Return paginated response
    res.status(200).json({
      success: true,
      data: {
        submissions,
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        pendingCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get specific KYC submission details by ID (Admin only)
 * @route GET /api/kyc/admin/submissions/:id
 * @access Private (admin only)
 */
export const getKYCSubmissionById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Validate submission ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({
        success: false,
        error: 'Invalid submission ID format',
      });
      return;
    }

    // Find submission by ID and populate user details
    const submission = await KYCSubmission.findById(id)
      .populate('userId', 'email username contactInfo')
      .populate('reviewedBy', 'email username')
      .populate('previousSubmissionId')
      .select('-__v');

    // Handle case where submission not found
    if (!submission) {
      res.status(404).json({
        success: false,
        error: 'KYC submission not found',
      });
      return;
    }

    // Return complete submission data with image URLs
    res.status(200).json({
      success: true,
      data: {
        submission,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Serve KYC image file (Admin only)
 * @route GET /api/kyc/admin/image/:filename
 * @access Private (admin only) - accepts token via header or query param
 */
export const serveKYCImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { filename } = req.params;
    
    // Get token from Authorization header or query parameter
    let token = req.headers.authorization?.replace('Bearer ', '');
    if (!token && req.query.token) {
      token = req.query.token as string;
    }
    
    // Verify token and check admin role
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }
    
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      
      // Check if user is admin
      const user = await User.findById(decoded.userId);
      if (!user || user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required',
        });
        return;
      }
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    // Validate filename to prevent path traversal attacks
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.status(400).json({
        success: false,
        error: 'Invalid filename',
      });
      return;
    }

    // Construct safe file path
    const uploadsDir = path.join(__dirname, '../../uploads/kyc');
    const filePath = path.join(uploadsDir, filename);

    // Verify the resolved path is still within the uploads directory
    const resolvedPath = path.resolve(filePath);
    const resolvedUploadsDir = path.resolve(uploadsDir);
    
    if (!resolvedPath.startsWith(resolvedUploadsDir)) {
      res.status(400).json({
        success: false,
        error: 'Invalid file path',
      });
      return;
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        error: 'Image file not found',
      });
      return;
    }

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.pdf': 'application/pdf',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow CORS for images
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization');

    // Stream the file to the response
    const fileStream = fs.createReadStream(filePath);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error serving image file',
        });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Approve KYC submission (Admin only)
 * @route PUT /api/kyc/admin/submissions/:id/approve
 * @access Private (admin only)
 */
export const approveKYC = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reviewNote } = req.body;
    const adminId = req.user?._id;

    // Validate admin is authenticated
    if (!adminId) {
      res.status(401).json({
        success: false,
        error: 'Admin not authenticated',
      });
      return;
    }

    // Validate submission ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({
        success: false,
        error: 'Invalid submission ID format',
      });
      return;
    }

    // Find the submission
    const submission = await KYCSubmission.findById(id);

    // Check if submission exists
    if (!submission) {
      res.status(404).json({
        success: false,
        error: 'KYC submission not found',
      });
      return;
    }

    // Validate that submission is in pending status
    if (submission.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: `Cannot approve submission with status "${submission.status}". Only pending submissions can be approved.`,
      });
      return;
    }

    // Update submission status to approved
    submission.status = 'approved';
    submission.reviewedBy = adminId;
    submission.reviewedAt = new Date();
    
    // Add optional review note if provided
    if (reviewNote && typeof reviewNote === 'string' && reviewNote.trim() !== '') {
      submission.reviewNote = reviewNote.trim();
    }

    // Save the updated submission
    await submission.save();

    // Populate user details for response
    await submission.populate('userId', 'email username');
    await submission.populate('reviewedBy', 'email username');

    // Return success response with updated submission
    res.status(200).json({
      success: true,
      message: 'KYC submission approved successfully',
      data: {
        submission,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reject KYC submission (Admin only)
 * @route PUT /api/kyc/admin/submissions/:id/reject
 * @access Private (admin only)
 */
export const rejectKYC = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user?._id;

    // Validate admin is authenticated
    if (!adminId) {
      res.status(401).json({
        success: false,
        error: 'Admin not authenticated',
      });
      return;
    }

    // Validate submission ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({
        success: false,
        error: 'Invalid submission ID format',
      });
      return;
    }

    // Validate rejection reason is provided (additional check beyond middleware)
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        error: 'Rejection reason must be at least 10 characters',
      });
      return;
    }

    // Find the submission
    const submission = await KYCSubmission.findById(id);

    // Check if submission exists
    if (!submission) {
      res.status(404).json({
        success: false,
        error: 'KYC submission not found',
      });
      return;
    }

    // Validate that submission is in pending status
    if (submission.status !== 'pending') {
      res.status(400).json({
        success: false,
        error: `Cannot reject submission with status "${submission.status}". Only pending submissions can be rejected.`,
      });
      return;
    }

    // Update submission status to rejected
    submission.status = 'rejected';
    submission.reviewedBy = adminId;
    submission.reviewedAt = new Date();
    submission.reviewNote = reason.trim();

    // Save the updated submission
    await submission.save();

    // Populate user details for response
    await submission.populate('userId', 'email username');
    await submission.populate('reviewedBy', 'email username');

    // Return success response with updated submission
    res.status(200).json({
      success: true,
      message: 'KYC submission rejected successfully',
      data: {
        submission,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Revoke/Reject an approved KYC submission (Admin only)
 * @route PUT /api/kyc/admin/submissions/:id/revoke
 * @access Private (admin only)
 */
export const revokeApprovedKYC = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user?._id;

    // Validate admin is authenticated
    if (!adminId) {
      res.status(401).json({
        success: false,
        error: 'Admin not authenticated',
      });
      return;
    }

    // Validate submission ID format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      res.status(400).json({
        success: false,
        error: 'Invalid submission ID format',
      });
      return;
    }

    // Validate rejection reason is provided
    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      res.status(400).json({
        success: false,
        error: 'Revocation reason must be at least 10 characters',
      });
      return;
    }

    // Find the submission
    const submission = await KYCSubmission.findById(id);

    // Check if submission exists
    if (!submission) {
      res.status(404).json({
        success: false,
        error: 'KYC submission not found',
      });
      return;
    }

    // Validate that submission is in approved status
    if (submission.status !== 'approved') {
      res.status(400).json({
        success: false,
        error: `Cannot revoke submission with status "${submission.status}". Only approved submissions can be revoked.`,
      });
      return;
    }

    // Store previous status in history if statusHistory exists
    if (submission.statusHistory) {
      submission.statusHistory.push({
        status: submission.status,
        changedBy: submission.reviewedBy,
        changedAt: submission.reviewedAt || new Date(),
        note: submission.reviewNote,
      });
    }

    // Update submission status to rejected
    submission.status = 'rejected';
    submission.reviewedBy = adminId;
    submission.reviewedAt = new Date();
    submission.reviewNote = `[REVOKED] ${reason.trim()}`;

    // Save the updated submission without validation (to avoid issues with old submissions missing selfieImage)
    await submission.save({ validateBeforeSave: false });

    // Populate user details for response
    await submission.populate('userId', 'email username');
    await submission.populate('reviewedBy', 'email username');

    // Return success response with updated submission
    res.status(200).json({
      success: true,
      message: 'Approved KYC has been revoked and rejected successfully',
      data: {
        submission,
      },
    });
  } catch (error) {
    next(error);
  }
};
