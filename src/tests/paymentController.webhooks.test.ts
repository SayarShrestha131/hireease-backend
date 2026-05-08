import { Request, Response, NextFunction } from 'express';
import {
  handleKhaltiWebhook,
  handleStripeWebhook,
  handlePayPalWebhook,
} from '../controllers/paymentController';
import PaymentTransaction from '../models/PaymentTransaction';
import Booking from '../models/Booking';
import khaltiService from '../services/khaltiService';
import stripeService from '../services/stripeService';
import paypalService from '../services/paypalService';

// Mock services
jest.mock('../services/khaltiService');
jest.mock('../services/stripeService');
jest.mock('../services/paypalService');

// Mock models
jest.mock('../models/PaymentTransaction');
jest.mock('../models/Booking');

describe('Payment Controller - Webhook Handlers', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock response
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  describe('handleKhaltiWebhook', () => {
    beforeEach(() => {
      mockRequest = {
        headers: {
          'khalti-signature': 'valid_signature',
        },
        body: {
          event: 'payment.success',
          data: {
            pidx: 'test_pidx_123',
            transaction_id: 'khalti_txn_123',
            amount: 100000,
            status: 'Completed',
          },
        },
      };
    });

    it('should validate webhook signature before processing', async () => {
      // Arrange
      (khaltiService.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      // Act
      await handleKhaltiWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(khaltiService.validateWebhookSignature).toHaveBeenCalledWith(
        JSON.stringify(mockRequest.body),
        'valid_signature'
      );
    });

    it('should respond with HTTP 200 for valid signature', async () => {
      // Arrange
      (khaltiService.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      // Act
      await handleKhaltiWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('should reject webhook with invalid signature', async () => {
      // Arrange
      (khaltiService.validateWebhookSignature as jest.Mock).mockReturnValue(false);

      // Act
      await handleKhaltiWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid webhook signature',
      });
    });

    it('should respond within 5 seconds (immediately)', async () => {
      // Arrange
      (khaltiService.validateWebhookSignature as jest.Mock).mockReturnValue(true);
      const startTime = Date.now();

      // Act
      await handleKhaltiWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseTime = Date.now() - startTime;

      // Assert
      expect(responseTime).toBeLessThan(5000);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle missing signature header', async () => {
      // Arrange
      mockRequest.headers = {};

      // Act
      await handleKhaltiWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle malformed webhook payload gracefully', async () => {
      // Arrange
      mockRequest.body = null;
      (khaltiService.validateWebhookSignature as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid payload');
      });

      // Act
      await handleKhaltiWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('handleStripeWebhook', () => {
    beforeEach(() => {
      mockRequest = {
        headers: {
          'stripe-signature': 'valid_stripe_signature',
        },
        body: Buffer.from(JSON.stringify({
          type: 'payment_intent.succeeded',
          data: {
            object: {
              id: 'pi_123',
              amount: 100000,
              currency: 'usd',
              status: 'succeeded',
            },
          },
        })),
      };
    });

    it('should validate webhook signature before processing', async () => {
      // Arrange
      (stripeService.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      // Act
      await handleStripeWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(stripeService.validateWebhookSignature).toHaveBeenCalled();
    });

    it('should handle Buffer body from express.raw() middleware', async () => {
      // Arrange
      (stripeService.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      // Act
      await handleStripeWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      const callArgs = (stripeService.validateWebhookSignature as jest.Mock).mock.calls[0];
      expect(typeof callArgs[0]).toBe('string');
    });

    it('should respond with HTTP 200 for valid signature', async () => {
      // Arrange
      (stripeService.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      // Act
      await handleStripeWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('should reject webhook with invalid signature', async () => {
      // Arrange
      (stripeService.validateWebhookSignature as jest.Mock).mockReturnValue(false);

      // Act
      await handleStripeWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid webhook signature',
      });
    });

    it('should respond within 5 seconds (immediately)', async () => {
      // Arrange
      (stripeService.validateWebhookSignature as jest.Mock).mockReturnValue(true);
      const startTime = Date.now();

      // Act
      await handleStripeWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseTime = Date.now() - startTime;

      // Assert
      expect(responseTime).toBeLessThan(5000);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle JSON body when Buffer is not available', async () => {
      // Arrange
      mockRequest.body = {
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_123' } },
      };
      (stripeService.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      // Act
      await handleStripeWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });
  });

  describe('handlePayPalWebhook', () => {
    beforeEach(() => {
      mockRequest = {
        headers: {
          'paypal-transmission-id': 'transmission_123',
          'paypal-transmission-time': '2024-01-01T00:00:00Z',
          'paypal-cert-url': 'https://api.paypal.com/cert',
          'paypal-auth-algo': 'SHA256withRSA',
          'paypal-transmission-sig': 'valid_signature',
        },
        body: {
          event_type: 'PAYMENT.CAPTURE.COMPLETED',
          resource: {
            id: 'capture_123',
            amount: {
              value: '1000.00',
              currency_code: 'USD',
            },
            status: 'COMPLETED',
          },
        },
      };
    });

    it('should validate webhook signature before processing', async () => {
      // Arrange
      (paypalService.validateWebhookSignature as jest.Mock).mockResolvedValue(true);

      // Act
      await handlePayPalWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(paypalService.validateWebhookSignature).toHaveBeenCalled();
    });

    it('should extract PayPal headers correctly', async () => {
      // Arrange
      (paypalService.validateWebhookSignature as jest.Mock).mockResolvedValue(true);

      // Act
      await handlePayPalWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      const callArgs = (paypalService.validateWebhookSignature as jest.Mock).mock.calls[0];
      const headers = callArgs[1];
      expect(headers['paypal-transmission-id']).toBe('transmission_123');
      expect(headers['paypal-transmission-sig']).toBe('valid_signature');
    });

    it('should respond with HTTP 200 for valid signature', async () => {
      // Arrange
      (paypalService.validateWebhookSignature as jest.Mock).mockResolvedValue(true);

      // Act
      await handlePayPalWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('should reject webhook with invalid signature', async () => {
      // Arrange
      (paypalService.validateWebhookSignature as jest.Mock).mockResolvedValue(false);

      // Act
      await handlePayPalWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid webhook signature',
      });
    });

    it('should respond within 5 seconds (immediately)', async () => {
      // Arrange
      (paypalService.validateWebhookSignature as jest.Mock).mockResolvedValue(true);
      const startTime = Date.now();

      // Act
      await handlePayPalWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseTime = Date.now() - startTime;

      // Assert
      expect(responseTime).toBeLessThan(5000);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should handle missing PayPal headers', async () => {
      // Arrange
      mockRequest.headers = {};
      (paypalService.validateWebhookSignature as jest.Mock).mockResolvedValue(false);

      // Act
      await handlePayPalWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Webhook Processing Requirements', () => {
    it('should process webhooks asynchronously after responding', async () => {
      // Arrange
      mockRequest = {
        headers: { 'khalti-signature': 'valid_sig' },
        body: {
          event: 'payment.success',
          data: { pidx: 'test', transaction_id: 'txn', amount: 1000, status: 'Completed' },
        },
      };
      (khaltiService.validateWebhookSignature as jest.Mock).mockReturnValue(true);

      // Act
      await handleKhaltiWebhook(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert - Response should be sent immediately
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('should validate signatures for all three gateways', async () => {
      // Test Khalti
      mockRequest = {
        headers: { 'khalti-signature': 'sig' },
        body: { event: 'payment.success', data: {} },
      };
      (khaltiService.validateWebhookSignature as jest.Mock).mockReturnValue(true);
      await handleKhaltiWebhook(mockRequest as Request, mockResponse as Response, mockNext);
      expect(khaltiService.validateWebhookSignature).toHaveBeenCalled();

      // Test Stripe
      mockRequest = {
        headers: { 'stripe-signature': 'sig' },
        body: Buffer.from('{}'),
      };
      (stripeService.validateWebhookSignature as jest.Mock).mockReturnValue(true);
      await handleStripeWebhook(mockRequest as Request, mockResponse as Response, mockNext);
      expect(stripeService.validateWebhookSignature).toHaveBeenCalled();

      // Test PayPal
      mockRequest = {
        headers: {
          'paypal-transmission-id': 'id',
          'paypal-transmission-time': 'time',
          'paypal-cert-url': 'url',
          'paypal-auth-algo': 'algo',
          'paypal-transmission-sig': 'sig',
        },
        body: { event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} },
      };
      (paypalService.validateWebhookSignature as jest.Mock).mockResolvedValue(true);
      await handlePayPalWebhook(mockRequest as Request, mockResponse as Response, mockNext);
      expect(paypalService.validateWebhookSignature).toHaveBeenCalled();
    });
  });
});
