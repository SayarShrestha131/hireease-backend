/**
 * eSewa Payment Service
 * 
 * Handles eSewa payment gateway integration for Nepal
 * eSewa is one of the most popular digital wallets in Nepal
 */

import crypto from 'crypto';

/**
 * eSewa Payment Response
 */
export interface EsewaPaymentResponse {
  paymentUrl: string;
  transactionUuid: string;
  productCode: string;
}

/**
 * eSewa Verification Response
 */
export interface EsewaVerificationResponse {
  transactionCode: string;
  status: 'COMPLETE' | 'PENDING' | 'FAILED';
  totalAmount: string;
  transactionUuid: string;
  productCode: string;
  signedFieldNames: string;
  signature: string;
}

/**
 * EsewaService - Handles eSewa payment gateway integration
 * 
 * eSewa uses a simpler integration compared to Khalti:
 * 1. Generate payment URL with signature
 * 2. Redirect user to eSewa
 * 3. User completes payment on eSewa
 * 4. eSewa redirects back with transaction details
 * 5. Verify transaction using eSewa API
 */
export class EsewaService {
  private merchantId: string;
  private merchantSecret: string;
  private baseUrl: string;
  private mode: string;

  constructor() {
    this.merchantId = process.env.ESEWA_MERCHANT_ID || '';
    this.merchantSecret = process.env.ESEWA_MERCHANT_SECRET || '';
    this.mode = process.env.PAYMENT_MODE || 'sandbox';
    
    // eSewa URLs
    this.baseUrl = this.mode === 'production'
      ? 'https://esewa.com.np/epay'
      : 'https://uat.esewa.com.np/epay';
  }

  /**
   * Create payment request with eSewa
   * 
   * @param amount - Amount in NPR (Nepali Rupees)
   * @param bookingId - Booking reference ID
   * @param returnUrl - URL to redirect after payment
   * @param failureUrl - URL to redirect on payment failure
   * @returns eSewa payment response with payment URL
   */
  async createPaymentRequest(
    amount: number,
    bookingId: string,
    returnUrl: string,
    failureUrl: string
  ): Promise<EsewaPaymentResponse> {
    try {
      // Generate unique transaction UUID
      const transactionUuid = this.generateTransactionUuid();
      
      // Product code (merchant ID for eSewa)
      const productCode = this.merchantId || 'EPAYTEST';
      
      // Calculate tax and service charge (0 for now)
      const taxAmount = 0;
      const serviceCharge = 0;
      const totalAmount = amount;

      // Create signature for security
      const message = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
      const signature = this.generateSignature(message);

      // Build payment URL with parameters
      const params = new URLSearchParams({
        amt: amount.toString(),
        psc: serviceCharge.toString(),
        pdc: '0', // Delivery charge
        txAmt: taxAmount.toString(),
        tAmt: totalAmount.toString(),
        pid: bookingId,
        scd: productCode,
        su: returnUrl,
        fu: failureUrl,
      });

      const paymentUrl = `${this.baseUrl}/main?${params.toString()}`;

      console.log('[EsewaService] Payment request created:', {
        transactionUuid,
        amount: totalAmount,
        bookingId,
        paymentUrl,
      });

      return {
        paymentUrl,
        transactionUuid,
        productCode,
      };
    } catch (error: any) {
      console.error('[EsewaService] Payment request failed:', error);
      throw new Error('Failed to create eSewa payment request');
    }
  }

  /**
   * Verify payment with eSewa
   * 
   * @param transactionCode - Transaction code from eSewa
   * @param totalAmount - Total amount paid
   * @param productCode - Product code (merchant ID)
   * @returns Verification response
   */
  async verifyPayment(
    transactionCode: string,
    totalAmount: string,
    productCode: string
  ): Promise<EsewaVerificationResponse> {
    try {
      console.log('[EsewaService] Verifying payment:', {
        transactionCode,
        totalAmount,
        productCode,
      });

      // In sandbox mode, we can verify by checking if transaction code exists
      // In production, you would call eSewa verification API
      
      if (this.mode === 'sandbox') {
        // For sandbox, accept any transaction code that looks valid
        if (transactionCode && transactionCode.length > 0) {
          return {
            transactionCode,
            status: 'COMPLETE',
            totalAmount,
            transactionUuid: this.generateTransactionUuid(),
            productCode,
            signedFieldNames: 'transaction_code,status,total_amount',
            signature: this.generateSignature(`${transactionCode}${totalAmount}`),
          };
        }
      }

      // For production, implement actual eSewa verification API call
      // Documentation: https://developer.esewa.com.np/

      throw new Error('Payment verification failed');
    } catch (error: any) {
      console.error('[EsewaService] Payment verification failed:', error);
      throw new Error('Failed to verify eSewa payment');
    }
  }

  /**
   * Generate signature for eSewa request
   * 
   * @param message - Message to sign
   * @returns HMAC SHA256 signature
   */
  private generateSignature(message: string): string {
    const secret = this.merchantSecret || 'test_secret_key';
    return crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('base64');
  }

  /**
   * Generate unique transaction UUID
   * 
   * @returns Unique transaction UUID
   */
  private generateTransactionUuid(): string {
    return `TXN-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get payment URL base
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Check if service is in sandbox mode
   */
  isSandboxMode(): boolean {
    return this.mode === 'sandbox';
  }
}

export default new EsewaService();
