import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  submitKYC,
  getKYCStatus,
  getKYCHistory,
  getAllKYCSubmissions,
  getKYCSubmissionById,
  approveKYC,
  rejectKYC,
  revokeApprovedKYC,
  serveKYCImage,
} from '../controllers/kycController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { uploadKYCDocuments, handleUploadError } from '../middleware/uploadMiddleware';
import { validateKYCSubmission, validateKYCRejection } from '../middleware/validation';

const router = Router();

/**
 * Rate limiter for KYC submission endpoint
 * Limits users to 3 submissions per hour to prevent abuse
 */
const kycSubmitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 3, // Maximum 3 requests per hour
  message: {
    success: false,
    error: 'Too many KYC submissions. Please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * USER ROUTES
 * These routes are accessible to authenticated users
 */

/**
 * @route   POST /api/kyc/submit
 * @desc    Submit new KYC application with license documents
 * @access  Private (authenticated users)
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
router.post(
  '/submit',
  authenticate,
  uploadKYCDocuments,
  handleUploadError,
  validateKYCSubmission,
  submitKYC
);

/**
 * @route   GET /api/kyc/status
 * @desc    Get current user's KYC verification status
 * @access  Private (authenticated users)
 * Requirements: 1.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */
router.get('/status', authenticate, getKYCStatus);

/**
 * @route   GET /api/kyc/history
 * @desc    Get user's complete KYC submission history
 * @access  Private (authenticated users)
 * Requirements: 5.4
 */
router.get('/history', authenticate, getKYCHistory);

/**
 * ADMIN ROUTES
 * These routes are accessible only to users with admin role
 */

/**
 * @route   GET /api/kyc/admin/submissions
 * @desc    Get all KYC submissions with filtering and pagination
 * @access  Private (admin only)
 * @query   status - Filter by status (pending, approved, rejected, all)
 * @query   search - Search by user name or license number
 * @query   page - Page number for pagination (default: 1)
 * @query   limit - Items per page (default: 10)
 * Requirements: 2.1, 8.1, 8.2, 8.3, 8.4, 8.5
 */
router.get('/admin/submissions', authenticate, requireAdmin, getAllKYCSubmissions);

/**
 * @route   GET /api/kyc/admin/submissions/:id
 * @desc    Get specific KYC submission details by ID
 * @access  Private (admin only)
 * Requirements: 2.2, 2.3
 */
router.get('/admin/submissions/:id', authenticate, requireAdmin, getKYCSubmissionById);

/**
 * @route   GET /api/kyc/admin/image/:filename
 * @desc    Serve KYC license image file
 * @access  Private (admin only)
 * Requirements: 2.3, 6.5
 * Note: This endpoint accepts token via query parameter for image loading in HTML
 */
router.get('/admin/image/:filename', serveKYCImage);

/**
 * @route   PUT /api/kyc/admin/submissions/:id/approve
 * @desc    Approve a KYC submission
 * @access  Private (admin only)
 * @body    reviewNote (optional) - Optional note from admin
 * Requirements: 3.1, 3.2, 3.3
 */
router.put('/admin/submissions/:id/approve', authenticate, requireAdmin, approveKYC);

/**
 * @route   PUT /api/kyc/admin/submissions/:id/reject
 * @desc    Reject a KYC submission with reason
 * @access  Private (admin only)
 * @body    reason (required) - Rejection reason (min 10 characters)
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
router.put(
  '/admin/submissions/:id/reject',
  authenticate,
  requireAdmin,
  validateKYCRejection,
  rejectKYC
);

/**
 * @route   PUT /api/kyc/admin/submissions/:id/revoke
 * @desc    Revoke/Reject an approved KYC submission with reason
 * @access  Private (admin only)
 * @body    reason (required) - Revocation reason (min 10 characters)
 * Note: This allows admins to reject a KYC even after it has been approved
 */
router.put(
  '/admin/submissions/:id/revoke',
  authenticate,
  requireAdmin,
  validateKYCRejection,
  revokeApprovedKYC
);

export default router;
