import { Response, NextFunction } from 'express';
import KYCSubmission from '../models/KYCSubmission';
import User from '../models/User';
import { AuthRequest } from '../types/auth';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { processLicenseImage } from '../services/ocrService';
import { validateSelfie } from '../services/faceApiService';
import { verifyKYCData, calculateOverallConfidence } from '../services/kycVerificationService';
import { verifyIdentity } from '../services/identityVerificationService';
import { validateFileAccess } from '../services/fileStorageSecurityService';
import { performAutomatedKyc, initializeAutomatedKyc } from '../services/automatedKycService';

/**
 * Check KYC eligibility (profile picture and pending submission check)
 * @route GET /api/kyc/eligibility
 * @access Private (authenticated users)
 */
export const checkKYCEligibility = async (
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
        error: 'Authentication required',
      });
      return;
    }

    // Find user to check profile picture
    const user = await User.findById(userId);

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    // Check if profile picture exists
    if (!user.profilePicture) {
      res.status(403).json({
        success: false,
        error: 'Profile picture required',
        message: 'Please upload a profile picture before submitting KYC',
        requiresProfilePicture: true,
        guidance: [
          'Go to your profile settings',
          'Upload a clear frontal face photo',
          'Ensure good lighting and no shadows',
          'Face should be clearly visible without sunglasses or hats',
          'Photo should be in JPEG or PNG format, maximum 5MB'
        ],
        nextSteps: {
          action: 'upload_profile_picture',
          url: '/api/profile/picture',
          method: 'POST'
        }
      });
      return;
    }

    // Check for existing pending submission
    const pendingSubmission = await KYCSubmission.findOne({
      userId,
      status: 'pending',
    });

    if (pendingSubmission) {
      res.status(400).json({
        success: false,
        error: 'Pending submission exists',
        message: 'You already have a pending KYC submission. Please wait for it to be reviewed.',
        hasPendingSubmission: true,
        submissionId: pendingSubmission._id,
        guidance: [
          'Your KYC submission is currently under review',
          'Review typically takes 24-48 hours',
          'You will be notified once the review is complete',
          'Check your submission status in the KYC section'
        ],
        estimatedReviewTime: '24-48 hours',
        nextSteps: {
          action: 'check_status',
          url: '/api/kyc/status',
          method: 'GET'
        }
      });
      return;
    }

    // User is eligible to submit KYC
    res.status(200).json({
      success: true,
      message: 'Eligible to submit KYC',
      data: {
        hasProfilePicture: true,
        hasPendingSubmission: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

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
    const {
      licenseNumber,
      fullName,
      fatherName,
      dateOfBirth,
      licenseExpiryDate,
      licenseIssueDate,
      issuedBy,
      licenseOffice,
      address,
      contactNumber,
      citizenshipNumber,
      licenseType,
      previousSubmissionId
    } = req.body;
    const userId = req.user?._id;

    // Debug: Log received form data
    console.log('[KYC] Received form data:', {
      licenseNumber,
      fullName,
      fatherName,
      issuedBy,
      licenseOffice,
      address,
      contactNumber,
      userId
    });

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
        message: 'A clear photograph of your driving license front side is mandatory for identity verification.',
        details: {
          missingFile: 'licenseFrontImage',
          required: true,
          purpose: 'Text extraction and identity verification'
        },
        guidance: [
          'Take a photo of the front side of your driving license',
          'Ensure the entire license is visible within the camera frame',
          'Use bright, natural lighting to avoid shadows and glare',
          'Hold the camera steady to prevent blur',
          'Make sure all text on the license is clearly readable',
          'Place the license on a flat, dark surface for contrast',
          'Take the photo from directly above the license (perpendicular angle)',
          'Ensure your license is valid and not expired',
          'Clean the license surface if it appears dirty or scratched'
        ],
        requirements: {
          fileType: ['image/jpeg', 'image/jpg', 'image/png'],
          maxSize: '10MB',
          quality: 'Clear and readable text',
          content: 'Complete front side of driving license',
          lighting: 'Good lighting without shadows or glare',
          angle: 'Straight-on view (not tilted or angled)'
        },
        photographyTips: {
          lighting: [
            'Use natural daylight when possible',
            'Position near a window for even lighting',
            'Avoid direct sunlight that creates harsh shadows',
            'Turn on room lights if natural light is insufficient'
          ],
          positioning: [
            'Place license on a flat, stable surface',
            'Use a dark background to contrast with the license',
            'Ensure license is completely flat (not bent or curved)',
            'Position camera directly above the license'
          ],
          cameraSettings: [
            'Use the rear camera for better quality',
            'Tap to focus on the license text',
            'Ensure the license fills 70-80% of the frame',
            'Take multiple shots and choose the clearest one'
          ]
        },
        nextSteps: {
          action: 'upload_license_front',
          message: 'Please take and upload a clear photo of your license front side',
          estimatedTime: '2-3 minutes'
        }
      });
      return;
    }

    if (!files.selfieImage) {
      res.status(400).json({
        success: false,
        error: 'Selfie image is required. Please upload a clear selfie showing your face.',
        message: 'A live selfie photograph is mandatory for face matching and identity verification.',
        details: {
          missingFile: 'selfieImage',
          required: true,
          purpose: 'Face matching with profile picture'
        },
        guidance: [
          'Take a clear selfie showing your full face',
          'Face the camera directly (frontal view, not at an angle)',
          'Ensure bright, even lighting on your face (avoid shadows)',
          'Remove sunglasses, hats, masks, or anything covering your face',
          'Keep your eyes open and look directly at the camera',
          'Keep a neutral or slight smile expression',
          'Make sure the image is not blurry or too dark',
          'Only your face should be visible (no other people in the frame)',
          'Fill about 30-40% of the frame with your face',
          'Use the front-facing camera for easier positioning'
        ],
        requirements: {
          fileType: ['image/jpeg', 'image/jpg', 'image/png'],
          maxSize: '10MB',
          faceRequirements: 'Single face, frontal view, good lighting',
          quality: 'Clear, sharp image without blur',
          lighting: 'Bright, even lighting on face',
          background: 'Plain background preferred'
        },
        selfieGuidance: {
          positioning: [
            'Hold the camera at arm\'s length',
            'Position camera at eye level',
            'Center your face in the frame',
            'Ensure your entire face is visible'
          ],
          lighting: [
            'Face towards a light source (window or lamp)',
            'Avoid backlighting (light behind you)',
            'Use natural daylight when possible',
            'Ensure even lighting on both sides of your face'
          ],
          expression: [
            'Keep a neutral or slight smile',
            'Look directly at the camera lens',
            'Keep your eyes open and visible',
            'Maintain a natural, relaxed expression'
          ],
          quality: [
            'Hold the camera steady to avoid blur',
            'Tap the screen to focus on your face',
            'Take multiple shots and choose the best one',
            'Ensure the image is not too dark or overexposed'
          ]
        },
        nextSteps: {
          action: 'capture_selfie',
          message: 'Please take a clear selfie following the detailed guidance above',
          estimatedTime: '1-2 minutes',
          tips: [
            'Find a well-lit location',
            'Practice positioning before taking the photo',
            'Take several shots to ensure you get a good one'
          ]
        }
      });
      return;
    }

    // Extract filenames from uploaded files
    const licenseFrontImage = files.licenseFrontImage[0].filename;
    const licenseBackImage = files.licenseBackImage ? files.licenseBackImage[0].filename : undefined;
    const selfieImage = files.selfieImage[0].filename;

    console.log('[KYC] Processing images with AUTOMATED KYC SYSTEM...');

    // Initialize automated KYC system if not already done
    try {
      await initializeAutomatedKyc();
    } catch (error) {
      console.error('[KYC] Failed to initialize automated KYC system:', error);
    }

    // Use automated KYC verification
    let finalStatus: 'pending' | 'approved' | 'rejected' = 'pending';
    let automatedResult;
    let ocrData;
    let faceDetectionResult;
    let faceDecision;
    let dataVerification;

    try {
      const uploadsDir = path.join(__dirname, '../../uploads/kyc');
      const frontImagePath = path.join(uploadsDir, licenseFrontImage);
      const selfiePath = path.join(uploadsDir, selfieImage);

      // Get user email for automated verification
      const user = await User.findById(userId).select('email');
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
        });
        return;
      }

      console.log('[KYC] Running automated verification...');
      automatedResult = await performAutomatedKyc(
        selfiePath,
        frontImagePath,
        {
          licenseNumber,
          fullName,
          fatherName,
          dateOfBirth,
          licenseExpiryDate,
          email: user.email
        }
      );

      console.log('[KYC] Automated verification result:', automatedResult.status);
      console.log('[KYC] Confidence:', automatedResult.confidence + '%');
      console.log('[KYC] Message:', automatedResult.message);

      // Set final status based on automated result
      finalStatus = automatedResult.status;

      // Build compatible data structures for existing database schema
      faceDetectionResult = {
        hasFace: automatedResult.verificationDetails.faceMatch.matched,
        faceCount: 1,
        confidence: automatedResult.verificationDetails.faceMatch.confidence,
        isRealFace: true,
        isIdentityMatch: automatedResult.verificationDetails.faceMatch.matched,
        identityConfidence: automatedResult.verificationDetails.faceMatch.confidence,
        identityMessage: automatedResult.message,
        message: 'Automated face verification completed',
        verifiedAt: new Date(),
      };

      faceDecision = {
        resultCode: automatedResult.verificationDetails.faceMatch.matched ? 'VERIFIED' : 'REJECTED',
        matched: automatedResult.verificationDetails.faceMatch.matched,
        confidence: automatedResult.verificationDetails.faceMatch.confidence,
        reason: automatedResult.message,
        reviewedSignal: automatedResult.autoApproved ? 'auto-face-match' : 'manual-review-needed',
        verifiedAt: new Date(),
      };

      dataVerification = {
        licenseNumberMatch: automatedResult.verificationDetails.documentMatch.licenseNumberMatch,
        nameMatch: automatedResult.verificationDetails.documentMatch.nameMatch,
        dobMatch: automatedResult.verificationDetails.documentMatch.dobMatch,
        expiryDateMatch: automatedResult.verificationDetails.documentMatch.expiryDateMatch,
        fatherNameMatch: automatedResult.verificationDetails.documentMatch.fatherNameMatch,
        matchScore: automatedResult.verificationDetails.documentMatch.matchScore,
        checkedAt: new Date(),
      };

      // Build OCR data structure
      ocrData = {
        frontImage: automatedResult.verificationDetails.ocrData || {
          rawText: 'Automated verification - OCR data not available',
          confidence: automatedResult.confidence,
          licenseNumber: automatedResult.matchedUser?.licenseNumber,
          fullName: automatedResult.matchedUser?.fullName,
          fatherName: automatedResult.matchedUser?.fatherName,
          dateOfBirth: automatedResult.matchedUser?.dateOfBirth,
          expiryDate: automatedResult.matchedUser?.licenseExpiryDate,
        },
        extractedAt: new Date(),
        overallConfidence: automatedResult.confidence,
        qualityCheck: {
          isGoodQuality: automatedResult.success,
          issues: automatedResult.success ? [] : ['Automated verification failed'],
          recommendation: automatedResult.reviewNote,
        },
      };

      // If automated verification failed, clean up files and return error
      if (!automatedResult.success) {
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
          error: 'Automated KYC verification failed',
          message: automatedResult.message,
          details: {
            faceMatch: automatedResult.verificationDetails.faceMatch,
            documentMatch: automatedResult.verificationDetails.documentMatch,
            confidence: automatedResult.confidence,
            autoApproved: false,
            failureReasons: (automatedResult.verificationDetails as any).failureReasons || [],
            detailedComparisons: (automatedResult.verificationDetails as any).detailedComparisons || []
          },
          guidance: [
            'Your identity could not be verified automatically',
            'Please check the following and try again:',
            '• Ensure all personal information is entered exactly as registered',
            '• Verify your selfie is clear and shows your face properly',
            '• Make sure your license photo is clear and readable',
            '• Double-check dates are in the correct format (YYYY-MM-DD)',
            'Contact support if you believe this is an error'
          ],
          nextSteps: {
            action: 'review_and_retry',
            message: 'Review the detailed error information above and correct any mismatches',
            supportEmail: 'support@example.com'
          }
        });
        return;
      }

      console.log('[KYC] ✅ AUTOMATED VERIFICATION SUCCESSFUL');
      if (automatedResult.matchedUser) {
        console.log('[KYC] Matched authorized user:', automatedResult.matchedUser.fullName);
      }

    } catch (error) {
      console.error('[KYC] Automated KYC system error:', error);
      
      // Fallback to manual review
      finalStatus = 'pending';
      
      ocrData = {
        frontImage: {
          rawText: '',
          confidence: 0,
          error: error instanceof Error ? error.message : 'Automated KYC system error'
        },
        extractedAt: new Date(),
        overallConfidence: 0,
        qualityCheck: {
          isGoodQuality: false,
          issues: ['Automated KYC system error - manual review required'],
          recommendation: 'Admin should manually verify due to system error.'
        },
        processingNote: 'Automated KYC failed - submission requires manual review'
      };

      faceDetectionResult = {
        hasFace: false,
        faceCount: 0,
        confidence: 0,
        isRealFace: false,
        message: 'Automated verification system error',
        verifiedAt: new Date(),
      };

      faceDecision = {
        resultCode: 'UNCERTAIN',
        matched: false,
        confidence: 0,
        reason: 'System error during automated verification',
        reviewedSignal: 'manual-review-needed',
        verifiedAt: new Date(),
      };

      dataVerification = {
        licenseNumberMatch: false,
        nameMatch: false,
        dobMatch: false,
        expiryDateMatch: false,
        fatherNameMatch: false,
        matchScore: 0,
        checkedAt: new Date(),
      };
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
        guidance: [
          'Your previous KYC submission is still under review',
          'Review typically takes 24-48 hours during business days',
          'You will receive a notification once the review is complete',
          'Multiple submissions may delay the review process'
        ],
        nextSteps: {
          action: 'check_status',
          url: '/api/kyc/status',
          message: 'Check your current submission status'
        }
      });
      return;
    }

    // Check for recent rejection - REMOVED 24-hour restriction for testing
    // Users can now resubmit immediately after rejection
    const latestRejectedSubmission = await KYCSubmission.findOne({
      userId,
      status: 'rejected',
    }).sort({ reviewedAt: -1 });

    // Log rejection info but don't block
    if (latestRejectedSubmission && latestRejectedSubmission.reviewedAt) {
      console.log('[KYC] User has previous rejection, but 24-hour restriction is disabled');
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
      status: finalStatus,
      isAutoApproved: finalStatus === 'approved',
      licenseNumber,
      fullName,
      fatherName,
      dateOfBirth: new Date(dateOfBirth),
      licenseExpiryDate: new Date(licenseExpiryDate),
      licenseIssueDate: licenseIssueDate ? new Date(licenseIssueDate) : undefined,
      issuedBy,
      licenseOffice,
      fullAddress: address,
      contactNumber,
      citizenshipNumber,
      licenseType,
      licenseFrontImage,
      licenseBackImage,
      selfieImage,
      ocrData,
      dataVerification,
      faceDetection: faceDetectionResult,
      faceDecision,
      submittedAt: new Date(),
      ...(automatedResult?.matchedUser && { matchedUser: automatedResult.matchedUser }),
      ...(previousSubmissionId && { previousSubmissionId }),
      ...(finalStatus === 'approved' && {
        reviewedAt: new Date(),
        reviewNote: 'Auto-approved based on high confidence scores and data verification - No admin intervention needed',
      }),
    });

    // Return success response with submission details
    const message = finalStatus === 'approved'
      ? 'KYC submission auto-approved! Your verification is complete.'
      : 'KYC submission successful. Verification typically takes 24-48 hours.';

    res.status(201).json({
      success: true,
      message,
      data: {
        submission: kycSubmission,
        autoApproved: finalStatus === 'approved',
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
      faceConfidence = 'all',
      ocrConfidence = 'all',
      autoApproval = 'all',
      sortBy = 'submittedAt',
      sortOrder = 'desc'
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

    // Add face confidence filter
    if (faceConfidence !== 'all') {
      if (faceConfidence === 'low') {
        filter['faceDetection.confidence'] = { $lt: 60 };
      } else if (faceConfidence === 'medium') {
        filter['faceDetection.confidence'] = { $gte: 60, $lt: 85 };
      } else if (faceConfidence === 'high') {
        filter['faceDetection.confidence'] = { $gte: 85 };
      }
    }

    // Add OCR confidence filter
    if (ocrConfidence !== 'all') {
      if (ocrConfidence === 'low') {
        filter['ocrData.overallConfidence'] = { $lt: 60 };
      } else if (ocrConfidence === 'medium') {
        filter['ocrData.overallConfidence'] = { $gte: 60, $lt: 85 };
      } else if (ocrConfidence === 'high') {
        filter['ocrData.overallConfidence'] = { $gte: 85 };
      }
    }

    // Add auto-approval filter
    if (autoApproval !== 'all') {
      if (autoApproval === 'auto') {
        filter.isAutoApproved = true;
      } else if (autoApproval === 'manual') {
        filter.isAutoApproved = { $ne: true };
      }
    }

    // Enhanced search filter for name, license number, or citizenship number
    if (search && typeof search === 'string' && search.trim() !== '') {
      filter.$or = [
        { fullName: { $regex: search.trim(), $options: 'i' } },
        { licenseNumber: { $regex: search.trim(), $options: 'i' } },
        { citizenshipNumber: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Get total count for pagination
    const totalCount = await KYCSubmission.countDocuments(filter);

    // Get pending count
    const pendingCount = await KYCSubmission.countDocuments({ status: 'pending' });

    // Build sort object
    const sortObj: any = {};
    if (sortBy === 'faceConfidence') {
      sortObj['faceDetection.confidence'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'ocrConfidence') {
      sortObj['ocrData.overallConfidence'] = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'submittedAt') {
      sortObj.submittedAt = sortOrder === 'asc' ? 1 : -1;
    } else {
      // Default sort by submission date (newest first)
      sortObj.submittedAt = -1;
    }

    // Fetch submissions with pagination and sorting
    const submissions = await KYCSubmission.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .populate('userId', 'email username contactInfo profilePicture')
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
      .populate('userId', 'email username contactInfo profilePicture')
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      
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

    // Validate filename and file access using security service
    const uploadsDir = path.join(__dirname, '../../uploads/kyc');
    const fileValidation = validateFileAccess(filename, uploadsDir);
    
    if (!fileValidation.isValid) {
      res.status(400).json({
        success: false,
        error: 'Invalid file access',
        message: fileValidation.error
      });
      return;
    }

    const filePath = fileValidation.sanitizedPath!;

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

    // Add audit trail entry to statusHistory
    if (!submission.statusHistory) {
      submission.statusHistory = [];
    }
    
    submission.statusHistory.push({
      status: 'approved',
      changedBy: adminId,
      changedAt: new Date(),
      note: reviewNote && typeof reviewNote === 'string' && reviewNote.trim() !== '' 
        ? `Admin approval: ${reviewNote.trim()}` 
        : 'Admin approval - No additional notes provided'
    });

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

    // Add audit trail entry to statusHistory
    if (!submission.statusHistory) {
      submission.statusHistory = [];
    }
    
    submission.statusHistory.push({
      status: 'rejected',
      changedBy: adminId,
      changedAt: new Date(),
      note: `Admin rejection: ${reason.trim()}`
    });

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

    // Add audit trail entry for revocation action
    if (!submission.statusHistory) {
      submission.statusHistory = [];
    }
    
    submission.statusHistory.push({
      status: 'rejected',
      changedBy: adminId,
      changedAt: new Date(),
      note: `Admin revocation: ${reason.trim()}`
    });

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

/**
 * Serve profile picture for admin review
 * @route GET /api/kyc/admin/profile-image/:filename
 * @access Private (admin only) - accepts token via header or query param
 */
export const serveProfileImageForAdmin = async (
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
      
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

    // Validate filename and file access using security service
    const uploadsDir = path.join(__dirname, '../../uploads/profiles');
    const fileValidation = validateFileAccess(filename, uploadsDir);
    
    if (!fileValidation.isValid) {
      res.status(400).json({
        success: false,
        error: 'Invalid file access',
        message: fileValidation.error
      });
      return;
    }

    const filePath = fileValidation.sanitizedPath!;

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
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
      console.error('Error streaming profile image:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Error serving profile image',
        });
      }
    });

    fileStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

/**
 * Prevent editing of approved KYC submissions (User protection)
 * This function can be used as middleware for any potential update endpoints
 */
export const preventApprovedKYCEdit = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Find the submission
    const submission = await KYCSubmission.findById(id);

    if (!submission) {
      res.status(404).json({
        success: false,
        error: 'KYC submission not found',
      });
      return;
    }

    // Check if user owns this submission
    if (submission.userId.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Access denied - not your submission',
      });
      return;
    }

    // Check if submission is approved
    if (submission.status === 'approved') {
      res.status(400).json({
        success: false,
        error: 'Cannot modify approved KYC submission',
        message: 'Your KYC has been approved and cannot be edited. Contact support if you need to make changes.',
        details: {
          submissionId: submission._id,
          status: submission.status,
          approvedAt: submission.reviewedAt,
          approvedBy: submission.reviewedBy
        },
        guidance: [
          'Approved KYC submissions cannot be modified for security reasons',
          'If you need to update your information, contact customer support',
          'You may need to submit a new KYC application if significant changes are required',
          'Minor corrections may be handled through support channels'
        ],
        nextSteps: {
          action: 'contact_support',
          message: 'Contact customer support for assistance with approved KYC modifications',
          supportEmail: 'support@example.com',
          supportPhone: '+977-1-XXXXXXX'
        }
      });
      return;
    }

    // If not approved, allow the operation to continue
    next();
  } catch (error) {
    next(error);
  }
};