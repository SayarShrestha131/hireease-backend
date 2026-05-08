import paypal from '@paypal/checkout-server-sdk';
import crypto from 'crypto';
import gatewayConfig from '../config/paymentGateway';

/**
 * PayPal Order Response
 */
export interface PayPalOrderResponse {
  orderId: string;
  approvalUrl: string;
  status: string;
}

/**
 * PayPal Capture Response
 */
export interface PayPalCaptureResponse {
  orderId: string;
  captureId: string;
  payerId: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * PayPal Refund Response
 */
export interface PayPalRefundResponse {
  refundId: string;
  amount: number;
  status: string;
  captureId: string;
}

/**
 * PayPal Webhook Event
 */
export interface PayPalWebhookEvent {
  event_type: string;
  resource: {
    id: string;
    amount?: {
      value: string;
      currency_code: string;
    };
    [key: string]: any;
  };
}

/**
 * PayPalService - Handles PayPal payment gateway integration
 * 
 * Implements PayPal REST API v2 for payment processing, verification, and refunds.
 * Supports both sandbox and live environments.
 */
export class PayPalService {
  private client: any;
  private mode: 'sandbox' | 'live';
  private webhookId: string;

  constructor() {
    const config = gatewayConfig.paypal;
    
    this.mode = config.mode;
    this.webhookId = config.webhookId;

    // Initialize PayPal environment
    const environment = config.mode === 'live'
      ? new paypal.core.LiveEnvironment(config.clientId, config.clientSecret)
      : new paypal.core.SandboxEnvironment(config.clientId, config.clientSecret);

    // Initialize PayPal client
    this.client = new paypal.core.PayPalHttpClient(environment);
  }

  /**
   * Create PayPal order
   * 
   * @param amount - Amount in standard currency unit (e.g., 100.00 for $100)
   * @param currency - Currency code (USD, EUR, etc.)
   * @param bookingId - Booking reference ID
   * @returns PayPal order response with approval URL
   * 
   * Requirements: 3.1, 3.2, 3.3, 3.8
   */
  async createOrder(
    amount: number,
    currency: string,
    bookingId: string
  ): Promise<PayPalOrderResponse> {
    try {
      // Generate unique idempotency key
      const idempotencyKey = this.generateIdempotencyKey();

      // Create order request
      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer('return=representation');
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: bookingId,
            description: `Booking ${bookingId}`,
            amount: {
              currency_code: currency,
              value: amount.toFixed(2), // PayPal expects string with 2 decimal places
            },
          },
        ],
        application_context: {
          brand_name: 'Hire Ease',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: `${process.env.FRONTEND_URL}/payment/success`,
          cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        },
      });

      // Add idempotency key to headers
      (request as any).headers['PayPal-Request-Id'] = idempotencyKey;

      // Execute request
      const response = await this.client.execute(request);
      const order = response.result;

      // Find approval URL
      const approvalUrl = order.links.find((link: any) => link.rel === 'approve')?.href || '';

      return {
        orderId: order.id,
        approvalUrl,
        status: order.status,
      };
    } catch (error: any) {
      console.error('PayPal order creation failed:', error.message || error);
      throw new Error(
        error.message || 'Failed to create PayPal order'
      );
    }
  }

  /**
   * Capture PayPal order after user authorization
   * 
   * @param orderId - PayPal order ID
   * @returns Capture response with transaction details
   * 
   * Requirements: 3.4, 3.5, 3.7
   */
  async captureOrder(orderId: string): Promise<PayPalCaptureResponse> {
    try {
      // Create capture request
      const request = new paypal.orders.OrdersCaptureRequest(orderId);
      (request as any).requestBody({});

      // Execute capture
      const response = await this.client.execute(request);
      const order = response.result;

      // Extract capture details
      const capture = order.purchase_units[0].payments.captures[0];
      const payer = order.payer;

      return {
        orderId: order.id,
        captureId: capture.id,
        payerId: payer.payer_id,
        amount: parseFloat(capture.amount.value),
        currency: capture.amount.currency_code,
        status: capture.status,
      };
    } catch (error: any) {
      console.error('PayPal order capture failed:', error.message || error);
      throw new Error(
        error.message || 'Failed to capture PayPal order'
      );
    }
  }

  /**
   * Process refund with PayPal
   * 
   * @param captureId - Original capture ID from PayPal
   * @param amount - Optional partial refund amount
   * @param currency - Currency code for partial refund
   * @returns Refund response
   * 
   * Requirements: 7.5
   */
  async refund(
    captureId: string,
    amount?: number,
    currency?: string
  ): Promise<PayPalRefundResponse> {
    try {
      // Generate unique idempotency key for refund
      const idempotencyKey = this.generateIdempotencyKey();

      // Create refund request
      const request = new paypal.payments.CapturesRefundRequest(captureId);
      request.prefer('return=representation');

      // Add amount if partial refund
      if (amount !== undefined && currency) {
        (request as any).requestBody({
          amount: {
            value: amount.toFixed(2),
            currency_code: currency,
          },
        });
      } else {
        (request as any).requestBody({});
      }

      // Add idempotency key to headers
      (request as any).headers['PayPal-Request-Id'] = idempotencyKey;

      // Execute refund
      const response = await this.client.execute(request);
      const refund = response.result;

      return {
        refundId: refund.id,
        amount: parseFloat(refund.amount.value),
        status: refund.status,
        captureId: captureId,
      };
    } catch (error: any) {
      console.error('PayPal refund failed:', error.message || error);
      throw new Error(
        error.message || 'Failed to process PayPal refund'
      );
    }
  }

  /**
   * Validate webhook signature from PayPal
   * 
   * Note: For production use, implement proper webhook verification using PayPal's
   * webhook verification API or certificate validation. This implementation provides
   * basic header validation.
   * 
   * @param payload - Raw webhook payload string
   * @param headers - Webhook headers from PayPal
   * @returns True if signature is valid
   * 
   * Requirements: 3.9, 4.2
   */
  async validateWebhookSignature(
    payload: string,
    headers: Record<string, string>
  ): Promise<boolean> {
    try {
      // Extract required headers
      const transmissionId = headers['paypal-transmission-id'];
      const transmissionTime = headers['paypal-transmission-time'];
      const certUrl = headers['paypal-cert-url'];
      const authAlgo = headers['paypal-auth-algo'];
      const transmissionSig = headers['paypal-transmission-sig'];

      if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
        console.error('Missing required PayPal webhook headers');
        return false;
      }

      // Validate webhook ID is configured
      if (!this.webhookId) {
        console.error('PayPal webhook ID not configured');
        return false;
      }

      // Basic validation: check if all required headers are present
      // In production, you should verify the signature using PayPal's webhook verification API
      // or by validating the certificate from cert_url
      
      // For now, we validate that the payload is valid JSON and has expected structure
      try {
        const event = JSON.parse(payload);
        if (!event.event_type || !event.resource) {
          console.error('Invalid PayPal webhook payload structure');
          return false;
        }
      } catch (parseError) {
        console.error('Failed to parse PayPal webhook payload');
        return false;
      }

      // TODO: Implement proper signature verification using PayPal's webhook verification API
      // or certificate validation for production use
      return true;
    } catch (error: any) {
      console.error('PayPal webhook signature validation failed:', error.message || error);
      return false;
    }
  }

  /**
   * Process PayPal webhook event
   * 
   * @param event - PayPal webhook event
   * @returns Processed webhook data
   * 
   * Requirements: 3.5, 3.6, 3.7, 3.9, 4.2, 9.9
   */
  async processWebhook(event: PayPalWebhookEvent): Promise<{
    eventType: string;
    orderId?: string;
    captureId?: string;
    payerId?: string;
    refundId?: string;
    amount?: number;
    currency?: string;
    status?: string;
    isSuccess: boolean;
  }> {
    try {
      const { event_type, resource } = event;

      // Handle PAYMENT.CAPTURE.COMPLETED event
      if (event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        return {
          eventType: event_type,
          captureId: resource.id,
          orderId: resource.supplementary_data?.related_ids?.order_id,
          amount: resource.amount ? parseFloat(resource.amount.value) : undefined,
          currency: resource.amount?.currency_code,
          status: resource.status,
          isSuccess: true,
        };
      }

      // Handle PAYMENT.CAPTURE.REFUNDED event
      if (event_type === 'PAYMENT.CAPTURE.REFUNDED') {
        return {
          eventType: event_type,
          captureId: resource.id,
          refundId: resource.id,
          amount: resource.amount ? parseFloat(resource.amount.value) : undefined,
          currency: resource.amount?.currency_code,
          status: 'refunded',
          isSuccess: true,
        };
      }

      throw new Error(`Unhandled PayPal event type: ${event_type}`);
    } catch (error: any) {
      console.error('PayPal webhook processing failed:', error.message || error);
      throw new Error(
        error.message || 'Failed to process PayPal webhook'
      );
    }
  }

  /**
   * Get PayPal order status
   * 
   * @param orderId - PayPal order ID
   * @returns Order status information
   * 
   * Requirements: 13.6, 13.7
   */
  async getOrderStatus(orderId: string): Promise<{
    status: string;
    amount?: number;
    currency?: string;
    captureId?: string;
  }> {
    try {
      // Create order details request
      const request = new paypal.orders.OrdersGetRequest(orderId);

      // Execute request
      const response = await this.client.execute(request);
      const order = response.result;

      // Extract capture details if available
      const capture = order.purchase_units?.[0]?.payments?.captures?.[0];

      return {
        status: order.status === 'COMPLETED' ? 'completed' : order.status.toLowerCase(),
        amount: capture?.amount ? parseFloat(capture.amount.value) : undefined,
        currency: capture?.amount?.currency_code,
        captureId: capture?.id,
      };
    } catch (error: any) {
      console.error('Failed to retrieve PayPal order status:', error.message || error);
      throw new Error(
        error.message || 'Failed to retrieve order status from PayPal'
      );
    }
  }

  /**
   * Generate unique idempotency key
   * 
   * @returns Unique idempotency key
   * 
   * Requirements: 3.8
   */
  private generateIdempotencyKey(): string {
    // Generate UUID v4 style idempotency key
    return `paypal-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Check if service is in sandbox mode
   */
  isSandboxMode(): boolean {
    return this.mode === 'sandbox';
  }

  /**
   * Get PayPal client (for testing purposes)
   */
  getClient(): any {
    return this.client;
  }
}

export default new PayPalService();
