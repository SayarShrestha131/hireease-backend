import mongoose from 'mongoose';
import { PaymentService } from '../services/paymentService';
import Booking from '../models/Booking';
import PaymentTransaction from '../models/PaymentTransaction';
import khaltiService from '../services/khaltiService';
import stripeService from '../services/stripeService';
import paypalService from '../services/paypalService';

// Mock dependencies
jest.mock('../services/khaltiService');
jest.mock('../services/stripeService');
jest.mock('../services/paypalService');
jest.mock('../models/Booking');
jest.mock('../models/PaymentTransaction');

// Mock gateway config
jest.mock('../config/paymentGateway', () => ({
  __esModule: true,
  default: {
    khalti: {
      enabled: true,
      mode: 'sandbox',
      publicKey: 'test_public_key',
      secretKey: 'test_secret_key',
      webhookSecret: 'test_webhook_secret',
    },
    stripe: {
      enabled: true,
      mode: 'test',
      publicKey: 'test_public_key',
      secretKey: 'test_secret_key',
      webhookSecret: 'test_webhook_secret',
    },
    paypal: {
      enabled: true,
      mode: 'sandbox',
      clientId: 'test_client_id',
      clientSecret: 'test_client_secret',
      webhookId: 'test_webhook_id',
    },
    receiptStoragePath: './receipts',
    rateLimitPerHour: 10,
  },
}));

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockSession: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock mongoose session
    mockSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };


    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

    paymentService = new PaymentService();
  });

  describe('initiatePayment', () => {
    it('should initiate Khalti payment successfully', async () => {
      // Arrange
      const mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        bookingId: 'BK-20241201-1234',
        userId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        status: 'pending',
        paymentRetryCount: 0,
        priceBreakdown: {
          totalPrice: 5000,
        },
        save: jest.fn().mockResolvedValue(true),
      };

      const mockTransaction = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN-20241201-1234',
        save: jest.fn().mockResolvedValue(true),
      };

      (Booking.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      (PaymentTransaction as any).mockImplementation(() => mockTransaction);

      (khaltiService.createPaymentRequest as jest.Mock).mockResolvedValue({
        pidx: 'test_pidx_123',
        payment_url: 'https://test.khalti.com/payment/test_pidx_123',
        expires_at: new Date('2024-12-31T23:59:59Z'),
        expires_in: 3600,
      });

      // Act
      const result = await paymentService.initiatePayment(
        'BK-20241201-1234',
        'khalti',
        'http://localhost:3000/payment/return',
        '507f1f77bcf86cd799439011'
      );

      // Assert
      expect(result).toMatchObject({
        transactionId: 'TXN-20241201-1234',
        paymentUrl: 'https://test.khalti.com/payment/test_pidx_123',
        gateway: 'khalti',
        amount: 5000,
        currency: 'NPR',
      });

      expect(khaltiService.createPaymentRequest).toHaveBeenCalledWith(
        500000, // 5000 NPR in paisa
        'BK-20241201-1234',
        'http://localhost:3000/payment/return'
      );

      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should reject payment for non-pending booking', async () => {
      // Arrange
      const mockBooking = {
        bookingId: 'BK-20241201-5678',
        userId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        status: 'confirmed',
        paymentRetryCount: 0,
      };

      (Booking.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      // Act & Assert
      await expect(
        paymentService.initiatePayment(
          'BK-20241201-5678',
          'khalti',
          'http://localhost:3000/payment/return',
          '507f1f77bcf86cd799439011'
        )
      ).rejects.toThrow('Booking is not in pending status');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should reject payment when retry limit reached', async () => {
      // Arrange
      const mockBooking = {
        bookingId: 'BK-20241201-9999',
        userId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        status: 'pending',
        paymentRetryCount: 5,
      };

      (Booking.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      // Act & Assert
      await expect(
        paymentService.initiatePayment(
          'BK-20241201-9999',
          'khalti',
          'http://localhost:3000/payment/return',
          '507f1f77bcf86cd799439011'
        )
      ).rejects.toThrow('Maximum payment retry attempts reached');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should initiate Stripe payment successfully', async () => {
      // Arrange
      const mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        bookingId: 'BK-20241201-2222',
        userId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        status: 'pending',
        paymentRetryCount: 0,
        priceBreakdown: {
          totalPrice: 100,
        },
        save: jest.fn().mockResolvedValue(true),
      };

      const mockTransaction = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN-20241201-2222',
        save: jest.fn().mockResolvedValue(true),
      };

      (Booking.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      (PaymentTransaction as any).mockImplementation(() => mockTransaction);

      (stripeService.createPaymentIntent as jest.Mock).mockResolvedValue({
        paymentIntentId: 'pi_test_123',
        clientSecret: 'pi_test_123_secret',
        amount: 10000,
        currency: 'usd',
        status: 'requires_payment_method',
      });

      // Act
      const result = await paymentService.initiatePayment(
        'BK-20241201-2222',
        'stripe',
        'http://localhost:3000/payment/return',
        '507f1f77bcf86cd799439011'
      );

      // Assert
      expect(result).toMatchObject({
        transactionId: 'TXN-20241201-2222',
        clientSecret: 'pi_test_123_secret',
        gateway: 'stripe',
        amount: 100,
        currency: 'USD',
      });

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        10000, // 100 USD in cents
        'USD',
        expect.objectContaining({
          bookingId: 'BK-20241201-2222',
        })
      );

      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should initiate PayPal payment successfully', async () => {
      // Arrange
      const mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        bookingId: 'BK-20241201-3333',
        userId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        status: 'pending',
        paymentRetryCount: 0,
        priceBreakdown: {
          totalPrice: 150,
        },
        save: jest.fn().mockResolvedValue(true),
      };

      const mockTransaction = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN-20241201-3333',
        save: jest.fn().mockResolvedValue(true),
      };

      (Booking.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      (PaymentTransaction as any).mockImplementation(() => mockTransaction);

      (paypalService.createOrder as jest.Mock).mockResolvedValue({
        orderId: 'paypal_order_123',
        approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=paypal_order_123',
        status: 'CREATED',
      });

      // Act
      const result = await paymentService.initiatePayment(
        'BK-20241201-3333',
        'paypal',
        'http://localhost:3000/payment/return',
        '507f1f77bcf86cd799439011'
      );

      // Assert
      expect(result).toMatchObject({
        transactionId: 'TXN-20241201-3333',
        paymentUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=paypal_order_123',
        gateway: 'paypal',
        amount: 150,
        currency: 'USD',
      });

      expect(paypalService.createOrder).toHaveBeenCalledWith(
        150,
        'USD',
        'BK-20241201-3333'
      );

      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should reject unauthorized payment attempt', async () => {
      // Arrange
      const mockBooking = {
        bookingId: 'BK-20241201-4444',
        userId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        status: 'pending',
      };

      (Booking.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      // Act & Assert
      await expect(
        paymentService.initiatePayment(
          'BK-20241201-4444',
          'khalti',
          'http://localhost:3000/payment/return',
          '507f1f77bcf86cd799439012' // Different user ID
        )
      ).rejects.toThrow('Unauthorized');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  describe('verifyPayment', () => {
    it('should verify Khalti payment successfully', async () => {
      // Arrange
      const mockTransaction = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN-20241201-1111',
        bookingId: new mongoose.Types.ObjectId(),
        gateway: 'khalti',
        gatewayPaymentToken: 'test_pidx_123',
        amount: 5000,
        status: 'processing',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockBooking = {
        _id: mockTransaction.bookingId,
        bookingId: 'BK-20241201-1111',
        status: 'pending',
        paymentStatus: 'pending',
        save: jest.fn().mockResolvedValue(true),
      };

      (PaymentTransaction.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockTransaction),
      });

      (Booking.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      (PaymentTransaction.updateMany as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue({}),
      });

      (khaltiService.verifyPayment as jest.Mock).mockResolvedValue({
        pidx: 'test_pidx_123',
        total_amount: 500000,
        status: 'Completed',
        transaction_id: 'khalti_txn_123',
        fee: 5000,
        refunded: false,
      });

      // Act
      const result = await paymentService.verifyPayment('TXN-20241201-1111', {
        pidx: 'test_pidx_123',
      });

      // Assert
      expect(result).toMatchObject({
        success: true,
        paymentStatus: 'completed',
        bookingId: 'BK-20241201-1111',
        transactionId: 'TXN-20241201-1111',
        gatewayTransactionId: 'khalti_txn_123',
      });

      expect(mockTransaction.status).toBe('completed');
      expect(mockBooking.status).toBe('confirmed');
      expect(mockBooking.paymentStatus).toBe('completed');
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should handle failed payment verification', async () => {
      // Arrange
      const mockTransaction = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN-20241201-2222',
        bookingId: new mongoose.Types.ObjectId(),
        gateway: 'khalti',
        gatewayPaymentToken: 'test_pidx_failed',
        amount: 5000,
        status: 'processing',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockBooking = {
        _id: mockTransaction.bookingId,
        bookingId: 'BK-20241201-2222',
        status: 'pending',
        paymentStatus: 'pending',
        save: jest.fn().mockResolvedValue(true),
      };

      (PaymentTransaction.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockTransaction),
      });

      (Booking.findById as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      (khaltiService.verifyPayment as jest.Mock).mockResolvedValue({
        pidx: 'test_pidx_failed',
        total_amount: 500000,
        status: 'Expired',
        transaction_id: '',
        fee: 0,
        refunded: false,
      });

      // Act
      const result = await paymentService.verifyPayment('TXN-20241201-2222', {
        pidx: 'test_pidx_failed',
      });

      // Assert
      expect(result).toMatchObject({
        success: false,
        paymentStatus: 'failed',
        bookingId: 'BK-20241201-2222',
      });

      expect(mockTransaction.status).toBe('failed');
      expect(mockBooking.paymentStatus).toBe('failed');
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should return success for already completed payment (idempotent)', async () => {
      // Arrange
      const mockTransaction = {
        transactionId: 'TXN-20241201-3333',
        bookingId: new mongoose.Types.ObjectId(),
        status: 'completed',
        amount: 5000,
        gatewayTransactionId: 'khalti_txn_completed',
      };

      const mockBooking = {
        bookingId: 'BK-20241201-3333',
      };

      (PaymentTransaction.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockTransaction),
      });

      (Booking.findById as jest.Mock).mockResolvedValue(mockBooking);

      // Act
      const result = await paymentService.verifyPayment('TXN-20241201-3333', {});

      // Assert
      expect(result).toMatchObject({
        success: true,
        paymentStatus: 'completed',
        transactionId: 'TXN-20241201-3333',
      });

      expect(mockSession.commitTransaction).toHaveBeenCalled();
      expect(khaltiService.verifyPayment).not.toHaveBeenCalled();
    });
  });

  describe('refundPayment', () => {
    it('should process full refund successfully', async () => {
      // Arrange
      const mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        bookingId: 'BK-20241201-5555',
        userId: new mongoose.Types.ObjectId(),
        paymentStatus: 'completed',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockOriginalTransaction = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN-20241201-5555',
        transactionType: 'payment',
        status: 'completed',
        amount: 5000,
        currency: 'NPR',
        paymentMethod: 'khalti',
        gateway: 'khalti',
        gatewayTransactionId: 'khalti_txn_555',
      };

      const mockRefundTransaction = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN-20241201-5555-REFUND',
        save: jest.fn().mockResolvedValue(true),
      };

      (Booking.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      (PaymentTransaction.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockOriginalTransaction),
      });

      (PaymentTransaction as any).mockImplementation(() => mockRefundTransaction);

      (khaltiService.refund as jest.Mock).mockResolvedValue({
        idx: 'refund_123',
        amount: 500000,
        status: 'Completed',
      });

      // Act
      const result = await paymentService.refundPayment('BK-20241201-5555', 'Customer request');

      // Assert
      expect(result).toMatchObject({
        success: true,
        refundStatus: 'completed',
        refundAmount: 5000,
        originalTransactionId: 'TXN-20241201-5555',
      });

      expect(khaltiService.refund).toHaveBeenCalledWith('khalti_txn_555', 500000);
      expect(mockBooking.paymentStatus).toBe('refunded');
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should reject refund for non-completed payment', async () => {
      // Arrange
      const mockBooking = {
        bookingId: 'BK-20241201-6666',
        paymentStatus: 'pending',
      };

      (Booking.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      // Act & Assert
      await expect(
        paymentService.refundPayment('BK-20241201-6666', 'Test')
      ).rejects.toThrow('Cannot refund booking with payment status: pending');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('should process partial refund successfully', async () => {
      // Arrange
      const mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        bookingId: 'BK-20241201-7777',
        userId: new mongoose.Types.ObjectId(),
        paymentStatus: 'completed',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockOriginalTransaction = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN-20241201-7777',
        transactionType: 'payment',
        status: 'completed',
        amount: 5000,
        currency: 'NPR',
        paymentMethod: 'khalti',
        gateway: 'khalti',
        gatewayTransactionId: 'khalti_txn_777',
      };

      const mockRefundTransaction = {
        _id: new mongoose.Types.ObjectId(),
        transactionId: 'TXN-20241201-7777-REFUND',
        save: jest.fn().mockResolvedValue(true),
      };

      (Booking.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      (PaymentTransaction.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockOriginalTransaction),
      });

      (PaymentTransaction as any).mockImplementation(() => mockRefundTransaction);

      (khaltiService.refund as jest.Mock).mockResolvedValue({
        idx: 'refund_partial_123',
        amount: 250000,
        status: 'Completed',
      });

      // Act
      const result = await paymentService.refundPayment(
        'BK-20241201-7777',
        'Partial refund',
        2500
      );

      // Assert
      expect(result).toMatchObject({
        success: true,
        refundStatus: 'completed',
        refundAmount: 2500,
      });

      expect(khaltiService.refund).toHaveBeenCalledWith('khalti_txn_777', 250000);
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('should reject refund amount exceeding original payment', async () => {
      // Arrange
      const mockBooking = {
        _id: new mongoose.Types.ObjectId(),
        bookingId: 'BK-20241201-8888',
        paymentStatus: 'completed',
      };

      const mockOriginalTransaction = {
        transactionId: 'TXN-20241201-8888',
        amount: 5000,
      };

      (Booking.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockBooking),
      });

      (PaymentTransaction.findOne as jest.Mock).mockReturnValue({
        session: jest.fn().mockResolvedValue(mockOriginalTransaction),
      });

      // Act & Assert
      await expect(
        paymentService.refundPayment('BK-20241201-8888', 'Test', 10000)
      ).rejects.toThrow('Refund amount cannot exceed original payment amount');

      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });
  });

  describe('getPaymentHistory', () => {
    it('should retrieve payment history with pagination', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const mockTransactions = [
        {
          _id: new mongoose.Types.ObjectId(),
          transactionId: 'TXN-1',
          amount: 5000,
          status: 'completed',
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          transactionId: 'TXN-2',
          amount: 3000,
          status: 'completed',
          createdAt: new Date(),
        },
      ];

      (PaymentTransaction.countDocuments as jest.Mock).mockResolvedValue(2);
      (PaymentTransaction.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockTransactions),
      });

      (PaymentTransaction.aggregate as jest.Mock).mockResolvedValue([
        { _id: 'payment', total: 8000 },
        { _id: 'refund', total: 0 },
      ]);

      // Act
      const result = await paymentService.getPaymentHistory(userId, {
        page: 1,
        limit: 20,
      });

      // Assert
      expect(result).toMatchObject({
        transactions: mockTransactions,
        pagination: {
          total: 2,
          page: 1,
          limit: 20,
          totalPages: 1,
        },
        summary: {
          totalPaid: 8000,
          totalRefunded: 0,
        },
      });
    });

    it('should filter payment history by status', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';

      (PaymentTransaction.countDocuments as jest.Mock).mockResolvedValue(1);
      (PaymentTransaction.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      (PaymentTransaction.aggregate as jest.Mock).mockResolvedValue([]);

      // Act
      await paymentService.getPaymentHistory(userId, {
        status: 'completed',
      });

      // Assert
      expect(PaymentTransaction.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
        })
      );
    });

    it('should filter payment history by date range', async () => {
      // Arrange
      const userId = '507f1f77bcf86cd799439011';
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      (PaymentTransaction.countDocuments as jest.Mock).mockResolvedValue(0);
      (PaymentTransaction.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });

      (PaymentTransaction.aggregate as jest.Mock).mockResolvedValue([]);

      // Act
      await paymentService.getPaymentHistory(userId, {
        startDate,
        endDate,
      });

      // Assert
      expect(PaymentTransaction.find).toHaveBeenCalledWith(
        expect.objectContaining({
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        })
      );
    });
  });
});
