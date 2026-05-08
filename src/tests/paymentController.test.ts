import { Request, Response } from 'express';
import { AuthRequest } from '../types/auth';
import {
  initiatePayment,
  verifyPayment,
  refundPayment,
  getPaymentHistory,
  getPaymentHealth,
} from '../controllers/paymentController';
import paymentService from '../services/paymentService';
import gatewayConfig from '../config/paymentGateway';

// Mock dependencies
jest.mock('../services/paymentService');
jest.mock('../config/paymentGateway');

describe('Payment Controller', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockRequest = {
      user: {
        _id: 'user123',
      } as any,
      body: {},
      query: {},
      params: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiatePayment', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;

      await initiatePayment(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 400 if required fields are missing', async () => {
      mockRequest.body = { bookingId: 'booking123' };

      await initiatePayment(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Booking ID, payment method, and return URL are required',
      });
    });

    it('should return 400 if payment method is invalid', async () => {
      mockRequest.body = {
        bookingId: 'booking123',
        paymentMethod: 'invalid',
        returnUrl: 'http://example.com',
      };

      await initiatePayment(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid payment method. Must be one of: khalti, stripe, paypal',
      });
    });

    it('should successfully initiate payment', async () => {
      mockRequest.body = {
        bookingId: 'booking123',
        paymentMethod: 'khalti',
        returnUrl: 'http://example.com',
      };

      const mockResult = {
        transactionId: 'txn123',
        paymentUrl: 'http://khalti.com/pay',
        expiresAt: new Date(),
        gateway: 'khalti',
        amount: 5000,
        currency: 'NPR',
      };

      (paymentService.initiatePayment as jest.Mock).mockResolvedValue(mockResult);

      await initiatePayment(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(paymentService.initiatePayment).toHaveBeenCalledWith(
        'booking123',
        'khalti',
        'http://example.com',
        'user123'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });
  });

  describe('verifyPayment', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;

      await verifyPayment(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 400 if transaction ID is missing', async () => {
      mockRequest.body = {};

      await verifyPayment(
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

    it('should successfully verify payment', async () => {
      mockRequest.body = {
        transactionId: 'txn123',
        gatewayData: { pidx: 'khalti123' },
      };

      const mockResult = {
        success: true,
        paymentStatus: 'completed' as const,
        bookingId: 'booking123',
        transactionId: 'txn123',
        amount: 5000,
        gatewayTransactionId: 'gateway123',
      };

      (paymentService.verifyPayment as jest.Mock).mockResolvedValue(mockResult);

      await verifyPayment(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(paymentService.verifyPayment).toHaveBeenCalledWith('txn123', {
        pidx: 'khalti123',
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          paymentStatus: 'completed',
          bookingId: 'booking123',
          receiptUrl: '/api/payments/receipt/booking123',
        },
      });
    });
  });

  describe('refundPayment', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;

      await refundPayment(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should return 400 if required fields are missing', async () => {
      mockRequest.body = { bookingId: 'booking123' };

      await refundPayment(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Booking ID and reason are required',
      });
    });

    it('should successfully process refund', async () => {
      mockRequest.body = {
        bookingId: 'booking123',
        reason: 'User cancellation',
        amount: 5000,
      };

      const mockResult = {
        success: true,
        refundId: 'refund123',
        refundStatus: 'completed' as const,
        refundAmount: 5000,
        originalTransactionId: 'txn123',
      };

      (paymentService.refundPayment as jest.Mock).mockResolvedValue(mockResult);

      await refundPayment(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(paymentService.refundPayment).toHaveBeenCalledWith(
        'booking123',
        'User cancellation',
        5000
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          refundId: 'refund123',
          refundStatus: 'completed',
          refundAmount: 5000,
        },
        error: undefined,
      });
    });
  });

  describe('getPaymentHistory', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockRequest.user = undefined;

      await getPaymentHistory(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should successfully retrieve payment history', async () => {
      mockRequest.query = {
        page: '1',
        limit: '20',
        status: 'completed',
      };

      const mockResult = {
        transactions: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 0,
        },
        summary: {
          totalPaid: 0,
          totalRefunded: 0,
        },
      };

      (paymentService.getPaymentHistory as jest.Mock).mockResolvedValue(mockResult);

      await getPaymentHistory(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(paymentService.getPaymentHistory).toHaveBeenCalledWith('user123', {
        page: 1,
        limit: 20,
        status: 'completed',
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });
  });

  describe('getPaymentHealth', () => {
    it('should return gateway health status', async () => {
      // Mock environment variable
      process.env.PAYMENT_MODE = 'sandbox';

      await getPaymentHealth(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            mode: 'sandbox',
          }),
        })
      );
    });
  });
});
