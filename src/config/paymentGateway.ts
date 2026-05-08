import dotenv from 'dotenv';

dotenv.config();

/**
 * Payment Mode Types
 */
export type PaymentMode = 'sandbox' | 'production';

/**
 * Gateway Configuration Interface
 */
export interface GatewayConfig {
  esewa: {
    enabled: boolean;
    mode: 'sandbox' | 'production';
    merchantId: string;
    merchantSecret: string;
  };
  khalti: {
    enabled: boolean;
    mode: 'sandbox' | 'production';
    publicKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  stripe: {
    enabled: boolean;
    mode: 'test' | 'live';
    publicKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  paypal: {
    enabled: boolean;
    mode: 'sandbox' | 'live';
    clientId: string;
    clientSecret: string;
    webhookId: string;
  };
  receiptStoragePath: string;
  rateLimitPerHour: number;
}

/**
 * Load and validate payment gateway configuration from environment variables
 */
function loadGatewayConfig(): GatewayConfig {
  const paymentMode = (process.env.PAYMENT_MODE || 'sandbox') as PaymentMode;
  
  // eSewa Configuration
  const esewaEnabled = process.env.ESEWA_ENABLED === 'true';
  const esewaMerchantId = process.env.ESEWA_MERCHANT_ID || 'EPAYTEST';
  const esewaMerchantSecret = process.env.ESEWA_MERCHANT_SECRET || '';
  
  // Khalti Configuration
  const khaltiEnabled = process.env.KHALTI_ENABLED === 'true';
  const khaltiPublicKey = process.env.KHALTI_PUBLIC_KEY || '';
  const khaltiSecretKey = process.env.KHALTI_SECRET_KEY || '';
  const khaltiWebhookSecret = process.env.KHALTI_WEBHOOK_SECRET || '';
  
  // Stripe Configuration
  const stripeEnabled = process.env.STRIPE_ENABLED === 'true';
  const stripePublicKey = process.env.STRIPE_PUBLIC_KEY || '';
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  
  // PayPal Configuration
  const paypalEnabled = process.env.PAYPAL_ENABLED === 'true';
  const paypalClientId = process.env.PAYPAL_CLIENT_ID || '';
  const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
  const paypalWebhookId = process.env.PAYPAL_WEBHOOK_ID || '';
  
  // Receipt and Rate Limiting
  const receiptStoragePath = process.env.RECEIPT_STORAGE_PATH || './receipts';
  const rateLimitPerHour = parseInt(process.env.PAYMENT_RATE_LIMIT_PER_HOUR || '10', 10);
  
  return {
    esewa: {
      enabled: esewaEnabled,
      mode: paymentMode,
      merchantId: esewaMerchantId,
      merchantSecret: esewaMerchantSecret,
    },
    khalti: {
      enabled: khaltiEnabled,
      mode: paymentMode,
      publicKey: khaltiPublicKey,
      secretKey: khaltiSecretKey,
      webhookSecret: khaltiWebhookSecret,
    },
    stripe: {
      enabled: stripeEnabled,
      mode: paymentMode === 'production' ? 'live' : 'test',
      publicKey: stripePublicKey,
      secretKey: stripeSecretKey,
      webhookSecret: stripeWebhookSecret,
    },
    paypal: {
      enabled: paypalEnabled,
      mode: paymentMode === 'production' ? 'live' : 'sandbox',
      clientId: paypalClientId,
      clientSecret: paypalClientSecret,
      webhookId: paypalWebhookId,
    },
    receiptStoragePath,
    rateLimitPerHour,
  };
}

/**
 * Validate required credentials for enabled gateways
 */
function validateGatewayConfig(config: GatewayConfig): void {
  const errors: string[] = [];
  
  // eSewa validation - only requires merchant ID in sandbox mode
  if (config.esewa.enabled) {
    if (!config.esewa.merchantId) {
      errors.push('ESEWA_MERCHANT_ID is required when eSewa is enabled');
    }
    // Merchant secret is optional in sandbox mode
    if (config.esewa.mode === 'production' && !config.esewa.merchantSecret) {
      errors.push('ESEWA_MERCHANT_SECRET is required when eSewa is in production mode');
    }
  }
  
  // Validate Khalti credentials if enabled
  if (config.khalti.enabled) {
    if (!config.khalti.publicKey) {
      errors.push('KHALTI_PUBLIC_KEY is required when Khalti is enabled');
    }
    if (!config.khalti.secretKey) {
      errors.push('KHALTI_SECRET_KEY is required when Khalti is enabled');
    }
    if (!config.khalti.webhookSecret) {
      errors.push('KHALTI_WEBHOOK_SECRET is required when Khalti is enabled');
    }
  }
  
  // Validate Stripe credentials if enabled
  if (config.stripe.enabled) {
    if (!config.stripe.publicKey) {
      errors.push('STRIPE_PUBLIC_KEY is required when Stripe is enabled');
    }
    if (!config.stripe.secretKey) {
      errors.push('STRIPE_SECRET_KEY is required when Stripe is enabled');
    }
    if (!config.stripe.webhookSecret) {
      errors.push('STRIPE_WEBHOOK_SECRET is required when Stripe is enabled');
    }
  }
  
  // Validate PayPal credentials if enabled
  if (config.paypal.enabled) {
    if (!config.paypal.clientId) {
      errors.push('PAYPAL_CLIENT_ID is required when PayPal is enabled');
    }
    if (!config.paypal.clientSecret) {
      errors.push('PAYPAL_CLIENT_SECRET is required when PayPal is enabled');
    }
    if (!config.paypal.webhookId) {
      errors.push('PAYPAL_WEBHOOK_ID is required when PayPal is enabled');
    }
  }
  
  // Check if at least one gateway is enabled
  if (!config.esewa.enabled && !config.khalti.enabled && !config.stripe.enabled && !config.paypal.enabled) {
    errors.push('At least one payment gateway must be enabled');
  }
  
  if (errors.length > 0) {
    console.error('Payment Gateway Configuration Errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Payment gateway configuration validation failed');
  }
}

/**
 * Log payment gateway configuration on startup
 */
function logGatewayConfig(config: GatewayConfig): void {
  const paymentMode = process.env.PAYMENT_MODE || 'sandbox';
  
  console.log('=== Payment Gateway Configuration ===');
  console.log(`Payment Mode: ${paymentMode.toUpperCase()}`);
  console.log(`eSewa: ${config.esewa.enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Khalti: ${config.khalti.enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Stripe: ${config.stripe.enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`PayPal: ${config.paypal.enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Receipt Storage Path: ${config.receiptStoragePath}`);
  console.log(`Rate Limit: ${config.rateLimitPerHour} requests/hour`);
  console.log('=====================================');
}

// Load configuration
const gatewayConfig = loadGatewayConfig();

// Validate configuration on startup
try {
  validateGatewayConfig(gatewayConfig);
  logGatewayConfig(gatewayConfig);
} catch (error) {
  console.error('Failed to initialize payment gateway configuration:', error);
  // In production, you might want to exit the process
  // process.exit(1);
}

export default gatewayConfig;
