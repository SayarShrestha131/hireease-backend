import { KhaltiService } from '../services/khaltiService';
import axios from 'axios';
import crypto from 'crypto';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
      enabled: false,
      mode: 'test',
      publicKey: '',
      secretKey: '',
      webhookSecret: '',
    },
    paypal: {
      enabled: false,
      mode: 'sandbox',
      clientId: '',
      clientSecret: '',
      webhookId: '',
    },
    receiptStoragePath: './receipts',
    rateLimitPerHour: 10,
  },
}));

describe('KhaltiService', () => {
  let khaltiService: KhaltiService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    // Create new service instance
    khaltiService = new KhaltiService();
  });

  describe('createPaymentRequest', () => {
    it('should create payment request with valid data', async () => {
      // Arrange
      const mockResponse = {
        data: {
          pidx: 'test_pidx_123',
          payment_url: 'https://test.khalti.com/payment/test_pidx_123',
          expires_at: '2024-12-31T23:59:59Z',
          expires_in: 3600,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      const result = await khaltiService.createPaymentRequest(
        100000, // 1000 NPR in paisa
        'BK-20241201-1234',
        'http://localhost:3000/payment/return'
      );

      // Assert
      expect(result).toEqual({
        pidx: 'test_pidx_123',
        payment_url: 'https://test.khalti.com/payment/test_pidx_123',
        expires_at: new Date('2024-12-31T23:59:59Z'),
        expires_in: 3600,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/epayment/initiate/',
        expect.objectContaining({
          amount: 100000,
          purchase_order_id: 'BK-20241201-1234',
          return_url: 'http://localhost:3000/payment/return',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': expect.stringContaining('khalti-'),
          }),
        })
      );
    });

    it('should create payment request with custom customer info', async () => {
      // Arrange
      const mockResponse = {
        data: {
          pidx: 'test_pidx_456',
          payment_url: 'https://test.khalti.com/payment/test_pidx_456',
          expires_at: '2024-12-31T23:59:59Z',
          expires_in: 3600,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const customerInfo = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '9841234567',
      };

      // Act
      const result = await khaltiService.createPaymentRequest(
        50000,
        'BK-20241201-5678',
        'http://localhost:3000/payment/return',
        customerInfo
      );

      // Assert
      expect(result.pidx).toBe('test_pidx_456');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/epayment/initiate/',
        expect.objectContaining({
          customer_info: customerInfo,
        }),
        expect.any(Object)
      );
    });

    it('should handle API errors gracefully', async () => {
      // Arrange
      const mockError = {
        response: {
          data: {
            detail: 'Invalid amount',
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        khaltiService.createPaymentRequest(
          -100,
          'BK-20241201-9999',
          'http://localhost:3000/payment/return'
        )
      ).rejects.toThrow('Invalid amount');
    });

    it('should handle network errors', async () => {
      // Arrange
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(
        khaltiService.createPaymentRequest(
          100000,
          'BK-20241201-1111',
          'http://localhost:3000/payment/return'
        )
      ).rejects.toThrow('Failed to create Khalti payment request');
    });
  });

  describe('verifyPayment', () => {
    it('should verify payment successfully', async () => {
      // Arrange
      const mockResponse = {
        data: {
          pidx: 'test_pidx_123',
          total_amount: 100000,
          status: 'Completed',
          transaction_id: 'khalti_txn_123',
          fee: 1000,
          refunded: false,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      const result = await khaltiService.verifyPayment('test_pidx_123');

      // Assert
      expect(result).toEqual({
        pidx: 'test_pidx_123',
        total_amount: 100000,
        status: 'Completed',
        transaction_id: 'khalti_txn_123',
        fee: 1000,
        refunded: false,
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/epayment/lookup/', {
        pidx: 'test_pidx_123',
      });
    });

    it('should handle verification failure', async () => {
      // Arrange
      const mockError = {
        response: {
          data: {
            detail: 'Payment not found',
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        khaltiService.verifyPayment('invalid_pidx')
      ).rejects.toThrow('Payment not found');
    });

    it('should verify pending payment', async () => {
      // Arrange
      const mockResponse = {
        data: {
          pidx: 'test_pidx_pending',
          total_amount: 50000,
          status: 'Pending',
          transaction_id: '',
          fee: 0,
          refunded: false,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      const result = await khaltiService.verifyPayment('test_pidx_pending');

      // Assert
      expect(result.status).toBe('Pending');
      expect(result.transaction_id).toBe('');
    });
  });

  describe('refund', () => {
    it('should process refund successfully', async () => {
      // Arrange
      const mockResponse = {
        data: {
          idx: 'refund_123',
          amount: 100000,
          status: 'Completed',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      const result = await khaltiService.refund('khalti_txn_123', 100000);

      // Assert
      expect(result).toEqual({
        idx: 'refund_123',
        amount: 100000,
        status: 'Completed',
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/epayment/refund/',
        {
          transaction_id: 'khalti_txn_123',
          amount: 100000,
        },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Idempotency-Key': expect.stringContaining('khalti-'),
          }),
        })
      );
    });

    it('should handle refund failure', async () => {
      // Arrange
      const mockError = {
        response: {
          data: {
            detail: 'Transaction already refunded',
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      // Act & Assert
      await expect(
        khaltiService.refund('khalti_txn_123', 100000)
      ).rejects.toThrow('Transaction already refunded');
    });

    it('should process partial refund', async () => {
      // Arrange
      const mockResponse = {
        data: {
          idx: 'refund_456',
          amount: 50000,
          status: 'Completed',
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act
      const result = await khaltiService.refund('khalti_txn_456', 50000);

      // Assert
      expect(result.amount).toBe(50000);
      expect(result.status).toBe('Completed');
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate correct webhook signature', () => {
      // Arrange
      const payload = JSON.stringify({
        event: 'payment.success',
        data: { pidx: 'test_pidx', amount: 100000 },
      });

      const expectedSignature = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(payload)
        .digest('hex');

      // Act
      const isValid = khaltiService.validateWebhookSignature(payload, expectedSignature);

      // Assert
      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      // Arrange
      const payload = JSON.stringify({
        event: 'payment.success',
        data: { pidx: 'test_pidx', amount: 100000 },
      });

      const invalidSignature = 'invalid_signature_123';

      // Act
      const isValid = khaltiService.validateWebhookSignature(payload, invalidSignature);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should reject tampered webhook payload', () => {
      // Arrange
      const originalPayload = JSON.stringify({
        event: 'payment.success',
        data: { pidx: 'test_pidx', amount: 100000 },
      });

      const tamperedPayload = JSON.stringify({
        event: 'payment.success',
        data: { pidx: 'test_pidx', amount: 999999 }, // Tampered amount
      });

      const signature = crypto
        .createHmac('sha256', 'test_webhook_secret')
        .update(originalPayload)
        .digest('hex');

      // Act
      const isValid = khaltiService.validateWebhookSignature(tamperedPayload, signature);

      // Assert
      expect(isValid).toBe(false);
    });

    it('should handle signature validation errors gracefully', () => {
      // Arrange
      const payload = 'invalid json';
      const signature = '';

      // Act
      const isValid = khaltiService.validateWebhookSignature(payload, signature);

      // Assert
      expect(isValid).toBe(false);
    });
  });

  describe('processWebhook', () => {
    it('should process successful payment webhook', async () => {
      // Arrange
      const webhookPayload = {
        event: 'payment.success' as const,
        data: {
          pidx: 'test_pidx_success',
          transaction_id: 'khalti_txn_success',
          amount: 100000,
          status: 'Completed',
        },
      };

      // Act
      const result = await khaltiService.processWebhook(webhookPayload);

      // Assert
      expect(result).toEqual({
        pidx: 'test_pidx_success',
        transactionId: 'khalti_txn_success',
        amount: 100000,
        status: 'Completed',
        isSuccess: true,
      });
    });

    it('should process failed payment webhook', async () => {
      // Arrange
      const webhookPayload = {
        event: 'payment.failed' as const,
        data: {
          pidx: 'test_pidx_failed',
          transaction_id: '',
          amount: 100000,
          status: 'Failed',
        },
      };

      // Act
      const result = await khaltiService.processWebhook(webhookPayload);

      // Assert
      expect(result).toEqual({
        pidx: 'test_pidx_failed',
        transactionId: '',
        amount: 100000,
        status: 'Failed',
        isSuccess: false,
      });
    });

    it('should handle webhook processing errors', async () => {
      // Arrange
      const invalidPayload = {} as any;

      // Act & Assert
      await expect(
        khaltiService.processWebhook(invalidPayload)
      ).rejects.toThrow('Failed to process Khalti webhook');
    });
  });

  describe('Utility Methods', () => {
    it('should return correct base URL for sandbox mode', () => {
      // Act
      const baseUrl = khaltiService.getBaseUrl();

      // Assert
      expect(baseUrl).toBe('https://a.khalti.com/api/v2');
    });

    it('should identify sandbox mode correctly', () => {
      // Act
      const isSandbox = khaltiService.isSandboxMode();

      // Assert
      expect(isSandbox).toBe(true);
    });
  });

  describe('Idempotency Key Generation', () => {
    it('should generate unique idempotency keys', async () => {
      // Arrange
      const mockResponse = {
        data: {
          pidx: 'test_pidx',
          payment_url: 'https://test.khalti.com/payment/test',
          expires_at: '2024-12-31T23:59:59Z',
          expires_in: 3600,
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      // Act - Make multiple requests
      await khaltiService.createPaymentRequest(100000, 'BK-1', 'http://test.com');
      await khaltiService.createPaymentRequest(100000, 'BK-2', 'http://test.com');
      await khaltiService.createPaymentRequest(100000, 'BK-3', 'http://test.com');

      // Assert - Extract idempotency keys from all calls
      const calls = mockAxiosInstance.post.mock.calls;
      const idempotencyKeys = calls.map((call: any) => call[2]?.headers?.['Idempotency-Key']);

      // All keys should be unique
      const uniqueKeys = new Set(idempotencyKeys);
      expect(uniqueKeys.size).toBe(3);

      // All keys should start with 'khalti-'
      idempotencyKeys.forEach((key: any) => {
        expect(key).toMatch(/^khalti-\d+-[a-f0-9]{32}$/);
      });
    });
  });
});
