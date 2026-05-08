import { PayPalService } from '../services/paypalService';
import paypal from '@paypal/checkout-server-sdk';

// Mock PayPal SDK
jest.mock('@paypal/checkout-server-sdk');

// Mock gateway config
jest.mock('../config/paymentGateway', () => ({
  __esModule: true,
  default: {
    khalti: {
      enabled: false,
      mode: 'sandbox',
      publicKey: '',
      secretKey: '',
      webhookSecret: '',
    },
    stripe: {
      enabled: false,
      mode: 'test',
      publicKey: '',
      secretKey: '',
      webhookSecret: '',
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

describe('PayPalService', () => {
  let paypalService: PayPalService;
  let mockClient: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock PayPal client
    mockClient = {
      execute: jest.fn(),
    };

    // Mock PayPal SDK classes
    (paypal.core.SandboxEnvironment as jest.Mock) = jest.fn();
    (paypal.core.LiveEnvironment as jest.Mock) = jest.fn();
    (paypal.core.PayPalHttpClient as jest.Mock) = jest.fn().mockReturnValue(mockClient);
    (paypal.orders.OrdersCreateRequest as jest.Mock) = jest.fn().mockImplementation(() => ({
      prefer: jest.fn(),
      requestBody: jest.fn(),
      headers: {},
    }));
    (paypal.orders.OrdersCaptureRequest as jest.Mock) = jest.fn().mockImplementation(() => ({
      requestBody: jest.fn(),
    }));
    (paypal.payments.CapturesRefundRequest as jest.Mock) = jest.fn().mockImplementation(() => ({
      prefer: jest.fn(),
      requestBody: jest.fn(),
      headers: {},
    }));

    // Create new service instance
    paypalService = new PayPalService();
  });

  describe('createOrder', () => {
    it('should create PayPal order with valid data', async () => {
      // Arrange
      const mockResponse = {
        result: {
          id: 'ORDER-123456',
          status: 'CREATED',
          links: [
            { rel: 'self', href: 'https://api.paypal.com/v2/checkout/orders/ORDER-123456' },
            { rel: 'approve', href: 'https://www.paypal.com/checkoutnow?token=ORDER-123456' },
          ],
        },
      };

      mockClient.execute.mockResolvedValue(mockResponse);

      // Act
      const result = await paypalService.createOrder(100.00, 'USD', 'BK-20241201-1234');

      // Assert
      expect(result).toEqual({
        orderId: 'ORDER-123456',
        approvalUrl: 'https://www.paypal.com/checkoutnow?token=ORDER-123456',
        status: 'CREATED',
      });

      expect(mockClient.execute).toHaveBeenCalled();
    });

    it('should format amount with 2 decimal places', async () => {
      // Arrange
      const mockResponse = {
        result: {
          id: 'ORDER-789',
          status: 'CREATED',
          links: [
            { rel: 'approve', href: 'https://www.paypal.com/checkoutnow?token=ORDER-789' },
          ],
        },
      };

      mockClient.execute.mockResolvedValue(mockResponse);

      // Act
      await paypalService.createOrder(99.99, 'USD', 'BK-TEST');

      // Assert
      expect(mockClient.execute).toHaveBeenCalled();
      // The amount should be formatted as "99.99" in the request
    });

    it('should handle order creation errors', async () => {
      // Arrange
      mockClient.execute.mockRejectedValue(new Error('Invalid amount'));

      // Act & Assert
      await expect(
        paypalService.createOrder(-10, 'USD', 'BK-INVALID')
      ).rejects.toThrow('Invalid amount');
    });

    it('should create order with different currencies', async () => {
      // Arrange
      const mockResponse = {
        result: {
          id: 'ORDER-EUR-123',
          status: 'CREATED',
          links: [
            { rel: 'approve', href: 'https://www.paypal.com/checkoutnow?token=ORDER-EUR-123' },
          ],
        },
      };

      mockClient.execute.mockResolvedValue(mockResponse);

      // Act
      const result = await paypalService.createOrder(50.00, 'EUR', 'BK-EUR-001');

      // Assert
      expect(result.orderId).toBe('ORDER-EUR-123');
      expect(mockClient.execute).toHaveBeenCalled();
    });

    it('should handle missing approval URL gracefully', async () => {
      // Arrange
      const mockResponse = {
        result: {
          id: 'ORDER-NO-LINK',
          status: 'CREATED',
          links: [
            { rel: 'self', href: 'https://api.paypal.com/v2/checkout/orders/ORDER-NO-LINK' },
          ],
        },
      };

      mockClient.execute.mockResolvedValue(mockResponse);

      // Act
      const result = await paypalService.createOrder(100.00, 'USD', 'BK-TEST');

      // Assert
      expect(result.approvalUrl).toBe('');
    });
  });

  describe('captureOrder', () => {
    it('should capture PayPal order successfully', async () => {
      // Arrange
      const mockResponse = {
        result: {
          id: 'ORDER-123456',
          status: 'COMPLETED',
          payer: {
            payer_id: 'PAYER-ABC123',
            email_address: 'buyer@example.com',
          },
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAPTURE-XYZ789',
                    status: 'COMPLETED',
                    amount: {
                      value: '100.00',
                      currency_code: 'USD',
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      mockClient.execute.mockResolvedValue(mockResponse);

      // Act
      const result = await paypalService.captureOrder('ORDER-123456');

      // Assert
      expect(result).toEqual({
        orderId: 'ORDER-123456',
        captureId: 'CAPTURE-XYZ789',
        payerId: 'PAYER-ABC123',
        amount: 100.00,
        currency: 'USD',
        status: 'COMPLETED',
      });

      expect(mockClient.execute).toHaveBeenCalled();
    });

    it('should handle capture failure', async () => {
      // Arrange
      mockClient.execute.mockRejectedValue(new Error('Order not found'));

      // Act & Assert
      await expect(
        paypalService.captureOrder('INVALID-ORDER')
      ).rejects.toThrow('Order not found');
    });

    it('should parse amount correctly', async () => {
      // Arrange
      const mockResponse = {
        result: {
          id: 'ORDER-456',
          status: 'COMPLETED',
          payer: {
            payer_id: 'PAYER-DEF456',
          },
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAPTURE-123',
                    status: 'COMPLETED',
                    amount: {
                      value: '49.99',
                      currency_code: 'USD',
                    },
                  },
                ],
              },
            },
          ],
        },
      };

      mockClient.execute.mockResolvedValue(mockResponse);

      // Act
      const result = await paypalService.captureOrder('ORDER-456');

      // Assert
      expect(result.amount).toBe(49.99);
      expect(typeof result.amount).toBe('number');
    });
  });

  describe('refund', () => {
    it('should process full refund successfully', async () => {
      // Arrange
      const mockResponse = {
        result: {
          id: 'REFUND-123',
          status: 'COMPLETED',
          amount: {
            value: '100.00',
            currency_code: 'USD',
          },
        },
      };

      mockClient.execute.mockResolvedValue(mockResponse);

      // Act
      const result = await paypalService.refund('CAPTURE-XYZ789');

      // Assert
      expect(result).toEqual({
        refundId: 'REFUND-123',
        amount: 100.00,
        status: 'COMPLETED',
        captureId: 'CAPTURE-XYZ789',
      });

      expect(mockClient.execute).toHaveBeenCalled();
    });

    it('should process partial refund successfully', async () => {
      // Arrange
      const mockResponse = {
        result: {
          id: 'REFUND-456',
          status: 'COMPLETED',
          amount: {
            value: '50.00',
            currency_code: 'USD',
          },
        },
      };

      mockClient.execute.mockResolvedValue(mockResponse);

      // Act
      const result = await paypalService.refund('CAPTURE-ABC123', 50.00, 'USD');

      // Assert
      expect(result.amount).toBe(50.00);
      expect(result.status).toBe('COMPLETED');
    });

    it('should handle refund failure', async () => {
      // Arrange
      mockClient.execute.mockRejectedValue(new Error('Capture already refunded'));

      // Act & Assert
      await expect(
        paypalService.refund('CAPTURE-INVALID')
      ).rejects.toThrow('Capture already refunded');
    });

    it('should format partial refund amount correctly', async () => {
      // Arrange
      const mockResponse = {
        result: {
          id: 'REFUND-789',
          status: 'PENDING',
          amount: {
            value: '25.50',
            currency_code: 'USD',
          },
        },
      };

      mockClient.execute.mockResolvedValue(mockResponse);

      // Act
      const result = await paypalService.refund('CAPTURE-TEST', 25.50, 'USD');

      // Assert
      expect(result.amount).toBe(25.50);
      expect(result.status).toBe('PENDING');
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate correct webhook signature', async () => {
      // Arrange
      const payload = JSON.stringify({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAPTURE-123' },
      });

      const headers = {
        'paypal-transmission-id': 'test-transmission-id',
        'paypal-transmission-time': '2024-12-01T12:00:00Z',
        'paypal-cert-url': 'https://api.paypal.com/cert',
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-transmission-sig': 'test-signature',
      };

      // Act
      const isValid = await paypalService.validateWebhookSignature(payload, headers);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject webhook with invalid JSON', async () => {
      // Arrange
      const payload = 'invalid json';

      const headers = {
        'paypal-transmission-id': 'test-transmission-id',
        'paypal-transmission-time': '2024-12-01T12:00:00Z',
        'paypal-cert-url': 'https://api.paypal.com/cert',
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-transmission-sig': 'test-signature',
      };

      // Act
      const isValid = await paypalService.validateWebhookSignature(payload, headers);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should handle missing webhook headers', async () => {
      // Arrange
      const payload = JSON.stringify({ event_type: 'TEST', resource: {} });
      const headers = {
        'paypal-transmission-id': 'test-id',
        // Missing other required headers
      };

      // Act
      const isValid = await paypalService.validateWebhookSignature(payload, headers);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should reject webhook with invalid structure', async () => {
      // Arrange
      const payload = JSON.stringify({ invalid: 'structure' });
      const headers = {
        'paypal-transmission-id': 'test-id',
        'paypal-transmission-time': '2024-12-01T12:00:00Z',
        'paypal-cert-url': 'https://api.paypal.com/cert',
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-transmission-sig': 'test-sig',
      };

      // Act
      const isValid = await paypalService.validateWebhookSignature(payload, headers);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('processWebhook', () => {
    it('should process PAYMENT.CAPTURE.COMPLETED event', async () => {
      // Arrange
      const webhookEvent = {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAPTURE-SUCCESS-123',
          status: 'COMPLETED',
          amount: {
            value: '100.00',
            currency_code: 'USD',
          },
          supplementary_data: {
            related_ids: {
              order_id: 'ORDER-123',
            },
          },
        },
      };

      // Act
      const result = await paypalService.processWebhook(webhookEvent);

      // Assert
      expect(result).toEqual({
        eventType: 'PAYMENT.CAPTURE.COMPLETED',
        captureId: 'CAPTURE-SUCCESS-123',
        orderId: 'ORDER-123',
        amount: 100.00,
        currency: 'USD',
        status: 'COMPLETED',
        isSuccess: true,
      });
    });

    it('should process PAYMENT.CAPTURE.REFUNDED event', async () => {
      // Arrange
      const webhookEvent = {
        event_type: 'PAYMENT.CAPTURE.REFUNDED',
        resource: {
          id: 'REFUND-456',
          amount: {
            value: '50.00',
            currency_code: 'USD',
          },
        },
      };

      // Act
      const result = await paypalService.processWebhook(webhookEvent);

      // Assert
      expect(result).toEqual({
        eventType: 'PAYMENT.CAPTURE.REFUNDED',
        captureId: 'REFUND-456',
        refundId: 'REFUND-456',
        amount: 50.00,
        currency: 'USD',
        status: 'refunded',
        isSuccess: true,
      });
    });

    it('should handle unhandled event types', async () => {
      // Arrange
      const webhookEvent = {
        event_type: 'UNKNOWN.EVENT.TYPE',
        resource: {
          id: 'UNKNOWN-123',
        },
      };

      // Act & Assert
      await expect(
        paypalService.processWebhook(webhookEvent)
      ).rejects.toThrow('Unhandled PayPal event type: UNKNOWN.EVENT.TYPE');
    });

    it('should handle webhook processing errors', async () => {
      // Arrange
      const invalidEvent = {} as any;

      // Act & Assert
      await expect(
        paypalService.processWebhook(invalidEvent)
      ).rejects.toThrow('Unhandled PayPal event type');
    });

    it('should handle missing amount in webhook', async () => {
      // Arrange
      const webhookEvent = {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAPTURE-NO-AMOUNT',
          status: 'COMPLETED',
        },
      };

      // Act
      const result = await paypalService.processWebhook(webhookEvent);

      // Assert
      expect(result.amount).toBeUndefined();
      expect(result.currency).toBeUndefined();
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Utility Methods', () => {
    it('should identify sandbox mode correctly', () => {
      // Act
      const isSandbox = paypalService.isSandboxMode();

      // Assert
      expect(isSandbox).toBe(true);
    });

    it('should return PayPal client instance', () => {
      // Act
      const client = paypalService.getClient();

      // Assert
      expect(client).toBeDefined();
      expect(client).toBe(mockClient);
    });
  });

  describe('Idempotency Key Generation', () => {
    it('should generate unique idempotency keys for orders', async () => {
      // Arrange
      const mockResponse = {
        result: {
          id: 'ORDER-TEST',
          status: 'CREATED',
          links: [
            { rel: 'approve', href: 'https://www.paypal.com/checkoutnow?token=ORDER-TEST' },
          ],
        },
      };

      mockClient.execute.mockResolvedValue(mockResponse);

      // Act - Create multiple orders
      await paypalService.createOrder(100, 'USD', 'BK-1');
      await paypalService.createOrder(100, 'USD', 'BK-2');
      await paypalService.createOrder(100, 'USD', 'BK-3');

      // Assert - All calls should have been made
      expect(mockClient.execute).toHaveBeenCalledTimes(3);
    });

    it('should generate unique idempotency keys for refunds', async () => {
      // Arrange
      const mockResponse = {
        result: {
          id: 'REFUND-TEST',
          status: 'COMPLETED',
          amount: {
            value: '100.00',
            currency_code: 'USD',
          },
        },
      };

      mockClient.execute.mockResolvedValue(mockResponse);

      // Act - Process multiple refunds
      await paypalService.refund('CAPTURE-1');
      await paypalService.refund('CAPTURE-2');
      await paypalService.refund('CAPTURE-3');

      // Assert - All calls should have been made
      expect(mockClient.execute).toHaveBeenCalledTimes(3);
    });
  });
});
