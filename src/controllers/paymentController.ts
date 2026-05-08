import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import crypto from 'crypto';
import PaymentTransaction from '../models/PaymentTransaction';
import Booking from '../models/Booking';
import khaltiService from '../services/khaltiService';
import stripeService from '../services/stripeService';
import paypalService from '../services/paypalService';
import paymentService from '../services/paymentService';
import auditLogService from '../services/auditLogService';
import gatewayMonitoringService from '../services/gatewayMonitoringService';
import paymentAnalyticsService from '../services/paymentAnalyticsService';
import gatewayConfig from '../config/paymentGateway';
import { mapPaymentError, logPaymentError } from '../utils/paymentErrorMapper';
import * as fs from 'fs';

/**
 * Initiate payment for a booking
 * @route POST /api/payments/initiate
 * 
 * Requirements: 5.1, 7.1, 8.1, 18.7
 */
export const initiatePayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { bookingId, paymentMethod, returnUrl } = req.body;

    // Log incoming request for debugging
    console.log('🔍 [PaymentController] Initiate payment request received');
    console.log('   User ID:', userId);
    console.log('   Booking ID:', bookingId);
    console.log('   Payment Method:', paymentMethod);
    console.log('   Return URL:', returnUrl);
    console.log('   Request Body:', JSON.stringify(req.body, null, 2));

    // Validate authentication
    if (!userId) {
      console.log('❌ [PaymentController] Authentication failed - no userId');
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Validate required fields
    if (!bookingId || !paymentMethod || !returnUrl) {
      console.log('❌ [PaymentController] Missing required fields');
      console.log('   bookingId present:', !!bookingId);
      console.log('   paymentMethod present:', !!paymentMethod);
      console.log('   returnUrl present:', !!returnUrl);
      res.status(400).json({
        success: false,
        error: 'Booking ID, payment method, and return URL are required',
      });
      return;
    }

    // Validate payment method
    const validMethods = ['khalti', 'stripe', 'paypal', 'esewa'];
    if (!validMethods.includes(paymentMethod)) {
      console.log('❌ [PaymentController] Invalid payment method:', paymentMethod);
      res.status(400).json({
        success: false,
        error: 'Invalid payment method. Must be one of: khalti, stripe, paypal, esewa',
      });
      return;
    }

    console.log('✅ [PaymentController] Validation passed, calling payment service...');

    // Initiate payment using PaymentService
    const result = await paymentService.initiatePayment(
      bookingId,
      paymentMethod,
      returnUrl,
      userId.toString()
    );

    console.log('✅ [PaymentController] Payment initiated successfully');
    console.log('   Transaction ID:', result.transactionId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    // Log detailed error for debugging
    console.error('❌ [PaymentController] Payment initiation error:', error.message);
    console.error('   Error stack:', error.stack);
    
    logPaymentError(error, {
      endpoint: 'initiatePayment',
      userId: req.user?._id?.toString(),
      bookingId: req.body.bookingId,
      paymentMethod: req.body.paymentMethod,
    });

    // Map to user-friendly error
    const errorResponse = mapPaymentError(error, req.body.paymentMethod);

    res.status(400).json({
      success: false,
      error: errorResponse.message,
      suggestedAction: errorResponse.suggestedAction,
      supportContact: errorResponse.supportContact,
    });
  }
};

/**
 * Verify payment completion
 * @route POST /api/payments/verify
 * 
 * Requirements: 5.2, 7.1, 8.1
 */
export const verifyPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { transactionId, gatewayData } = req.body;

    // Validate authentication
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Validate required fields
    if (!transactionId) {
      res.status(400).json({
        success: false,
        error: 'Transaction ID is required',
      });
      return;
    }

    // Verify payment using PaymentService
    const result = await paymentService.verifyPayment(transactionId, gatewayData || {});

    res.status(200).json({
      success: result.success,
      data: {
        paymentStatus: result.paymentStatus,
        bookingId: result.bookingId,
        receiptUrl: result.paymentStatus === 'completed' 
          ? `/api/payments/receipt/${result.bookingId}` 
          : undefined,
      },
    });
  } catch (error: any) {
    // Log detailed error for debugging
    logPaymentError(error, {
      endpoint: 'verifyPayment',
      userId: req.user?._id?.toString(),
      transactionId: req.body.transactionId,
    });

    // Map to user-friendly error
    const errorResponse = mapPaymentError(error);

    res.status(400).json({
      success: false,
      error: errorResponse.message,
      suggestedAction: errorResponse.suggestedAction,
      supportContact: errorResponse.supportContact,
    });
  }
};

/**
 * Refund payment for a booking
 * @route POST /api/payments/refund
 * 
 * Requirements: 7.1, 8.1
 */
export const refundPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;
    const { bookingId, reason, amount } = req.body;

    // Validate authentication
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Validate required fields
    if (!bookingId || !reason) {
      res.status(400).json({
        success: false,
        error: 'Booking ID and reason are required',
      });
      return;
    }

    // Refund payment using PaymentService
    const result = await paymentService.refundPayment(bookingId, reason, amount);

    res.status(200).json({
      success: result.success,
      data: {
        refundId: result.refundId,
        refundStatus: result.refundStatus,
        refundAmount: result.refundAmount,
      },
      error: result.errorMessage,
    });
  } catch (error: any) {
    // Log detailed error for debugging
    logPaymentError(error, {
      endpoint: 'refundPayment',
      userId: req.user?._id?.toString(),
      bookingId: req.body.bookingId,
      reason: req.body.reason,
    });

    // Map to user-friendly error
    const errorResponse = mapPaymentError(error);

    res.status(400).json({
      success: false,
      error: errorResponse.message,
      suggestedAction: errorResponse.suggestedAction,
      supportContact: errorResponse.supportContact,
    });
  }
};

/**
 * Get payment history for authenticated user
 * @route GET /api/payments/history
 * 
 * Requirements: 8.1
 */
export const getPaymentHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?._id;

    // Validate authentication
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Extract query parameters
    const {
      page,
      limit,
      status,
      paymentMethod,
      startDate,
      endDate,
    } = req.query;

    // Build filters
    const filters: any = {};
    
    if (page) filters.page = parseInt(page as string, 10);
    if (limit) filters.limit = parseInt(limit as string, 10);
    if (status) filters.status = status;
    if (paymentMethod) filters.paymentMethod = paymentMethod;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    // Get payment history using PaymentService
    const result = await paymentService.getPaymentHistory(userId.toString(), filters);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    // Log detailed error for debugging
    logPaymentError(error, {
      endpoint: 'getPaymentHistory',
      userId: req.user?._id?.toString(),
    });

    // Map to user-friendly error
    const errorResponse = mapPaymentError(error);

    res.status(500).json({
      success: false,
      error: errorResponse.message,
      supportContact: errorResponse.supportContact,
    });
  }
};

/**
 * Health check endpoint showing gateway status
 * @route GET /api/payments/health
 * 
 * Requirements: 18.7
 */
export const getPaymentHealth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get health check response from monitoring service
    const healthStatus = gatewayMonitoringService.getHealthCheckResponse();

    res.status(200).json({
      success: true,
      data: healthStatus,
    });
  } catch (error: any) {
    // Log detailed error for debugging
    logPaymentError(error, {
      endpoint: 'getPaymentHealth',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment gateway status',
    });
  }
};

/**
 * Webhook handler for Khalti payment notifications
 * @route POST /api/payments/webhooks/khalti
 * 
 * Requirements: 4.2, 4.3, 9.1, 9.2, 9.3, 9.4
 */
export const handleKhaltiWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.headers['khalti-signature'] as string;
    const payload = JSON.stringify(req.body);

    // Validate webhook signature before processing
    const isValid = khaltiService.validateWebhookSignature(payload, signature);
    
    if (!isValid) {
      console.error('Khalti webhook signature validation failed');
      
      // Log security alert for failed webhook signature (Requirements: 4.8, 17.8)
      await auditLogService.logWebhookSignatureFailure({
        gateway: 'khalti',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          signature: signature?.substring(0, 10) + '...',
        },
      });
      
      res.status(401).json({
        success: false,
        error: 'Invalid webhook signature',
      });
      return;
    }

    // Respond with HTTP 200 within 5 seconds (immediately)
    res.status(200).json({ success: true });

    // Log webhook received (Requirements: 4.8, 17.8)
    await auditLogService.logWebhookReceived({
      gateway: 'khalti',
      webhookEvent: req.body.event || 'unknown',
      payload: req.body,
    });

    // Process webhook payload asynchronously
    processKhaltiWebhookAsync(req.body).catch((error) => {
      console.error('Async Khalti webhook processing failed:', error);
    });
  } catch (error) {
    console.error('Khalti webhook handler error:', error);
    // Still respond with 200 to prevent retries for malformed requests
    res.status(200).json({ success: true });
  }
};

/**
 * Webhook handler for Stripe payment notifications
 * @route POST /api/payments/webhooks/stripe
 * 
 * Requirements: 4.2, 4.3, 9.1, 9.2, 9.3, 9.4
 */
export const handleStripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    // For Stripe webhooks, req.body is a Buffer due to express.raw() middleware
    const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);

    // Validate webhook signature before processing
    const isValid = stripeService.validateWebhookSignature(payload, signature);
    
    if (!isValid) {
      console.error('Stripe webhook signature validation failed');
      
      // Log security alert for failed webhook signature (Requirements: 4.8, 17.8)
      await auditLogService.logWebhookSignatureFailure({
        gateway: 'stripe',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          signature: signature?.substring(0, 10) + '...',
        },
      });
      
      res.status(401).json({
        success: false,
        error: 'Invalid webhook signature',
      });
      return;
    }

    // Respond with HTTP 200 within 5 seconds (immediately)
    res.status(200).json({ success: true });

    // Log webhook received (Requirements: 4.8, 17.8)
    const webhookPayload = JSON.parse(payload);
    await auditLogService.logWebhookReceived({
      gateway: 'stripe',
      webhookEvent: webhookPayload.type || 'unknown',
      payload: webhookPayload,
    });

    // Process webhook payload asynchronously
    processStripeWebhookAsync(payload, signature).catch((error) => {
      console.error('Async Stripe webhook processing failed:', error);
    });
  } catch (error) {
    console.error('Stripe webhook handler error:', error);
    // Still respond with 200 to prevent retries for malformed requests
    res.status(200).json({ success: true });
  }
};

/**
 * Webhook handler for PayPal payment notifications
 * @route POST /api/payments/webhooks/paypal
 * 
 * Requirements: 4.2, 4.3, 9.1, 9.2, 9.3, 9.4
 */
export const handlePayPalWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const headers: Record<string, string> = {};
    Object.keys(req.headers).forEach((key) => {
      if (key.toLowerCase().startsWith('paypal-')) {
        headers[key.toLowerCase()] = req.headers[key] as string;
      }
    });

    const payload = JSON.stringify(req.body);

    // Validate webhook signature before processing
    const isValid = await paypalService.validateWebhookSignature(payload, headers);
    
    if (!isValid) {
      console.error('PayPal webhook signature validation failed');
      
      // Log security alert for failed webhook signature (Requirements: 4.8, 17.8)
      await auditLogService.logWebhookSignatureFailure({
        gateway: 'paypal',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          transmissionId: headers['paypal-transmission-id'],
        },
      });
      
      res.status(401).json({
        success: false,
        error: 'Invalid webhook signature',
      });
      return;
    }

    // Respond with HTTP 200 within 5 seconds (immediately)
    res.status(200).json({ success: true });

    // Log webhook received (Requirements: 4.8, 17.8)
    await auditLogService.logWebhookReceived({
      gateway: 'paypal',
      webhookEvent: req.body.event_type || 'unknown',
      payload: req.body,
    });

    // Process webhook payload asynchronously
    processPayPalWebhookAsync(req.body).catch((error) => {
      console.error('Async PayPal webhook processing failed:', error);
    });
  } catch (error) {
    console.error('PayPal webhook handler error:', error);
    // Still respond with 200 to prevent retries for malformed requests
    res.status(200).json({ success: true });
  }
};

/**
 * Asynchronous Khalti webhook processing with idempotency and retry logic
 * 
 * Requirements: 9.5, 9.6, 9.7
 */
async function processKhaltiWebhookAsync(webhookPayload: any, retryCount = 0): Promise<void> {
  try {
    // Generate hash of webhook payload for idempotency checking
    const payloadHash = generateWebhookHash(webhookPayload);

    // Check if webhook already processed using payload hash
    const existingTransaction = await PaymentTransaction.findOne({
      'webhookPayload.hash': payloadHash,
      webhookProcessedAt: { $exists: true },
    });

    if (existingTransaction) {
      console.log(`Khalti webhook already processed: ${payloadHash}`);
      return;
    }

    // Process webhook using service
    const webhookData = await khaltiService.processWebhook(webhookPayload);

    // Find transaction by pidx (stored in gatewayPaymentToken)
    const transaction = await PaymentTransaction.findOne({
      gatewayPaymentToken: webhookData.pidx,
      gateway: 'khalti',
    });

    if (!transaction) {
      console.error(`Transaction not found for Khalti pidx: ${webhookData.pidx}`);
      return;
    }

    // Store raw webhook payload with hash
    transaction.webhookPayload = {
      ...webhookPayload,
      hash: payloadHash,
    };

    // Update Payment_Transaction status based on webhook event
    if (webhookData.isSuccess) {
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      transaction.gatewayTransactionId = webhookData.transactionId;
    } else {
      transaction.status = 'failed';
      transaction.failedAt = new Date();
      transaction.errorMessage = 'Payment failed via webhook notification';
    }

    transaction.webhookProcessedAt = new Date();
    await transaction.save();

    // Update Booking status when payment confirmed via webhook
    if (webhookData.isSuccess) {
      const booking = await Booking.findById(transaction.bookingId);
      if (booking) {
        booking.paymentStatus = 'completed';
        booking.status = 'confirmed';
        booking.paidAt = new Date();
        await booking.save();
      }
    }

    console.log(`Khalti webhook processed successfully: ${payloadHash}`);
  } catch (error: any) {
    console.error(`Khalti webhook processing error (attempt ${retryCount + 1}):`, error);

    // Implement retry logic for failed webhook processing (up to 3 retries)
    if (retryCount < 3) {
      console.log(`Retrying Khalti webhook processing (attempt ${retryCount + 2})...`);
      // Wait before retry (exponential backoff: 1s, 2s, 4s)
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      await processKhaltiWebhookAsync(webhookPayload, retryCount + 1);
    } else {
      console.error('Khalti webhook processing failed after 3 retries');
      throw error;
    }
  }
}

/**
 * Asynchronous Stripe webhook processing with idempotency and retry logic
 * 
 * Requirements: 9.5, 9.6, 9.7
 */
async function processStripeWebhookAsync(
  payload: string,
  signature: string,
  retryCount = 0
): Promise<void> {
  try {
    // Parse payload for hash generation
    const webhookPayload = JSON.parse(payload);

    // Generate hash of webhook payload for idempotency checking
    const payloadHash = generateWebhookHash(webhookPayload);

    // Check if webhook already processed using payload hash
    const existingTransaction = await PaymentTransaction.findOne({
      'webhookPayload.hash': payloadHash,
      webhookProcessedAt: { $exists: true },
    });

    if (existingTransaction) {
      console.log(`Stripe webhook already processed: ${payloadHash}`);
      return;
    }

    // Process webhook using service
    const webhookData = await stripeService.processWebhook(payload, signature);

    // Find transaction by payment intent ID
    const transaction = await PaymentTransaction.findOne({
      gatewayPaymentIntentId: webhookData.paymentIntentId,
      gateway: 'stripe',
    });

    if (!transaction) {
      console.error(`Transaction not found for Stripe payment intent: ${webhookData.paymentIntentId}`);
      return;
    }

    // Store raw webhook payload with hash
    transaction.webhookPayload = {
      ...webhookPayload,
      hash: payloadHash,
    };

    // Update Payment_Transaction status based on webhook event
    if (webhookData.eventType === 'payment_intent.succeeded') {
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      transaction.gatewayChargeId = webhookData.chargeId;
      transaction.gatewayMetadata = webhookData.metadata || {};
    } else if (webhookData.eventType === 'payment_intent.payment_failed') {
      transaction.status = 'failed';
      transaction.failedAt = new Date();
      transaction.errorMessage = 'Payment failed via webhook notification';
    } else if (webhookData.eventType === 'charge.refunded') {
      transaction.status = 'refunded';
      transaction.refundedAt = new Date();
    }

    transaction.webhookProcessedAt = new Date();
    await transaction.save();

    // Update Booking status when payment confirmed via webhook
    if (webhookData.eventType === 'payment_intent.succeeded') {
      const booking = await Booking.findById(transaction.bookingId);
      if (booking) {
        booking.paymentStatus = 'completed';
        booking.status = 'confirmed';
        booking.paidAt = new Date();
        await booking.save();
      }
    }

    console.log(`Stripe webhook processed successfully: ${payloadHash}`);
  } catch (error: any) {
    console.error(`Stripe webhook processing error (attempt ${retryCount + 1}):`, error);

    // Implement retry logic for failed webhook processing (up to 3 retries)
    if (retryCount < 3) {
      console.log(`Retrying Stripe webhook processing (attempt ${retryCount + 2})...`);
      // Wait before retry (exponential backoff: 1s, 2s, 4s)
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      await processStripeWebhookAsync(payload, signature, retryCount + 1);
    } else {
      console.error('Stripe webhook processing failed after 3 retries');
      throw error;
    }
  }
}

/**
 * Asynchronous PayPal webhook processing with idempotency and retry logic
 * 
 * Requirements: 9.5, 9.6, 9.7
 */
async function processPayPalWebhookAsync(webhookPayload: any, retryCount = 0): Promise<void> {
  try {
    // Generate hash of webhook payload for idempotency checking
    const payloadHash = generateWebhookHash(webhookPayload);

    // Check if webhook already processed using payload hash
    const existingTransaction = await PaymentTransaction.findOne({
      'webhookPayload.hash': payloadHash,
      webhookProcessedAt: { $exists: true },
    });

    if (existingTransaction) {
      console.log(`PayPal webhook already processed: ${payloadHash}`);
      return;
    }

    // Process webhook using service
    const webhookData = await paypalService.processWebhook(webhookPayload);

    // Find transaction by capture ID or order ID
    const transaction = await PaymentTransaction.findOne({
      $or: [
        { gatewayCaptureId: webhookData.captureId },
        { gatewayOrderId: webhookData.orderId },
      ],
      gateway: 'paypal',
    });

    if (!transaction) {
      console.error(`Transaction not found for PayPal capture/order: ${webhookData.captureId || webhookData.orderId}`);
      return;
    }

    // Store raw webhook payload with hash
    transaction.webhookPayload = {
      ...webhookPayload,
      hash: payloadHash,
    };

    // Update Payment_Transaction status based on webhook event
    if (webhookData.eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      transaction.gatewayCaptureId = webhookData.captureId;
    } else if (webhookData.eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      transaction.status = 'refunded';
      transaction.refundedAt = new Date();
    }

    transaction.webhookProcessedAt = new Date();
    await transaction.save();

    // Update Booking status when payment confirmed via webhook
    if (webhookData.eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const booking = await Booking.findById(transaction.bookingId);
      if (booking) {
        booking.paymentStatus = 'completed';
        booking.status = 'confirmed';
        booking.paidAt = new Date();
        await booking.save();
      }
    }

    console.log(`PayPal webhook processed successfully: ${payloadHash}`);
  } catch (error: any) {
    console.error(`PayPal webhook processing error (attempt ${retryCount + 1}):`, error);

    // Implement retry logic for failed webhook processing (up to 3 retries)
    if (retryCount < 3) {
      console.log(`Retrying PayPal webhook processing (attempt ${retryCount + 2})...`);
      // Wait before retry (exponential backoff: 1s, 2s, 4s)
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      await processPayPalWebhookAsync(webhookPayload, retryCount + 1);
    } else {
      console.error('PayPal webhook processing failed after 3 retries');
      throw error;
    }
  }
}

/**
 * Generate hash of webhook payload for idempotency checking
 * 
 * Requirements: 9.5
 */
function generateWebhookHash(payload: any): string {
  const payloadString = JSON.stringify(payload);
  return crypto.createHash('sha256').update(payloadString).digest('hex');
}

/**
 * Get receipt for a booking
 * @route GET /api/payments/receipt/:bookingId
 * 
 * Requirements: 6.6, 8.7
 */
export const getReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const userId = (req as any).user?.userId;

    if (!bookingId) {
      res.status(400).json({
        success: false,
        error: 'Booking ID is required',
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Verify booking belongs to user
    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found',
      });
      return;
    }

    if (booking.userId.toString() !== userId) {
      res.status(403).json({
        success: false,
        error: 'You do not have permission to access this receipt',
      });
      return;
    }

    // Get receipt from payment service
    const receipt = await paymentService.getReceipt(bookingId);

    // Check if file exists
    if (!fs.existsSync(receipt.receiptPath)) {
      res.status(404).json({
        success: false,
        error: 'Receipt file not found',
      });
      return;
    }

    // Return receipt information
    res.status(200).json({
      success: true,
      data: {
        receiptUrl: `/api/payments/receipt/${bookingId}/download`,
        receiptNumber: receipt.receiptNumber,
        receiptPath: receipt.receiptPath,
      },
    });
  } catch (error: any) {
    // Log detailed error for debugging
    logPaymentError(error, {
      endpoint: 'getReceipt',
      bookingId: req.params.bookingId,
    });

    // Map to user-friendly error
    const errorResponse = mapPaymentError(error);

    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: errorResponse.message,
      supportContact: errorResponse.supportContact,
    });
  }
};

/**
 * Download receipt PDF
 * @route GET /api/payments/receipt/:bookingId/download
 * 
 * Requirements: 6.6, 8.7
 */
export const downloadReceipt = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId } = req.params;
    const userId = (req as any).user?.userId;

    if (!bookingId) {
      res.status(400).json({
        success: false,
        error: 'Booking ID is required',
      });
      return;
    }

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Verify booking belongs to user
    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found',
      });
      return;
    }

    if (booking.userId.toString() !== userId) {
      res.status(403).json({
        success: false,
        error: 'You do not have permission to access this receipt',
      });
      return;
    }

    // Get receipt from payment service
    const receipt = await paymentService.getReceipt(bookingId);

    // Check if file exists
    if (!fs.existsSync(receipt.receiptPath)) {
      res.status(404).json({
        success: false,
        error: 'Receipt file not found',
      });
      return;
    }

    // Set headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.receiptNumber}.pdf"`);

    // Stream the file
    const fileStream = fs.createReadStream(receipt.receiptPath);
    fileStream.pipe(res);
  } catch (error: any) {
    // Log detailed error for debugging
    logPaymentError(error, {
      endpoint: 'downloadReceipt',
      bookingId: req.params.bookingId,
    });

    // Map to user-friendly error
    const errorResponse = mapPaymentError(error);

    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: errorResponse.message,
      supportContact: errorResponse.supportContact,
    });
  }
};

/**
 * Get detailed gateway health status
 * @route GET /api/payments/health/detailed
 * 
 * Requirements: 18.6, 18.7
 */
export const getDetailedGatewayHealth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const healthStatuses = gatewayMonitoringService.getAllGatewayHealth();

    res.status(200).json({
      success: true,
      data: {
        gateways: healthStatuses,
        mode: process.env.PAYMENT_MODE || 'sandbox',
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    logPaymentError(error, {
      endpoint: 'getDetailedGatewayHealth',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve detailed gateway health',
    });
  }
};

/**
 * Get payment metrics for a date range
 * @route GET /api/payments/metrics
 * 
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 */
export const getPaymentMetrics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Admin-only endpoint (optional: add admin middleware)
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'Start date and end date are required',
      });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format',
      });
      return;
    }

    const metrics = await paymentAnalyticsService.getPaymentMetrics(start, end);

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error: any) {
    logPaymentError(error, {
      endpoint: 'getPaymentMetrics',
      userId: req.user?._id?.toString(),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment metrics',
    });
  }
};

/**
 * Get current payment statistics
 * @route GET /api/payments/statistics
 * 
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
 */
export const getCurrentStatistics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Admin-only endpoint (optional: add admin middleware)
    const statistics = await paymentAnalyticsService.getCurrentStatistics();

    res.status(200).json({
      success: true,
      data: statistics,
    });
  } catch (error: any) {
    logPaymentError(error, {
      endpoint: 'getCurrentStatistics',
      userId: req.user?._id?.toString(),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve payment statistics',
    });
  }
};

/**
 * Get payment reconciliation report
 * @route GET /api/payments/reconciliation
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */
export const getReconciliationReport = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { startDate, endDate, format } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: 'Start date and end date are required',
      });
      return;
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        success: false,
        error: 'Invalid date format',
      });
      return;
    }

    // Get all transactions within date range
    const transactions = await PaymentTransaction.find({
      createdAt: { $gte: start, $lte: end },
    })
      .populate('bookingId', 'bookingNumber vehicleId pickupDate dropoffDate')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    // Calculate totals
    const successfulPayments = transactions.filter(
      (t) => t.status === 'completed' && t.transactionType === 'payment'
    );
    const failedPayments = transactions.filter(
      (t) => t.status === 'failed' && t.transactionType === 'payment'
    );
    const refunds = transactions.filter((t) => t.transactionType === 'refund');

    const totalSuccessful = successfulPayments.reduce((sum, t) => sum + t.amount, 0);
    const totalFailed = failedPayments.reduce((sum, t) => sum + t.amount, 0);
    const totalRefunded = refunds.reduce((sum, t) => sum + t.amount, 0);

    // Group by payment method
    const byPaymentMethod = {
      khalti: {
        count: 0,
        totalAmount: 0,
        successful: 0,
        failed: 0,
        refunded: 0,
      },
      stripe: {
        count: 0,
        totalAmount: 0,
        successful: 0,
        failed: 0,
        refunded: 0,
      },
      paypal: {
        count: 0,
        totalAmount: 0,
        successful: 0,
        failed: 0,
        refunded: 0,
      },
      esewa: {
        count: 0,
        totalAmount: 0,
        successful: 0,
        failed: 0,
        refunded: 0,
      },
    };

    transactions.forEach((t) => {
      const method = t.paymentMethod;
      if (byPaymentMethod[method]) {
        byPaymentMethod[method].count++;
        byPaymentMethod[method].totalAmount += t.amount;

        if (t.status === 'completed' && t.transactionType === 'payment') {
          byPaymentMethod[method].successful++;
        } else if (t.status === 'failed') {
          byPaymentMethod[method].failed++;
        } else if (t.transactionType === 'refund') {
          byPaymentMethod[method].refunded++;
        }
      }
    });

    const reconciliationData = {
      dateRange: {
        startDate: start,
        endDate: end,
      },
      summary: {
        totalTransactions: transactions.length,
        successfulPayments: successfulPayments.length,
        failedPayments: failedPayments.length,
        refunds: refunds.length,
        totalSuccessfulAmount: totalSuccessful,
        totalFailedAmount: totalFailed,
        totalRefundedAmount: totalRefunded,
        netRevenue: totalSuccessful - totalRefunded,
      },
      byPaymentMethod,
      transactions: transactions.map((t) => ({
        transactionId: t.transactionId,
        bookingId: (t.bookingId as any)?.bookingNumber || t.bookingId,
        userId: (t.userId as any)?._id || t.userId,
        userName: (t.userId as any)?.name || 'N/A',
        userEmail: (t.userId as any)?.email || 'N/A',
        transactionType: t.transactionType,
        amount: t.amount,
        currency: t.currency,
        paymentMethod: t.paymentMethod,
        gateway: t.gateway,
        status: t.status,
        gatewayTransactionId: t.gatewayTransactionId || 'N/A',
        gatewayPaymentIntentId: t.gatewayPaymentIntentId || 'N/A',
        gatewayOrderId: t.gatewayOrderId || 'N/A',
        receiptNumber: t.receiptNumber || 'N/A',
        createdAt: t.createdAt,
        completedAt: t.completedAt,
        failedAt: t.failedAt,
        refundedAt: t.refundedAt,
      })),
    };

    // If CSV format requested, generate CSV
    if (format === 'csv') {
      const csv = generateReconciliationCSV(reconciliationData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="reconciliation-${start.toISOString().split('T')[0]}-to-${end.toISOString().split('T')[0]}.csv"`
      );
      res.send(csv);
      return;
    }

    // Return JSON format
    res.status(200).json({
      success: true,
      data: reconciliationData,
    });
  } catch (error: any) {
    logPaymentError(error, {
      endpoint: 'getReconciliationReport',
      userId: req.user?._id?.toString(),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate reconciliation report',
    });
  }
};

/**
 * Sync payment status with gateway
 * @route POST /api/payments/sync-status
 * 
 * Requirements: 13.6, 13.7
 */
export const syncPaymentStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      res.status(400).json({
        success: false,
        error: 'Transaction ID is required',
      });
      return;
    }

    // Find the transaction
    const transaction = await PaymentTransaction.findOne({ transactionId });

    if (!transaction) {
      res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
      return;
    }

    let gatewayStatus: string | null = null;
    let statusMismatch = false;
    let gatewayDetails: any = {};

    // Query gateway for current status
    try {
      switch (transaction.gateway) {
        case 'khalti':
          if (transaction.gatewayPaymentToken) {
            const khaltiVerification = await khaltiService.verifyPayment(
              transaction.gatewayPaymentToken
            );
            gatewayStatus = khaltiVerification.status === 'Completed' ? 'completed' : 'failed';
            gatewayDetails = khaltiVerification;
          }
          break;

        case 'stripe':
          if (transaction.gatewayPaymentIntentId) {
            const stripeStatus = await stripeService.getPaymentIntentStatus(
              transaction.gatewayPaymentIntentId
            );
            gatewayStatus = stripeStatus.status;
            gatewayDetails = stripeStatus;
          }
          break;

        case 'paypal':
          if (transaction.gatewayOrderId) {
            const paypalStatus = await paypalService.getOrderStatus(
              transaction.gatewayOrderId
            );
            gatewayStatus = paypalStatus.status;
            gatewayDetails = paypalStatus;
          }
          break;
      }

      // Check for status mismatch
      if (gatewayStatus && gatewayStatus !== transaction.status) {
        statusMismatch = true;

        // Log the mismatch
        await auditLogService.logPaymentStatusMismatch({
          transactionId: transaction.transactionId,
          localStatus: transaction.status,
          gatewayStatus,
          gateway: transaction.gateway,
          userId: req.user?._id?.toString(),
        });
      }

      res.status(200).json({
        success: true,
        data: {
          transactionId: transaction.transactionId,
          localStatus: transaction.status,
          gatewayStatus: gatewayStatus || 'unknown',
          statusMismatch,
          gatewayDetails,
          message: statusMismatch
            ? 'Status mismatch detected. Please review and reconcile manually.'
            : 'Status is in sync with gateway.',
        },
      });
    } catch (gatewayError: any) {
      // Gateway query failed
      res.status(200).json({
        success: true,
        data: {
          transactionId: transaction.transactionId,
          localStatus: transaction.status,
          gatewayStatus: 'error',
          statusMismatch: false,
          error: 'Failed to query gateway status',
          message: gatewayError.message,
        },
      });
    }
  } catch (error: any) {
    logPaymentError(error, {
      endpoint: 'syncPaymentStatus',
      userId: req.user?._id?.toString(),
      transactionId: req.body.transactionId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to sync payment status',
    });
  }
};

/**
 * Helper function to generate CSV from reconciliation data
 */
function generateReconciliationCSV(data: any): string {
  const headers = [
    'Transaction ID',
    'Booking ID',
    'User Name',
    'User Email',
    'Type',
    'Amount',
    'Currency',
    'Payment Method',
    'Gateway',
    'Status',
    'Gateway Transaction ID',
    'Gateway Payment Intent ID',
    'Gateway Order ID',
    'Receipt Number',
    'Created At',
    'Completed At',
    'Failed At',
    'Refunded At',
  ];

  const rows = data.transactions.map((t: any) => [
    t.transactionId,
    t.bookingId,
    t.userName,
    t.userEmail,
    t.transactionType,
    t.amount,
    t.currency,
    t.paymentMethod,
    t.gateway,
    t.status,
    t.gatewayTransactionId,
    t.gatewayPaymentIntentId,
    t.gatewayOrderId,
    t.receiptNumber,
    t.createdAt,
    t.completedAt || '',
    t.failedAt || '',
    t.refundedAt || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row: any[]) =>
      row.map((cell) => `"${cell}"`).join(',')
    ),
  ].join('\n');

  return csvContent;
}

/**
 * Test webhook trigger for Khalti (sandbox only)
 * @route POST /api/payments/test/webhook/khalti
 * 
 * Requirements: 19.6
 */
export const triggerTestKhaltiWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Only allow in sandbox mode
    if (process.env.PAYMENT_MODE !== 'sandbox') {
      res.status(403).json({
        success: false,
        error: 'Test webhooks are only available in sandbox mode',
      });
      return;
    }

    const { transactionId, status } = req.body;

    if (!transactionId) {
      res.status(400).json({
        success: false,
        error: 'Transaction ID is required',
      });
      return;
    }

    // Find the transaction
    const transaction = await PaymentTransaction.findOne({ transactionId });

    if (!transaction) {
      res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
      return;
    }

    // Create test webhook payload
    const testPayload = {
      event: status === 'success' ? 'payment.success' : 'payment.failed',
      pidx: transaction.gatewayPaymentToken,
      transaction_id: `TEST_${Date.now()}`,
      amount: transaction.amount * 100, // Convert to paisa
      status: status === 'success' ? 'Completed' : 'Failed',
      test_mode: true,
    };

    // Process the webhook
    await processKhaltiWebhookAsync(testPayload);

    res.status(200).json({
      success: true,
      message: 'Test webhook triggered successfully',
      data: {
        transactionId,
        webhookStatus: status,
        payload: testPayload,
      },
    });
  } catch (error: any) {
    logPaymentError(error, {
      endpoint: 'triggerTestKhaltiWebhook',
      transactionId: req.body.transactionId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to trigger test webhook',
    });
  }
};

/**
 * Test webhook trigger for Stripe (sandbox only)
 * @route POST /api/payments/test/webhook/stripe
 * 
 * Requirements: 19.6
 */
export const triggerTestStripeWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Only allow in sandbox mode
    if (process.env.PAYMENT_MODE !== 'sandbox') {
      res.status(403).json({
        success: false,
        error: 'Test webhooks are only available in sandbox mode',
      });
      return;
    }

    const { transactionId, eventType } = req.body;

    if (!transactionId) {
      res.status(400).json({
        success: false,
        error: 'Transaction ID is required',
      });
      return;
    }

    // Find the transaction
    const transaction = await PaymentTransaction.findOne({ transactionId });

    if (!transaction) {
      res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
      return;
    }

    // Create test webhook payload
    const testPayload = {
      id: `evt_test_${Date.now()}`,
      type: eventType || 'payment_intent.succeeded',
      data: {
        object: {
          id: transaction.gatewayPaymentIntentId,
          amount: transaction.amount * 100, // Convert to cents
          currency: transaction.currency.toLowerCase(),
          status: eventType === 'payment_intent.payment_failed' ? 'failed' : 'succeeded',
          charges: {
            data: [
              {
                id: `ch_test_${Date.now()}`,
                amount: transaction.amount * 100,
              },
            ],
          },
        },
      },
      test_mode: true,
    };

    // Process the webhook (skip signature validation for test)
    const payload = JSON.stringify(testPayload);
    await processStripeWebhookAsync(payload, 'test_signature');

    res.status(200).json({
      success: true,
      message: 'Test webhook triggered successfully',
      data: {
        transactionId,
        eventType: testPayload.type,
        payload: testPayload,
      },
    });
  } catch (error: any) {
    logPaymentError(error, {
      endpoint: 'triggerTestStripeWebhook',
      transactionId: req.body.transactionId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to trigger test webhook',
    });
  }
};

/**
 * Test webhook trigger for PayPal (sandbox only)
 * @route POST /api/payments/test/webhook/paypal
 * 
 * Requirements: 19.6
 */
export const triggerTestPayPalWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Only allow in sandbox mode
    if (process.env.PAYMENT_MODE !== 'sandbox') {
      res.status(403).json({
        success: false,
        error: 'Test webhooks are only available in sandbox mode',
      });
      return;
    }

    const { transactionId, eventType } = req.body;

    if (!transactionId) {
      res.status(400).json({
        success: false,
        error: 'Transaction ID is required',
      });
      return;
    }

    // Find the transaction
    const transaction = await PaymentTransaction.findOne({ transactionId });

    if (!transaction) {
      res.status(404).json({
        success: false,
        error: 'Transaction not found',
      });
      return;
    }

    // Create test webhook payload
    const testPayload = {
      id: `WH-TEST-${Date.now()}`,
      event_type: eventType || 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: transaction.gatewayCaptureId || `CAPTURE_TEST_${Date.now()}`,
        amount: {
          value: transaction.amount.toString(),
          currency_code: transaction.currency,
        },
        status: eventType === 'PAYMENT.CAPTURE.REFUNDED' ? 'REFUNDED' : 'COMPLETED',
      },
      test_mode: true,
    };

    // Process the webhook
    await processPayPalWebhookAsync(testPayload);

    res.status(200).json({
      success: true,
      message: 'Test webhook triggered successfully',
      data: {
        transactionId,
        eventType: testPayload.event_type,
        payload: testPayload,
      },
    });
  } catch (error: any) {
    logPaymentError(error, {
      endpoint: 'triggerTestPayPalWebhook',
      transactionId: req.body.transactionId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to trigger test webhook',
    });
  }
};
