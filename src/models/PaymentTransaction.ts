import mongoose, { Document, Schema } from 'mongoose';

/**
 * Transaction Type
 */
export type TransactionType = 'payment' | 'refund';

/**
 * Payment Status Types
 */
export type PaymentTransactionStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded';

/**
 * Payment Method Types
 */
export type PaymentMethod = 'khalti' | 'stripe' | 'paypal' | 'esewa';

/**
 * Payment Gateway Types
 */
export type PaymentGateway = 'khalti' | 'stripe' | 'paypal' | 'esewa';

/**
 * IPaymentTransaction Interface
 */
export interface IPaymentTransaction extends Document {
  // References
  bookingId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  
  // Transaction Details
  transactionId: string; // Unique internal transaction ID
  transactionType: TransactionType;
  
  // Payment Information
  amount: number;
  currency: string; // 'NPR', 'USD'
  paymentMethod: PaymentMethod;
  gateway: PaymentGateway;
  
  // Status
  status: PaymentTransactionStatus;
  
  // Gateway-Specific Data
  gatewayTransactionId?: string; // Transaction ID from gateway
  gatewayPaymentIntentId?: string; // Stripe Payment Intent ID
  gatewayOrderId?: string; // PayPal Order ID
  gatewayChargeId?: string; // Stripe Charge ID
  gatewayCaptureId?: string; // PayPal Capture ID
  gatewayPayerId?: string; // PayPal Payer ID
  gatewayPaymentToken?: string; // Khalti payment token
  
  // Metadata
  gatewayMetadata: Record<string, any>; // Store full gateway response
  
  // Idempotency
  idempotencyKey: string; // Unique key for duplicate prevention
  
  // Error Handling
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  
  // Receipt
  receiptNumber?: string; // Format: RCP-YYYYMMDD-XXXX
  receiptPath?: string; // File path to PDF receipt
  
  // Webhook
  webhookPayload?: Record<string, any>; // Raw webhook data for audit
  webhookProcessedAt?: Date;
  
  // Timestamps
  initiatedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  refundedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment Transaction Schema
 */
const paymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    transactionType: {
      type: String,
      enum: ['payment', 'refund'],
      default: 'payment',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      enum: ['NPR', 'USD'],
      default: 'NPR',
    },
    paymentMethod: {
      type: String,
      enum: ['khalti', 'stripe', 'paypal', 'esewa'],
      required: true,
    },
    gateway: {
      type: String,
      enum: ['khalti', 'stripe', 'paypal', 'esewa'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
      default: 'pending',
      required: true,
      index: true,
    },
    gatewayTransactionId: {
      type: String,
      required: false,
      index: true,
    },
    gatewayPaymentIntentId: {
      type: String,
      required: false,
    },
    gatewayOrderId: {
      type: String,
      required: false,
    },
    gatewayChargeId: {
      type: String,
      required: false,
    },
    gatewayCaptureId: {
      type: String,
      required: false,
    },
    gatewayPayerId: {
      type: String,
      required: false,
    },
    gatewayPaymentToken: {
      type: String,
      required: false,
    },
    gatewayMetadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
    errorCode: {
      type: String,
      required: false,
    },
    errorMessage: {
      type: String,
      required: false,
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    receiptNumber: {
      type: String,
      required: false,
    },
    receiptPath: {
      type: String,
      required: false,
    },
    webhookPayload: {
      type: Schema.Types.Mixed,
      required: false,
    },
    webhookProcessedAt: {
      type: Date,
      required: false,
    },
    initiatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      required: false,
    },
    failedAt: {
      type: Date,
      required: false,
    },
    refundedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
paymentTransactionSchema.index({ userId: 1, status: 1 });
paymentTransactionSchema.index({ gateway: 1, status: 1 });
paymentTransactionSchema.index({ createdAt: -1 });

/**
 * Generate unique transaction ID
 */
paymentTransactionSchema.pre('save', async function (next) {
  if (!this.transactionId) {
    // Generate transaction ID: TXN-YYYYMMDD-XXXX
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.floor(1000 + Math.random() * 9000);
    this.transactionId = `TXN-${dateStr}-${random}`;
  }
  next();
});

const PaymentTransaction = mongoose.model<IPaymentTransaction>(
  'PaymentTransaction',
  paymentTransactionSchema
);

export default PaymentTransaction;
