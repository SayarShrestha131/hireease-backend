/**
 * Payment Error Mapper
 * Maps gateway error codes and internal errors to user-friendly messages
 * 
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8
 */

export interface PaymentErrorResponse {
  message: string;
  supportContact?: string;
  suggestedAction?: string;
}

/**
 * Support contact information
 */
const SUPPORT_CONTACT = {
  email: 'support@hireease.com',
  phone: '+977-1-234567',
};

/**
 * Gateway-specific error code mappings
 */
const KHALTI_ERROR_CODES: Record<string, string> = {
  'insufficient_balance': 'Payment failed due to insufficient funds in your Khalti wallet.',
  'invalid_credentials': 'Invalid payment credentials. Please try again.',
  'transaction_limit_exceeded': 'Transaction limit exceeded. Please contact Khalti support.',
  'user_not_found': 'Khalti user not found. Please verify your account.',
  'invalid_pin': 'Invalid PIN entered. Please try again.',
};

const STRIPE_ERROR_CODES: Record<string, string> = {
  'card_declined': 'Your card was declined. Please try a different payment method.',
  'insufficient_funds': 'Payment failed due to insufficient funds.',
  'invalid_card_number': 'Invalid card number. Please check your card details.',
  'invalid_expiry_date': 'Invalid card expiry date. Please check your card details.',
  'invalid_cvc': 'Invalid CVC code. Please check your card details.',
  'expired_card': 'Your card has expired. Please use a different card.',
  'incorrect_cvc': 'Incorrect CVC code. Please verify your card details.',
  'processing_error': 'An error occurred while processing your card. Please try again.',
  'rate_limit': 'Too many requests. Please wait a moment and try again.',
};

const PAYPAL_ERROR_CODES: Record<string, string> = {
  'INSUFFICIENT_FUNDS': 'Payment failed due to insufficient funds in your PayPal account.',
  'INVALID_ACCOUNT_STATUS': 'Your PayPal account status is invalid. Please contact PayPal support.',
  'TRANSACTION_REFUSED': 'Transaction was refused by PayPal. Please try a different payment method.',
  'PAYER_ACCOUNT_LOCKED_OR_CLOSED': 'Your PayPal account is locked or closed. Please contact PayPal support.',
  'PAYER_CANNOT_PAY': 'Your PayPal account cannot complete this payment. Please contact PayPal support.',
};

/**
 * Map gateway error code to user-friendly message
 * 
 * @param gateway - Payment gateway (khalti, stripe, paypal)
 * @param errorCode - Gateway-specific error code
 * @returns User-friendly error message
 */
export function mapGatewayErrorCode(gateway: string, errorCode: string): string {
  switch (gateway.toLowerCase()) {
    case 'khalti':
      return KHALTI_ERROR_CODES[errorCode] || 'Payment failed. Please try again or use a different payment method.';
    
    case 'stripe':
      return STRIPE_ERROR_CODES[errorCode] || 'Payment failed. Please verify your card details and try again.';
    
    case 'paypal':
      return PAYPAL_ERROR_CODES[errorCode] || 'Payment failed. Please try again or use a different payment method.';
    
    default:
      return 'Payment failed. Please try again.';
  }
}

/**
 * Map error message to user-friendly response
 * Never exposes internal errors or stack traces
 * 
 * @param error - Error object or message
 * @param gateway - Optional payment gateway for gateway-specific errors
 * @returns User-friendly error response
 */
export function mapPaymentError(error: any, gateway?: string): PaymentErrorResponse {
  const message = error.message || error.toString() || 'An error occurred';
  
  // Insufficient funds
  if (message.includes('insufficient') || message.includes('balance')) {
    return {
      message: 'Payment failed due to insufficient funds. Please check your account balance and try again.',
      suggestedAction: 'Verify your account balance or try a different payment method.',
    };
  }

  // Invalid card
  if (message.includes('card') || message.includes('invalid') || message.includes('declined')) {
    return {
      message: 'Payment failed due to invalid card details. Please verify your payment information and try again.',
      suggestedAction: 'Check your card number, expiry date, and CVC code, or try a different card.',
    };
  }

  // Network timeout
  if (message.includes('timeout') || message.includes('network') || message.includes('connection')) {
    return {
      message: 'Payment failed due to a connection issue. Please check your internet connection and try again.',
      suggestedAction: 'Ensure you have a stable internet connection and retry the payment.',
    };
  }

  // Gateway error
  if (message.includes('gateway') || message.includes('service unavailable') || message.includes('unavailable')) {
    return {
      message: 'Payment gateway is temporarily unavailable. Please try a different payment method or try again later.',
      suggestedAction: 'Try using an alternative payment method (Khalti, Stripe, or PayPal).',
      supportContact: `If the issue persists, contact support at ${SUPPORT_CONTACT.email}`,
    };
  }

  // Rate limit
  if (message.includes('rate limit') || message.includes('too many')) {
    return {
      message: 'Too many payment attempts. Please wait a moment before trying again.',
      suggestedAction: 'Wait a few minutes and retry your payment.',
    };
  }

  // Retry limit
  if (message.includes('retry') || message.includes('Maximum') || message.includes('attempts')) {
    return {
      message: message, // Already user-friendly
      suggestedAction: 'Please create a new booking to try again.',
      supportContact: `Need help? Contact us at ${SUPPORT_CONTACT.email}`,
    };
  }

  // Not found
  if (message.includes('not found')) {
    return {
      message: message, // Already user-friendly
      supportContact: `If you believe this is an error, contact support at ${SUPPORT_CONTACT.email}`,
    };
  }

  // Unauthorized
  if (message.includes('Unauthorized') || message.includes('unauthorized')) {
    return {
      message: message, // Already user-friendly
    };
  }

  // Booking status errors
  if (message.includes('status') || message.includes('pending')) {
    return {
      message: message, // Already user-friendly
      supportContact: `Need assistance? Contact support at ${SUPPORT_CONTACT.email}`,
    };
  }

  // Default error - never expose internal details
  return {
    message: 'Payment processing failed. Please try again.',
    suggestedAction: 'If the problem continues, try a different payment method.',
    supportContact: `For assistance, contact support at ${SUPPORT_CONTACT.email} or call ${SUPPORT_CONTACT.phone}`,
  };
}

/**
 * Log detailed error for debugging (server-side only)
 * 
 * @param error - Error object
 * @param context - Additional context information
 */
export function logPaymentError(error: any, context: Record<string, any>): void {
  console.error('[Payment Error]', {
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      code: error.code,
    },
    context,
  });
}
