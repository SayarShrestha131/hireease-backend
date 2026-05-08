import mongoose from 'mongoose';
import crypto from 'crypto';
import Booking, { IBooking } from '../models/Booking';
import PaymentTransaction, { IPaymentTransaction, PaymentMethod, PaymentGateway } from '../models/PaymentTransaction';
import khaltiService, { KhaltiService } from './khaltiService';
import stripeService, { StripeService } from './stripeService';
import paypalService, { PayPalService } from './paypalService';
import esewaService, { EsewaService } from './esewaService';
import receiptService, { ReceiptService } from './receiptService';
import auditLogService from './auditLogService';
import notificationService from './notificationService';
import gatewayConfig from '../config/paymentGateway';

/**
 * Payment Initiation Result
 */
export interface PaymentInitiationResult {
  transactionId: string;
  paymentUrl?: string; // For Khalti and PayPal redirect
  clientSecret?: string; // For Stripe client-side confirmation
  expiresAt: Date;
  gateway: PaymentGateway;
  amount: number;
  currency: string;
}

/**
 * Payment Verification Result
 */
export interface PaymentVerificationResult {
  success: boolean;
  paymentStatus: 'completed' | 'failed' | 'processing';
  bookingId: string;
  transactionId: string;
  amount: number;
  gatewayTransactionId?: string;
  errorMessage?: string;
}

/**
 * Refund Result
 */
export interface RefundResult {
  success: boolean;
  refundId: string;
  refundStatus: 'processing' | 'completed' | 'failed';
  refundAmount: number;
  originalTransactionId: string;
  errorMessage?: string;
}

/**
 * Payment History Filters
 */
export interface PaymentHistoryFilters {
  page?: number;
  limit?: number;
  status?: 'completed' | 'failed' | 'refunded';
  paymentMethod?: PaymentMethod;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Payment History Result
 */
export interface PaymentHistoryResult {
  transactions: IPaymentTransaction[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    totalPaid: number;
    totalRefunded: number;
  };
}

/**
 * PaymentService - Unified orchestration layer for payment processing
 * 
 * Implements strategy pattern to select appropriate gateway service based on payment method.
 * Handles payment initiation, verification, refunds, and payment history.
 * 
 * Requirements: 4.1, 4.9, 5.1, 5.2, 5.3, 12.1, 12.2, 14.1, 14.6
 */
export class PaymentService {
  private khaltiService: KhaltiService;
  private stripeService: StripeService;
  private paypalService: PayPalService;
  private esewaService: EsewaService;
  private receiptService: ReceiptService;

  constructor() {
    this.khaltiService = khaltiService;
    this.stripeService = stripeService;
    this.paypalService = paypalService;
    this.esewaService = esewaService;
    this.receiptService = receiptService;
  }

  /**
   * Initiate payment for a booking
   * 
   * Strategy pattern: Selects appropriate gateway service based on payment method
   * 
   * @param bookingId - Booking ID to process payment for
   * @param paymentMethod - Selected payment method (khalti, stripe, paypal)
   * @param returnUrl - Frontend URL for redirect after payment
   * @param userId - User ID making the payment
   * @returns Payment initiation result with payment URL or client secret
   * 
   * Requirements: 4.1, 4.9, 5.1, 5.2, 5.3, 12.1, 12.2, 14.1, 14.6
   */
  async initiatePayment(
    bookingId: string,
    paymentMethod: PaymentMethod,
    returnUrl: string,
    userId: string
  ): Promise<PaymentInitiationResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Validate booking exists and is in pending status
      const booking = await Booking.findOne({ bookingId }).session(session);
      
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (booking.status !== 'pending') {
        throw new Error(`Booking is not in pending status. Current status: ${booking.status}`);
      }

      if (booking.userId.toString() !== userId) {
        throw new Error('Unauthorized: Booking does not belong to this user');
      }

      // 2. Check retry count limit (max 5 attempts)
      if (booking.paymentRetryCount >= 5) {
        throw new Error('Maximum payment retry attempts reached. Please create a new booking.');
      }

      // 3. Validate payment amount matches booking total price
      const bookingAmount = booking.priceBreakdown.totalPrice;
      
      if (bookingAmount <= 0) {
        throw new Error('Invalid booking amount');
      }

      // 4. Determine currency based on payment method
      const currency = (paymentMethod === 'khalti' || paymentMethod === 'esewa') ? 'NPR' : 'USD';

      // 5. Generate unique idempotency key and transaction ID
      const idempotencyKey = this.generateIdempotencyKey(bookingId, paymentMethod);
      const transactionId = this.generateTransactionId();

      // 6. Create Payment_Transaction record with status 'pending'
      const transaction = new PaymentTransaction({
        transactionId,
        bookingId: booking._id,
        userId: new mongoose.Types.ObjectId(userId),
        transactionType: 'payment',
        amount: bookingAmount,
        currency,
        paymentMethod,
        gateway: paymentMethod, // Gateway matches payment method
        status: 'pending',
        idempotencyKey,
        retryCount: booking.paymentRetryCount,
        initiatedAt: new Date(),
        gatewayMetadata: {},
      });

      await transaction.save({ session });

      // 7. Update booking with payment transaction reference and retry count
      booking.paymentTransactionId = transaction._id;
      booking.paymentGateway = paymentMethod;
      booking.paymentRetryCount += 1;
      booking.paymentMethod = paymentMethod;

      // 8. Delegate to appropriate gateway service (Strategy Pattern)
      let paymentUrl: string | undefined;
      let clientSecret: string | undefined;
      let expiresAt: Date;
      let gatewayMetadata: any = {};

      switch (paymentMethod) {
        case 'khalti': {
          // Khalti: Amount in paisa (smallest unit)
          const amountInPaisa = Math.round(bookingAmount * 100);
          
          const khaltiResponse = await this.khaltiService.createPaymentRequest(
            amountInPaisa,
            bookingId,
            returnUrl
          );

          paymentUrl = khaltiResponse.payment_url;
          expiresAt = khaltiResponse.expires_at;
          
          gatewayMetadata = {
            pidx: khaltiResponse.pidx,
            expires_in: khaltiResponse.expires_in,
          };

          // Store Khalti-specific data
          transaction.gatewayPaymentToken = khaltiResponse.pidx;
          break;
        }

        case 'stripe': {
          // Stripe: Amount in smallest currency unit (cents for USD, paisa for NPR)
          const amountInSmallestUnit = Math.round(bookingAmount * 100);
          
          const stripeResponse = await this.stripeService.createPaymentIntent(
            amountInSmallestUnit,
            currency,
            {
              bookingId,
              userId,
              transactionId: transaction.transactionId,
            }
          );

          clientSecret = stripeResponse.clientSecret;
          expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
          
          gatewayMetadata = {
            paymentIntentId: stripeResponse.paymentIntentId,
            status: stripeResponse.status,
          };

          // Store Stripe-specific data
          transaction.gatewayPaymentIntentId = stripeResponse.paymentIntentId;
          break;
        }

        case 'paypal': {
          const paypalResponse = await this.paypalService.createOrder(
            bookingAmount,
            currency,
            bookingId
          );

          paymentUrl = paypalResponse.approvalUrl;
          expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000); // 3 hours
          
          gatewayMetadata = {
            orderId: paypalResponse.orderId,
            status: paypalResponse.status,
          };

          // Store PayPal-specific data
          transaction.gatewayOrderId = paypalResponse.orderId;
          break;
        }

        case 'esewa': {
          // eSewa: Amount in NPR (Nepali Rupees)
          const esewaResponse = await this.esewaService.createPaymentRequest(
            bookingAmount,
            bookingId,
            returnUrl,
            returnUrl // Use same URL for failure (we'll handle it in verification)
          );

          paymentUrl = esewaResponse.paymentUrl;
          expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
          
          gatewayMetadata = {
            transactionUuid: esewaResponse.transactionUuid,
            productCode: esewaResponse.productCode,
          };

          // Store eSewa-specific data
          transaction.gatewayPaymentToken = esewaResponse.transactionUuid;
          break;
        }

        default:
          throw new Error(`Unsupported payment method: ${paymentMethod}`);
      }

      // 9. Update transaction with gateway metadata and expiration
      transaction.gatewayMetadata = gatewayMetadata;
      transaction.status = 'processing';
      booking.paymentExpiresAt = expiresAt;

      await transaction.save({ session });
      await booking.save({ session });

      // 10. Commit transaction
      await session.commitTransaction();

      // 11. Log payment initiation for audit (Requirements: 4.8, 17.8)
      console.log(`[PaymentService] Payment initiated - Transaction: ${transaction.transactionId}, Booking: ${bookingId}, Method: ${paymentMethod}, Amount: ${bookingAmount} ${currency}`);
      
      await auditLogService.logPaymentAttempt({
        userId,
        bookingId,
        amount: bookingAmount,
        currency,
        paymentMethod,
      });

      return {
        transactionId: transaction.transactionId,
        paymentUrl,
        clientSecret,
        expiresAt,
        gateway: paymentMethod,
        amount: bookingAmount,
        currency,
      };
    } catch (error: any) {
      await session.abortTransaction();
      
      // Log error for audit
      console.error(`[PaymentService] Payment initiation failed - Booking: ${bookingId}, Method: ${paymentMethod}, Error: ${error.message}`);
      
      throw new Error(this.getUserFriendlyErrorMessage(error));
    } finally {
      session.endSession();
    }
  }

  /**
   * Verify payment completion
   * 
   * @param transactionId - Internal transaction ID
   * @param gatewayData - Gateway-specific verification data
   * @returns Payment verification result
   * 
   * Requirements: 1.4, 1.5, 1.6, 1.7, 4.1, 5.3, 5.4, 5.5, 14.2
   */
  async verifyPayment(
    transactionId: string,
    gatewayData: any
  ): Promise<PaymentVerificationResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Retrieve Payment_Transaction record
      const transaction = await PaymentTransaction.findOne({ transactionId }).session(session);
      
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      if (transaction.status === 'completed') {
        // Already completed, return success (idempotent)
        await session.commitTransaction();
        return {
          success: true,
          paymentStatus: 'completed',
          bookingId: (await Booking.findById(transaction.bookingId))?.bookingId || '',
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          gatewayTransactionId: transaction.gatewayTransactionId,
        };
      }

      // 2. Verify with originating gateway using appropriate service
      let isSuccess = false;
      let gatewayTransactionId: string | undefined;
      let gatewayMetadata: any = {};
      let errorMessage: string | undefined;

      switch (transaction.gateway) {
        case 'khalti': {
          const pidx = gatewayData.pidx || transaction.gatewayPaymentToken;
          
          if (!pidx) {
            throw new Error('Missing Khalti payment index (pidx)');
          }

          const khaltiVerification = await this.khaltiService.verifyPayment(pidx);
          
          isSuccess = khaltiVerification.status === 'Completed';
          gatewayTransactionId = khaltiVerification.transaction_id;
          gatewayMetadata = {
            pidx: khaltiVerification.pidx,
            total_amount: khaltiVerification.total_amount,
            fee: khaltiVerification.fee,
            refunded: khaltiVerification.refunded,
          };

          if (!isSuccess) {
            errorMessage = `Khalti payment status: ${khaltiVerification.status}`;
          }
          break;
        }

        case 'stripe': {
          const paymentIntentId = gatewayData.paymentIntentId || transaction.gatewayPaymentIntentId;
          
          if (!paymentIntentId) {
            throw new Error('Missing Stripe payment intent ID');
          }

          // Stripe verification is handled via webhook, but we can also verify directly
          const stripeInstance = this.stripeService.getStripeInstance();
          const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId);
          
          isSuccess = paymentIntent.status === 'succeeded';
          gatewayTransactionId = paymentIntent.id;
          gatewayMetadata = {
            paymentIntentId: paymentIntent.id,
            chargeId: paymentIntent.latest_charge,
            paymentMethodId: paymentIntent.payment_method,
            status: paymentIntent.status,
          };

          // Store Stripe-specific IDs
          transaction.gatewayChargeId = paymentIntent.latest_charge as string;
          transaction.gatewayPaymentIntentId = paymentIntent.id;

          if (!isSuccess) {
            errorMessage = `Stripe payment status: ${paymentIntent.status}`;
          }
          break;
        }

        case 'paypal': {
          const orderId = gatewayData.orderId || transaction.gatewayOrderId;
          
          if (!orderId) {
            throw new Error('Missing PayPal order ID');
          }

          // Capture the PayPal order
          const paypalCapture = await this.paypalService.captureOrder(orderId);
          
          isSuccess = paypalCapture.status === 'COMPLETED';
          gatewayTransactionId = paypalCapture.captureId;
          gatewayMetadata = {
            orderId: paypalCapture.orderId,
            captureId: paypalCapture.captureId,
            payerId: paypalCapture.payerId,
            status: paypalCapture.status,
          };

          // Store PayPal-specific IDs
          transaction.gatewayCaptureId = paypalCapture.captureId;
          transaction.gatewayPayerId = paypalCapture.payerId;

          if (!isSuccess) {
            errorMessage = `PayPal payment status: ${paypalCapture.status}`;
          }
          break;
        }

        default:
          throw new Error(`Unsupported gateway: ${transaction.gateway}`);
      }

      // 3. Update Payment_Transaction status
      transaction.gatewayTransactionId = gatewayTransactionId;
      transaction.gatewayMetadata = { ...transaction.gatewayMetadata, ...gatewayMetadata };

      if (isSuccess) {
        transaction.status = 'completed';
        transaction.completedAt = new Date();
      } else {
        transaction.status = 'failed';
        transaction.failedAt = new Date();
        transaction.errorMessage = errorMessage;
      }

      await transaction.save({ session });

      // 4. Update Booking status and paymentStatus accordingly
      const booking = await Booking.findById(transaction.bookingId).session(session);
      
      if (!booking) {
        throw new Error('Booking not found');
      }

      if (isSuccess) {
        booking.status = 'confirmed';
        booking.paymentStatus = 'completed';
        booking.paymentId = gatewayTransactionId;
        booking.paidAt = new Date();

        // Mark previous failed attempts as superseded
        await PaymentTransaction.updateMany(
          {
            bookingId: booking._id,
            _id: { $ne: transaction._id },
            status: 'failed',
          },
          {
            $set: {
              errorMessage: 'Superseded by successful payment',
            },
          }
        ).session(session);
      } else {
        booking.paymentStatus = 'failed';
      }

      await booking.save({ session });

      // 5. Commit transaction
      await session.commitTransaction();

      // 6. Generate digital receipt for successful payment (after commit)
      if (isSuccess) {
        try {
          // Populate user and vehicle for receipt generation
          const populatedBooking = await Booking.findById(booking._id)
            .populate('userId')
            .populate('vehicleId')
            .lean();

          if (populatedBooking) {
            const receiptPath = await this.receiptService.generateReceipt(
              transaction,
              populatedBooking as any
            );

            // Extract receipt number from the generated file path
            const receiptFileName = receiptPath.split(/[/\\]/).pop() || '';
            const receiptNumber = receiptFileName.replace('.pdf', '');

            // Update transaction with receipt information
            transaction.receiptNumber = receiptNumber;
            transaction.receiptPath = receiptPath;
            await transaction.save();

            console.log(`[PaymentService] Receipt generated for transaction: ${transactionId}`);
          }
        } catch (receiptError: any) {
          // Log error but don't fail the payment verification
          console.error(`[PaymentService] Failed to generate receipt for transaction ${transactionId}:`, receiptError.message);
        }
      }

      // 7. Log verification result for audit (Requirements: 4.8, 17.8)
      console.log(`[PaymentService] Payment verification - Transaction: ${transactionId}, Status: ${isSuccess ? 'completed' : 'failed'}, Gateway TxnID: ${gatewayTransactionId}`);

      if (isSuccess) {
        await auditLogService.logPaymentSuccess({
          userId: booking.userId.toString(),
          bookingId: booking.bookingId,
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          currency: transaction.currency,
          paymentMethod: transaction.paymentMethod,
          gatewayResponse: gatewayMetadata,
        });
      } else {
        await auditLogService.logPaymentFailure({
          userId: booking.userId.toString(),
          bookingId: booking.bookingId,
          transactionId: transaction.transactionId,
          amount: transaction.amount,
          currency: transaction.currency,
          paymentMethod: transaction.paymentMethod,
          errorMessage: errorMessage || 'Payment verification failed',
          gatewayResponse: gatewayMetadata,
        });
      }

      // 8. Send email notifications (Requirements: 16.1, 16.2, 16.3, 16.4)
      try {
        // Populate user data for email
        const populatedBooking = await Booking.findById(booking._id).populate('userId').lean();
        const user = populatedBooking?.userId as any;

        if (user && user.email) {
          if (isSuccess) {
            // Send payment confirmation email
            const receiptUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/api/payments/receipt/${booking.bookingId}`;
            
            await notificationService.sendPaymentConfirmation({
              bookingId: booking.bookingId,
              amount: transaction.amount,
              currency: transaction.currency,
              transactionId: transaction.transactionId,
              receiptUrl,
              userName: user.name || user.email,
              userEmail: user.email,
              paymentMethod: transaction.paymentMethod,
              paymentDate: transaction.completedAt || new Date(),
            });
          } else {
            // Send payment failure email
            await notificationService.sendPaymentFailure({
              bookingId: booking.bookingId,
              amount: transaction.amount,
              currency: transaction.currency,
              errorMessage: errorMessage || 'Payment verification failed',
              userName: user.name || user.email,
              userEmail: user.email,
              paymentMethod: transaction.paymentMethod,
              attemptDate: transaction.failedAt || new Date(),
            });
          }
        }
      } catch (emailError: any) {
        // Log error but don't fail the payment verification
        console.error(`[PaymentService] Failed to send email notification for transaction ${transactionId}:`, emailError.message);
      }

      return {
        success: isSuccess,
        paymentStatus: isSuccess ? 'completed' : 'failed',
        bookingId: booking.bookingId,
        transactionId: transaction.transactionId,
        amount: transaction.amount,
        gatewayTransactionId,
        errorMessage,
      };
    } catch (error: any) {
      await session.abortTransaction();
      
      // Log error for audit
      console.error(`[PaymentService] Payment verification failed - Transaction: ${transactionId}, Error: ${error.message}`);
      
      throw new Error(this.getUserFriendlyErrorMessage(error));
    } finally {
      session.endSession();
    }
  }

  /**
   * Refund payment for a booking
   * 
   * @param bookingId - Booking ID to refund
   * @param reason - Refund reason
   * @param partialAmount - Optional partial refund amount
   * @returns Refund result
   * 
   * Requirements: 7.1, 7.2, 7.6, 7.7, 7.9, 14.4
   */
  async refundPayment(
    bookingId: string,
    reason: string,
    partialAmount?: number
  ): Promise<RefundResult> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Retrieve booking
      const booking = await Booking.findOne({ bookingId }).session(session);
      
      if (!booking) {
        throw new Error('Booking not found');
      }

      // 2. Validate booking has completed payment
      if (booking.paymentStatus !== 'completed') {
        throw new Error(`Cannot refund booking with payment status: ${booking.paymentStatus}`);
      }

      // 3. Retrieve original Payment_Transaction
      const originalTransaction = await PaymentTransaction.findOne({
        bookingId: booking._id,
        transactionType: 'payment',
        status: 'completed',
      }).session(session);

      if (!originalTransaction) {
        throw new Error('Original payment transaction not found');
      }

      // 4. Determine refund amount
      const refundAmount = partialAmount || originalTransaction.amount;

      if (refundAmount > originalTransaction.amount) {
        throw new Error('Refund amount cannot exceed original payment amount');
      }

      if (refundAmount <= 0) {
        throw new Error('Refund amount must be greater than zero');
      }

      // 5. Create new Payment_Transaction record with type 'refund'
      const idempotencyKey = this.generateIdempotencyKey(bookingId, originalTransaction.gateway, 'refund');

      const refundTransaction = new PaymentTransaction({
        bookingId: booking._id,
        userId: booking.userId,
        transactionType: 'refund',
        amount: refundAmount,
        currency: originalTransaction.currency,
        paymentMethod: originalTransaction.paymentMethod,
        gateway: originalTransaction.gateway,
        status: 'processing',
        idempotencyKey,
        retryCount: 0,
        initiatedAt: new Date(),
        gatewayMetadata: {
          originalTransactionId: originalTransaction.transactionId,
          reason,
        },
      });

      await refundTransaction.save({ session });

      // 6. Delegate to appropriate gateway service for refund
      let refundSuccess = false;
      let gatewayRefundId: string | undefined;
      let gatewayMetadata: any = {};
      let errorMessage: string | undefined;

      switch (originalTransaction.gateway) {
        case 'khalti': {
          if (!originalTransaction.gatewayTransactionId) {
            throw new Error('Missing Khalti transaction ID for refund');
          }

          const amountInPaisa = Math.round(refundAmount * 100);
          const khaltiRefund = await this.khaltiService.refund(
            originalTransaction.gatewayTransactionId,
            amountInPaisa
          );

          refundSuccess = khaltiRefund.status === 'Completed';
          gatewayRefundId = khaltiRefund.idx;
          gatewayMetadata = {
            idx: khaltiRefund.idx,
            amount: khaltiRefund.amount,
            status: khaltiRefund.status,
          };

          if (!refundSuccess) {
            errorMessage = `Khalti refund status: ${khaltiRefund.status}`;
          }
          break;
        }

        case 'stripe': {
          if (!originalTransaction.gatewayChargeId) {
            throw new Error('Missing Stripe charge ID for refund');
          }

          const amountInSmallestUnit = partialAmount ? Math.round(refundAmount * 100) : undefined;
          const stripeRefund = await this.stripeService.refund(
            originalTransaction.gatewayChargeId,
            amountInSmallestUnit
          );

          refundSuccess = stripeRefund.status === 'succeeded';
          gatewayRefundId = stripeRefund.refundId;
          gatewayMetadata = {
            refundId: stripeRefund.refundId,
            chargeId: stripeRefund.chargeId,
            amount: stripeRefund.amount,
            status: stripeRefund.status,
          };

          if (!refundSuccess) {
            errorMessage = `Stripe refund status: ${stripeRefund.status}`;
          }
          break;
        }

        case 'paypal': {
          if (!originalTransaction.gatewayCaptureId) {
            throw new Error('Missing PayPal capture ID for refund');
          }

          const paypalRefund = await this.paypalService.refund(
            originalTransaction.gatewayCaptureId,
            partialAmount,
            originalTransaction.currency
          );

          refundSuccess = paypalRefund.status === 'COMPLETED';
          gatewayRefundId = paypalRefund.refundId;
          gatewayMetadata = {
            refundId: paypalRefund.refundId,
            captureId: paypalRefund.captureId,
            amount: paypalRefund.amount,
            status: paypalRefund.status,
          };

          if (!refundSuccess) {
            errorMessage = `PayPal refund status: ${paypalRefund.status}`;
          }
          break;
        }

        default:
          throw new Error(`Unsupported gateway for refund: ${originalTransaction.gateway}`);
      }

      // 7. Update refund transaction
      refundTransaction.gatewayTransactionId = gatewayRefundId;
      refundTransaction.gatewayMetadata = { ...refundTransaction.gatewayMetadata, ...gatewayMetadata };

      if (refundSuccess) {
        refundTransaction.status = 'completed';
        refundTransaction.completedAt = new Date();
      } else {
        refundTransaction.status = 'failed';
        refundTransaction.failedAt = new Date();
        refundTransaction.errorMessage = errorMessage;
      }

      await refundTransaction.save({ session });

      // 8. Update Booking paymentStatus to 'refunded' on success
      if (refundSuccess) {
        booking.paymentStatus = 'refunded';
        await booking.save({ session });
      }

      // 9. Commit transaction
      await session.commitTransaction();

      // 10. Log refund for audit (Requirements: 4.8, 17.8)
      console.log(`[PaymentService] Refund ${refundSuccess ? 'completed' : 'failed'} - Booking: ${bookingId}, Amount: ${refundAmount}, Gateway RefundID: ${gatewayRefundId}`);

      if (refundSuccess) {
        await auditLogService.logRefundSuccess({
          userId: booking.userId.toString(),
          bookingId,
          transactionId: originalTransaction.transactionId,
          refundId: refundTransaction.transactionId,
          amount: refundAmount,
          currency: originalTransaction.currency,
          gateway: originalTransaction.gateway,
          gatewayResponse: gatewayMetadata,
        });
      } else {
        await auditLogService.logRefundFailure({
          userId: booking.userId.toString(),
          bookingId,
          transactionId: originalTransaction.transactionId,
          amount: refundAmount,
          currency: originalTransaction.currency,
          gateway: originalTransaction.gateway,
          errorMessage: errorMessage || 'Refund processing failed',
        });
      }

      return {
        success: refundSuccess,
        refundId: refundTransaction.transactionId,
        refundStatus: refundSuccess ? 'completed' : 'failed',
        refundAmount,
        originalTransactionId: originalTransaction.transactionId,
        errorMessage,
      };
    } catch (error: any) {
      await session.abortTransaction();
      
      // Log error for audit
      console.error(`[PaymentService] Refund failed - Booking: ${bookingId}, Error: ${error.message}`);
      
      throw new Error(this.getUserFriendlyErrorMessage(error));
    } finally {
      session.endSession();
    }
  }

  /**
   * Get payment history for a user
   * 
   * @param userId - User ID
   * @param filters - Filter parameters
   * @returns Payment history result with transactions and summary
   * 
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
   */
  async getPaymentHistory(
    userId: string,
    filters: PaymentHistoryFilters = {}
  ): Promise<PaymentHistoryResult> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        paymentMethod,
        startDate,
        endDate,
      } = filters;

      // Build query
      const query: any = {
        userId: new mongoose.Types.ObjectId(userId),
      };

      if (status) {
        query.status = status;
      }

      if (paymentMethod) {
        query.paymentMethod = paymentMethod;
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = startDate;
        }
        if (endDate) {
          query.createdAt.$lte = endDate;
        }
      }

      // Get total count
      const total = await PaymentTransaction.countDocuments(query);

      // Query Payment_Transaction with filters and pagination
      const transactions = await PaymentTransaction.find(query)
        .populate('bookingId')
        .sort({ createdAt: -1 }) // Sort by transaction date descending
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      // Calculate total paid and total refunded amounts
      const summary = await PaymentTransaction.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$transactionType',
            total: { $sum: '$amount' },
          },
        },
      ]);

      const totalPaid = summary.find((s) => s._id === 'payment')?.total || 0;
      const totalRefunded = summary.find((s) => s._id === 'refund')?.total || 0;

      return {
        transactions: transactions as any,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
        summary: {
          totalPaid,
          totalRefunded,
        },
      };
    } catch (error: any) {
      console.error(`[PaymentService] Get payment history failed - User: ${userId}, Error: ${error.message}`);
      throw new Error('Failed to retrieve payment history');
    }
  }

  /**
   * Get receipt for a booking
   * 
   * @param bookingId - Booking ID
   * @returns Receipt file path
   * 
   * Requirements: 6.6, 8.7
   */
  async getReceipt(bookingId: string): Promise<{ receiptPath: string; receiptNumber: string }> {
    try {
      // Find booking
      const booking = await Booking.findOne({ bookingId });
      
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Find completed payment transaction with receipt
      const transaction = await PaymentTransaction.findOne({
        bookingId: booking._id,
        transactionType: 'payment',
        status: 'completed',
        receiptPath: { $exists: true, $ne: null },
      });

      if (!transaction || !transaction.receiptPath) {
        throw new Error('Receipt not found for this booking');
      }

      // Verify receipt file exists
      const receiptPath = await this.receiptService.getReceipt(transaction.receiptPath);

      return {
        receiptPath,
        receiptNumber: transaction.receiptNumber || 'N/A',
      };
    } catch (error: any) {
      console.error(`[PaymentService] Get receipt failed - Booking: ${bookingId}, Error: ${error.message}`);
      throw new Error(error.message || 'Failed to retrieve receipt');
    }
  }

  /**
   * Generate unique transaction ID
   * 
   * @returns Unique transaction ID in format TXN-YYYYMMDD-XXXX
   */
  private generateTransactionId(): string {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    return `TXN-${dateStr}-${random}`;
  }

  /**
   * Generate unique idempotency key
   * 
   * @param bookingId - Booking ID
   * @param gateway - Payment gateway
   * @param type - Transaction type (payment or refund)
   * @returns Unique idempotency key
   */
  private generateIdempotencyKey(
    bookingId: string,
    gateway: PaymentGateway,
    type: 'payment' | 'refund' = 'payment'
  ): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    return `${gateway}-${type}-${bookingId}-${timestamp}-${random}`;
  }

  /**
   * Map error to user-friendly message
   * 
   * @param error - Error object
   * @returns User-friendly error message
   */
  private getUserFriendlyErrorMessage(error: any): string {
    const message = error.message || 'An error occurred';

    // Map common error patterns to user-friendly messages
    if (message.includes('insufficient') || message.includes('balance')) {
      return 'Payment failed due to insufficient funds. Please check your account balance and try again.';
    }

    if (message.includes('card') || message.includes('invalid')) {
      return 'Payment failed due to invalid card details. Please verify your payment information and try again.';
    }

    if (message.includes('timeout') || message.includes('network')) {
      return 'Payment failed due to a connection issue. Please check your internet connection and try again.';
    }

    if (message.includes('gateway') || message.includes('service unavailable')) {
      return 'Payment gateway is temporarily unavailable. Please try a different payment method or try again later.';
    }

    if (message.includes('retry') || message.includes('Maximum')) {
      return message; // Already user-friendly
    }

    if (message.includes('not found') || message.includes('Unauthorized')) {
      return message; // Already user-friendly
    }

    // Default error message
    return `Payment processing failed: ${message}. If the issue persists, please contact support.`;
  }
}

export default new PaymentService();
