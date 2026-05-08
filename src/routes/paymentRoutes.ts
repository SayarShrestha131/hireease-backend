import { Router } from 'express';
import {
  initiatePayment,
  verifyPayment,
  refundPayment,
  getPaymentHistory,
  getPaymentHealth,
  handleKhaltiWebhook,
  handleStripeWebhook,
  handlePayPalWebhook,
  getReceipt,
  downloadReceipt,
  getDetailedGatewayHealth,
  getPaymentMetrics,
  getCurrentStatistics,
  getReconciliationReport,
  syncPaymentStatus,
  triggerTestKhaltiWebhook,
  triggerTestStripeWebhook,
  triggerTestPayPalWebhook,
} from '../controllers/paymentController';
import { authenticate } from '../middleware/auth';
import { paymentRateLimiter } from '../middleware/rateLimiting';

const router = Router();

/**
 * @route   POST /api/payments/initiate
 * @desc    Initiate payment for a booking
 * @access  Private (authenticated users)
 */
router.post('/initiate', authenticate, paymentRateLimiter, initiatePayment);

/**
 * @route   POST /api/payments/verify
 * @desc    Verify payment completion
 * @access  Private (authenticated users)
 */
router.post('/verify', authenticate, verifyPayment);

/**
 * @route   POST /api/payments/refund
 * @desc    Refund payment for a booking
 * @access  Private (authenticated users)
 */
router.post('/refund', authenticate, refundPayment);

/**
 * @route   GET /api/payments/history
 * @desc    Get payment history for authenticated user
 * @access  Private (authenticated users)
 */
router.get('/history', authenticate, getPaymentHistory);

/**
 * @route   GET /api/payments/health
 * @desc    Health check endpoint showing gateway status
 * @access  Public
 */
router.get('/health', getPaymentHealth);

/**
 * @route   GET /api/payments/health/detailed
 * @desc    Detailed health check with response times and circuit breaker status
 * @access  Public
 */
router.get('/health/detailed', getDetailedGatewayHealth);

/**
 * @route   GET /api/payments/metrics
 * @desc    Get payment metrics for a date range
 * @access  Private (authenticated users - admin recommended)
 */
router.get('/metrics', authenticate, getPaymentMetrics);

/**
 * @route   GET /api/payments/statistics
 * @desc    Get current payment statistics (24h, 7d, 30d)
 * @access  Private (authenticated users - admin recommended)
 */
router.get('/statistics', authenticate, getCurrentStatistics);

/**
 * @route   POST /api/payments/webhooks/khalti
 * @desc    Handle Khalti webhook notifications
 * @access  Public (webhook endpoint)
 */
router.post('/webhooks/khalti', handleKhaltiWebhook);

/**
 * @route   POST /api/payments/webhooks/stripe
 * @desc    Handle Stripe webhook notifications
 * @access  Public (webhook endpoint)
 */
router.post('/webhooks/stripe', handleStripeWebhook);

/**
 * @route   POST /api/payments/webhooks/paypal
 * @desc    Handle PayPal webhook notifications
 * @access  Public (webhook endpoint)
 */
router.post('/webhooks/paypal', handlePayPalWebhook);

/**
 * @route   GET /api/payments/receipt/:bookingId
 * @desc    Get receipt information for a booking
 * @access  Private (authenticated users)
 */
router.get('/receipt/:bookingId', authenticate, getReceipt);

/**
 * @route   GET /api/payments/receipt/:bookingId/download
 * @desc    Download receipt PDF for a booking
 * @access  Private (authenticated users)
 */
router.get('/receipt/:bookingId/download', authenticate, downloadReceipt);

/**
 * @route   GET /api/payments/reconciliation
 * @desc    Get payment reconciliation report with date range filter
 * @access  Private (authenticated users - admin recommended)
 */
router.get('/reconciliation', authenticate, getReconciliationReport);

/**
 * @route   POST /api/payments/sync-status
 * @desc    Manually sync payment status with gateway
 * @access  Private (authenticated users - admin recommended)
 */
router.post('/sync-status', authenticate, syncPaymentStatus);

/**
 * @route   POST /api/payments/test/webhook/khalti
 * @desc    Trigger test Khalti webhook (sandbox only)
 * @access  Public (sandbox only)
 */
router.post('/test/webhook/khalti', triggerTestKhaltiWebhook);

/**
 * @route   POST /api/payments/test/webhook/stripe
 * @desc    Trigger test Stripe webhook (sandbox only)
 * @access  Public (sandbox only)
 */
router.post('/test/webhook/stripe', triggerTestStripeWebhook);

/**
 * @route   POST /api/payments/test/webhook/paypal
 * @desc    Trigger test PayPal webhook (sandbox only)
 * @access  Public (sandbox only)
 */
router.post('/test/webhook/paypal', triggerTestPayPalWebhook);

export default router;
