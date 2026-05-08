import Stripe from 'stripe';
import crypto from 'crypto';
import gatewayConfig from '../config/paymentGateway';

/**
 * Stripe Payment Intent Response
 */
export interface StripePaymentIntentResponse {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Stripe Refund Response
 */
export interface StripeRefundResponse {
  refundId: string;
  amount: number;
  status: string;
  chargeId: string;
}

/**
 * StripeService - Handles Stripe payment gateway integration
 * 
 * Implements Stripe API for payment processing, verification, and refunds.
 * Supports both test and live modes with 3D Secure authentication.
 */
export class StripeService {
  private stripe: any;
  private webhookSecret: string;
  private mode: 'test' | 'live';

  constructor() {
    const config = gatewayConfig.stripe;
    
    this.mode = config.mode;
    this.webhookSecret = config.webhookSecret;

    // Initialize Stripe client with secret key only if enabled and has valid key
    if (config.enabled && config.secretKey) {
      this.stripe = new Stripe(config.secretKey, {
        apiVersion: '2026-03-25.dahlia',
        typescript: true,
      });
    } else {
      // Create a dummy stripe instance for disabled gateway
      this.stripe = null;
    }
  }

  /**
   * Create Payment Intent with Stripe
   * 
   * @param amount - Amount in smallest currency unit (cents for USD, paisa for NPR)
   * @param currency - Currency code (USD, NPR)
   * @param metadata - Additional metadata for the payment
   * @returns Stripe Payment Intent response with client secret
   * 
   * Requirements: 2.1, 2.2, 2.4, 12.3
   */
  async createPaymentIntent(
    amount: number,
    currency: string,
    metadata: Record<string, string>
  ): Promise<StripePaymentIntentResponse> {
    if (!this.stripe) {
      throw new Error('Stripe is not enabled or configured');
    }
    
    try {
      // Generate unique idempotency key
      const idempotencyKey = this.generateIdempotencyKey();

      // Create Payment Intent
      const paymentIntent = await this.stripe.paymentIntents.create(
        {
          amount: Math.round(amount), // Ensure integer amount in smallest unit
          currency: currency.toLowerCase(),
          metadata,
          automatic_payment_methods: {
            enabled: true,
          },
        },
        {
          idempotencyKey,
        }
      );

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error: any) {
      console.error('Stripe Payment Intent creation failed:', error.message);
      throw new Error(
        error.message || 'Failed to create Stripe Payment Intent'
      );
    }
  }

  /**
   * Process refund with Stripe
   * 
   * @param chargeId - Original charge ID from Stripe
   * @param amount - Optional partial refund amount in smallest currency unit
   * @returns Refund response
   * 
   * Requirements: 2.10, 7.4
   */
  async refund(chargeId: string, amount?: number): Promise<StripeRefundResponse> {
    if (!this.stripe) {
      throw new Error('Stripe is not enabled or configured');
    }
    
    try {
      // Generate unique idempotency key for refund
      const idempotencyKey = this.generateIdempotencyKey();

      const refundParams: any = {
        charge: chargeId,
      };

      // Add amount if partial refund
      if (amount !== undefined) {
        refundParams.amount = Math.round(amount);
      }

      const refund = await this.stripe.refunds.create(
        refundParams,
        {
          idempotencyKey,
        }
      );

      return {
        refundId: refund.id,
        amount: refund.amount,
        status: refund.status,
        chargeId: refund.charge as string,
      };
    } catch (error: any) {
      console.error('Stripe refund failed:', error.message);
      throw new Error(
        error.message || 'Failed to process Stripe refund'
      );
    }
  }

  /**
   * Validate webhook signature from Stripe
   * 
   * @param payload - Raw webhook payload string
   * @param signature - Signature from Stripe-Signature header
   * @returns True if signature is valid
   * 
   * Requirements: 2.5, 4.2, 4.3
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    if (!this.stripe) {
      return false;
    }
    
    try {
      // Stripe SDK handles signature verification
      this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );
      return true;
    } catch (error: any) {
      console.error('Stripe webhook signature validation failed:', error.message);
      return false;
    }
  }

  /**
   * Process Stripe webhook event
   * 
   * @param payload - Raw webhook payload string
   * @param signature - Signature from Stripe-Signature header
   * @returns Processed webhook data
   * 
   * Requirements: 2.6, 2.7, 2.8, 2.9, 9.8
   */
  async processWebhook(payload: string, signature: string): Promise<{
    eventType: string;
    paymentIntentId?: string;
    chargeId?: string;
    paymentMethodId?: string;
    amount?: number;
    currency?: string;
    status?: string;
    isSuccess: boolean;
    metadata?: Record<string, string>;
  }> {
    if (!this.stripe) {
      throw new Error('Stripe is not enabled or configured');
    }
    
    try {
      // Construct and verify event
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as any;
          return {
            eventType: event.type,
            paymentIntentId: paymentIntent.id,
            chargeId: paymentIntent.latest_charge as string,
            paymentMethodId: paymentIntent.payment_method as string,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            isSuccess: true,
            metadata: paymentIntent.metadata as Record<string, string>,
          };
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as any;
          return {
            eventType: event.type,
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
            currency: paymentIntent.currency,
            status: paymentIntent.status,
            isSuccess: false,
            metadata: paymentIntent.metadata as Record<string, string>,
          };
        }

        case 'charge.refunded': {
          const charge = event.data.object as any;
          return {
            eventType: event.type,
            chargeId: charge.id,
            paymentIntentId: charge.payment_intent as string,
            amount: charge.amount_refunded,
            currency: charge.currency,
            status: 'refunded',
            isSuccess: true,
            metadata: charge.metadata as Record<string, string>,
          };
        }

        default:
          throw new Error(`Unhandled event type: ${event.type}`);
      }
    } catch (error: any) {
      console.error('Stripe webhook processing failed:', error.message);
      throw new Error(
        error.message || 'Failed to process Stripe webhook'
      );
    }
  }

  /**
   * Get Payment Intent status from Stripe
   * 
   * @param paymentIntentId - Stripe Payment Intent ID
   * @returns Payment Intent status information
   * 
   * Requirements: 13.6, 13.7
   */
  async getPaymentIntentStatus(paymentIntentId: string): Promise<{
    status: string;
    amount: number;
    currency: string;
    chargeId?: string;
    paymentMethodId?: string;
  }> {
    if (!this.stripe) {
      throw new Error('Stripe is not enabled or configured');
    }
    
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);

      return {
        status: paymentIntent.status === 'succeeded' ? 'completed' : paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        chargeId: paymentIntent.latest_charge as string,
        paymentMethodId: paymentIntent.payment_method as string,
      };
    } catch (error: any) {
      console.error('Failed to retrieve Stripe Payment Intent status:', error.message);
      throw new Error(
        error.message || 'Failed to retrieve Payment Intent status from Stripe'
      );
    }
  }

  /**
   * Generate unique idempotency key
   * 
   * @returns Unique idempotency key
   * 
   * Requirements: 2.3
   */
  private generateIdempotencyKey(): string {
    // Generate UUID v4 style idempotency key
    return `stripe-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Check if service is in test mode
   */
  isTestMode(): boolean {
    return this.mode === 'test';
  }

  /**
   * Get Stripe instance (for testing purposes)
   */
  getStripeInstance(): any {
    return this.stripe;
  }
}

export default new StripeService();
