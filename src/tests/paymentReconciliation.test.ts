import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import mongoose from 'mongoose';
import {
  getReconciliationReport,
  syncPaymentStatus,
} from '../controllers/paymentController';
import PaymentTransaction from '../models/PaymentTransaction';
import khaltiService from '../services/khaltiService';
import stripeService from '../services/stripeService';
import paypalService from '../services/paypalService';
import auditLogService from '../services/auditLogService';

// Mock dependencies
jest.mock('../models/PaymentTransaction');
jest.mock('../services/khaltiService');
jest.mock('../services/stripeService');
jest.mock('../services/paypalService');
jest.mock('../services/auditLogService');

describe('Payment Reconciliation', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      user: {
        _id: new mongoose.Types.ObjectId(),
        email: 'admin@test.com',
        name: 'Admin User',
      } as any,
      query: {},
      body: {},
      params: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('getReconciliationReport', () => {
    it('should return 400 if startDate or endDate is missing', async () => {
      mockRequest.query = {};

      await getReconciliationReport(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Start date and end date are required',
      });
    });

    it('should return 400 if date format is invalid', async () => {
      mockRequest.query = {
        startDate: 'invalid-date',
        endDate: '2024-01-31',
      };

      await getReconciliationReport(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format',
      });
    });

    it('should generate reconciliation report with valid date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      mockRequest.query = { startDate, endDate };

      // Mock transactions
      const mockTransactions = [
        {
          _id: new mongoose.Types.ObjectId(),
          transactionId: 'TXN-20240115-1234',
          bookingId: { bookingNumber: 'BK-001' },
          userId: { _id: new mongoose.Types.ObjectId(), name: 'John Doe', email: 'john@test.com' },
          transactionType: 'payment',
          amount: 5000,
          currency: 'NPR',
          paymentMethod: 'khalti',
          gateway: 'khalti',
          status: 'completed',
          gatewayTransactionId: 'KHALTI-123',
          receiptNumber: 'RCP-20240115-0001',
          createdAt: new Date('2024-01-15'),
          completedAt: new Date('2024-01-15'),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          transactionId: 'TXN-20240116-5678',
          bookingId: { bookingNumber: 'BK-002' },
          userId: { _id: new mongoose.Types.ObjectId(), name: 'Jane Smith', email: 'jane@test.com' },
          transactionType: 'payment',
          amount: 3000,
          currency: 'NPR',
          paymentMethod: 'stripe',
          gateway: 'stripe',
          status: 'failed',
          gatewayTransactionId: 'STRIPE-456',
          createdAt: new Date('2024-01-16'),
          failedAt: new Date('2024-01-16'),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          transactionId: 'TXN-20240117-9012',
          bookingId: { bookingNumber: 'BK-001' },
          userId: { _id: new mongoose.Types.ObjectId(), name: 'John Doe', email: 'john@test.com' },
          transactionType: 'refund',
          amount: 2000,
          currency: 'NPR',
          paymentMethod: 'khalti',
          gateway: 'khalti',
          status: 'completed',
          gatewayTransactionId: 'KHALTI-789',
          createdAt: new Date('2024-01-17'),
          refundedAt: new Date('2024-01-17'),
        },
      ];

      (PaymentTransaction.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockTransactions),
      });

      await getReconciliationReport(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            dateRange: expect.any(Object),
            summary: expect.objectContaining({
              totalTransactions: 3,
              successfulPayments: 1,
              failedPayments: 1,
              refunds: 1,
              totalSuccessfulAmount: 5000,
              totalFailedAmount: 3000,
              totalRefundedAmount: 2000,
              netRevenue: 3000,
            }),
            byPaymentMethod: expect.objectContaining({
              khalti: expect.any(Object),
              stripe: expect.any(Object),
              paypal: expect.any(Object),
            }),
            transactions: expect.any(Array),
          }),
        })
      );
    });

    it('should generate CSV format when format=csv is specified', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      mockRequest.query = { startDate, endDate, format: 'csv' };

      const mockTransactions = [
        {
          _id: new mongoose.Types.ObjectId(),
          transactionId: 'TXN-20240115-1234',
          bookingId: { bookingNumber: 'BK-001' },
          userId: { _id: new mongoose.Types.ObjectId(), name: 'John Doe', email: 'john@test.com' },
          transactionType: 'payment',
          amount: 5000,
          currency: 'NPR',
          paymentMethod: 'khalti',
          gateway: 'khalti',
          status: 'completed',
          gatewayTransactionId: 'KHALTI-123',
          receiptNumber: 'RCP-20240115-0001',
          createdAt: new Date('2024-01-15'),
          completedAt: new Date('2024-01-15'),
        },
      ];

      (PaymentTransaction.find as jest.Mock).mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockTransactions),
      });

      await getReconciliationReport(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename="reconciliation-')
      );
      expect(mockResponse.send).toHaveBeenCalledWith(expect.stringContaining('Transaction ID'));
    });
  });

  describe('syncPaymentStatus', () => {
    it('should return 400 if transactionId is missing', async () => {
      mockRequest.body = {};

      await syncPaymentStatus(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Transaction ID is required',
      });
    });

    it('should return 404 if transaction not found', async () => {
      mockRequest.body = { transactionId: 'TXN-NOTFOUND' };

      (PaymentTransaction.findOne as jest.Mock).mockResolvedValue(null);

      await syncPaymentStatus(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Transaction not found',
      });
    });

    it('should sync Khalti payment status successfully', async () => {
      const mockTransaction = {
        transactionId: 'TXN-20240115-1234',
        gateway: 'khalti',
        gatewayPaymentToken: 'khalti-token-123',
        amount: 5000,
        status: 'pending',
      };

      mockRequest.body = { transactionId: 'TXN-20240115-1234' };

      (PaymentTransaction.findOne as jest.Mock).mockResolvedValue(mockTransaction);
      (khaltiService.verifyPayment as jest.Mock).mockResolvedValue({
        pidx: 'khalti-token-123',
        total_amount: 5000,
        status: 'Completed',
        transaction_id: 'KHALTI-123',
        fee: 50,
        refunded: false,
      });

      await syncPaymentStatus(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            transactionId: 'TXN-20240115-1234',
            localStatus: 'pending',
            gatewayStatus: 'completed',
            statusMismatch: true,
          }),
        })
      );
    });

    it('should sync Stripe payment status successfully', async () => {
      const mockTransaction = {
        transactionId: 'TXN-20240115-5678',
        gateway: 'stripe',
        gatewayPaymentIntentId: 'pi_123456',
        amount: 3000,
        status: 'completed',
      };

      mockRequest.body = { transactionId: 'TXN-20240115-5678' };

      (PaymentTransaction.findOne as jest.Mock).mockResolvedValue(mockTransaction);
      (stripeService.getPaymentIntentStatus as jest.Mock).mockResolvedValue({
        status: 'completed',
        amount: 3000,
        currency: 'usd',
      });

      await syncPaymentStatus(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            transactionId: 'TXN-20240115-5678',
            localStatus: 'completed',
            gatewayStatus: 'completed',
            statusMismatch: false,
          }),
        })
      );
    });

    it('should sync PayPal payment status successfully', async () => {
      const mockTransaction = {
        transactionId: 'TXN-20240115-9012',
        gateway: 'paypal',
        gatewayOrderId: 'ORDER-123',
        amount: 4000,
        status: 'completed',
      };

      mockRequest.body = { transactionId: 'TXN-20240115-9012' };

      (PaymentTransaction.findOne as jest.Mock).mockResolvedValue(mockTransaction);
      (paypalService.getOrderStatus as jest.Mock).mockResolvedValue({
        status: 'completed',
        amount: 4000,
        currency: 'USD',
      });

      await syncPaymentStatus(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            transactionId: 'TXN-20240115-9012',
            localStatus: 'completed',
            gatewayStatus: 'completed',
            statusMismatch: false,
          }),
        })
      );
    });

    it('should log status mismatch when detected', async () => {
      const mockTransaction = {
        transactionId: 'TXN-20240115-1234',
        gateway: 'khalti',
        gatewayPaymentToken: 'khalti-token-123',
        amount: 5000,
        status: 'pending',
      };

      mockRequest.body = { transactionId: 'TXN-20240115-1234' };

      (PaymentTransaction.findOne as jest.Mock).mockResolvedValue(mockTransaction);
      (khaltiService.verifyPayment as jest.Mock).mockResolvedValue({
        pidx: 'khalti-token-123',
        total_amount: 5000,
        status: 'Completed',
        transaction_id: 'KHALTI-123',
        fee: 50,
        refunded: false,
      });

      await syncPaymentStatus(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(auditLogService.logPaymentStatusMismatch).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionId: 'TXN-20240115-1234',
          localStatus: 'pending',
          gatewayStatus: 'completed',
          gateway: 'khalti',
        })
      );
    });

    it('should handle gateway query errors gracefully', async () => {
      const mockTransaction = {
        transactionId: 'TXN-20240115-1234',
        gateway: 'khalti',
        gatewayPaymentToken: 'khalti-token-123',
        amount: 5000,
        status: 'pending',
      };

      mockRequest.body = { transactionId: 'TXN-20240115-1234' };

      (PaymentTransaction.findOne as jest.Mock).mockResolvedValue(mockTransaction);
      (khaltiService.verifyPayment as jest.Mock).mockRejectedValue(
        new Error('Gateway connection failed')
      );

      await syncPaymentStatus(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            gatewayStatus: 'error',
            error: 'Failed to query gateway status',
          }),
        })
      );
    });
  });
});
