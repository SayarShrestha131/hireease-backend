import axios from 'axios';
import crypto from 'crypto';
import gatewayConfig from '../config/paymentGateway';

/**
 * Khalti Payment Request Response
 */
export interface KhaltiPaymentResponse {
  pidx: string; // Payment index
  payment_url: string;
  expires_at: Date;
  expires_in: number;
}

/**
 * Khalti Verification Response
 */
export interface KhaltiVerificationResponse {
  pidx: string;
  total_amount: number;
  status: 'Completed' | 'Pending' | 'Initiated' | 'Refunded' | 'Expired';
  transaction_id: string;
  fee: number;
  refunded: boolean;
}

/**
 * Khalti Refund Response
 */
export interface KhaltiRefundResponse {
  idx: string;
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed';
}

/**
 * Khalti Webhook Payload
 */
export interface KhaltiWebhookPayload {
  event: 'payment.success' | 'payment.failed';
  data: {
    pidx: string;
    transaction_id: string;
    amount: number;
    status: string;
  };
}

/**
 * KhaltiService - Handles Khalti payment gateway integration
 * 
 * Implements Khalti API v2 for payment processing, verification, and refunds.
 * Supports both sandbox and production environments.
 */
export class KhaltiService {
  private apiClient: any;
  private baseUrl: string;
  private secretKey: string;
  private webhookSecret: string;

  constructor() {
    const config = gatewayConfig.khalti;
    
    // Set base URL based on mode
    this.baseUrl = config.mode === 'production'
      ? 'https://khalti.com/api/v2'
      : 'https://a.khalti.com/api/v2';
    
    this.secretKey = config.secretKey;
    this.webhookSecret = config.webhookSecret;

    // Initialize axios client with default headers
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Key ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });
  }

  /**
   * Create payment request with Khalti
   * 
   * @param amount - Amount in paisa (smallest currency unit)
   * @param bookingId - Booking reference ID
   * @param returnUrl - URL to redirect after payment
   * @param customerInfo - Optional customer information
   * @returns Khalti payment response with payment URL
   * 
   * Requirements: 1.1, 1.2, 1.8
   */
  async createPaymentRequest(
    amount: number,
    bookingId: string,
    returnUrl: string,
    customerInfo?: {
      name?: string;
      email?: string;
      phone?: string;
    }
  ): Promise<KhaltiPaymentResponse> {
    try {
      // Generate unique idempotency key
      const idempotencyKey = this.generateIdempotencyKey();

      const payload = {
        return_url: returnUrl,
        website_url: process.env.FRONTEND_URL || 'http://localhost:3000',
        amount: amount, // Amount in paisa
        purchase_order_id: bookingId,
        purchase_order_name: `Booking ${bookingId}`,
        customer_info: {
          name: customerInfo?.name || 'Customer',
          email: customerInfo?.email || 'customer@example.com',
          phone: customerInfo?.phone || '9800000000',
        },
      };

      const response = await this.apiClient.post('/epayment/initiate/', payload, {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });

      return {
        pidx: response.data.pidx,
        payment_url: response.data.payment_url,
        expires_at: new Date(response.data.expires_at),
        expires_in: response.data.expires_in,
      };
    } catch (error: any) {
      console.error('Khalti payment request failed:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        'Failed to create Khalti payment request'
      );
    }
  }

  /**
   * Verify payment with Khalti
   * 
   * @param pidx - Payment index from Khalti
   * @returns Verification response with transaction details
   * 
   * Requirements: 1.4
   */
  async verifyPayment(pidx: string): Promise<KhaltiVerificationResponse> {
    try {
      const response = await this.apiClient.post('/epayment/lookup/', {
        pidx,
      });

      return {
        pidx: response.data.pidx,
        total_amount: response.data.total_amount,
        status: response.data.status,
        transaction_id: response.data.transaction_id,
        fee: response.data.fee,
        refunded: response.data.refunded,
      };
    } catch (error: any) {
      console.error('Khalti payment verification failed:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        'Failed to verify Khalti payment'
      );
    }
  }

  /**
   * Process refund with Khalti
   * 
   * @param transactionId - Original transaction ID from Khalti
   * @param amount - Refund amount in paisa
   * @returns Refund response
   * 
   * Requirements: 7.3
   */
  async refund(transactionId: string, amount: number): Promise<KhaltiRefundResponse> {
    try {
      // Generate unique idempotency key for refund
      const idempotencyKey = this.generateIdempotencyKey();

      const response = await this.apiClient.post('/epayment/refund/', {
        transaction_id: transactionId,
        amount: amount,
      }, {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });

      return {
        idx: response.data.idx,
        amount: response.data.amount,
        status: response.data.status,
      };
    } catch (error: any) {
      console.error('Khalti refund failed:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.detail || 
        error.response?.data?.message || 
        'Failed to process Khalti refund'
      );
    }
  }

  /**
   * Validate webhook signature from Khalti
   * 
   * @param payload - Raw webhook payload string
   * @param signature - Signature from Khalti-Signature header
   * @returns True if signature is valid
   * 
   * Requirements: 1.5, 4.2, 4.3
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    try {
      // Khalti uses HMAC SHA256 for webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Webhook signature validation error:', error);
      return false;
    }
  }

  /**
   * Process Khalti webhook payload
   * 
   * @param payload - Webhook payload from Khalti
   * @returns Processed webhook data
   * 
   * Requirements: 1.6, 1.7
   */
  async processWebhook(payload: KhaltiWebhookPayload): Promise<{
    pidx: string;
    transactionId: string;
    amount: number;
    status: string;
    isSuccess: boolean;
  }> {
    try {
      const { event, data } = payload;

      return {
        pidx: data.pidx,
        transactionId: data.transaction_id,
        amount: data.amount,
        status: data.status,
        isSuccess: event === 'payment.success',
      };
    } catch (error: any) {
      console.error('Khalti webhook processing failed:', error);
      throw new Error('Failed to process Khalti webhook');
    }
  }

  /**
   * Generate unique idempotency key
   * 
   * @returns Unique idempotency key
   * 
   * Requirements: 1.3
   */
  private generateIdempotencyKey(): string {
    // Generate UUID v4 style idempotency key
    return `khalti-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Get API base URL (for testing purposes)
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if service is in sandbox mode
   */
  isSandboxMode(): boolean {
    return gatewayConfig.khalti.mode === 'sandbox';
  }
}

export default new KhaltiService();
