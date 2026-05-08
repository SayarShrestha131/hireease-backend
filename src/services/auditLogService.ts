import mongoose from 'mongoose';

/**
 * Audit Log Entry Interface
 */
export interface AuditLogEntry {
  timestamp: Date;
  eventType: 'payment_attempt' | 'payment_success' | 'payment_failure' | 'webhook_received' | 'webhook_signature_failed' | 'refund_request' | 'refund_success' | 'refund_failure' | 'gateway_outage' | 'payment_alert';
  userId?: string;
  bookingId?: string;
  transactionId?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  gateway?: string;
  gatewayResponse?: any;
  webhookEvent?: string;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

/**
 * Audit Log Schema for MongoDB
 */
const auditLogSchema = new mongoose.Schema({
  timestamp: { type: Date, required: true, index: true },
  eventType: { 
    type: String, 
    required: true,
    enum: [
      'payment_attempt',
      'payment_success',
      'payment_failure',
      'webhook_received',
      'webhook_signature_failed',
      'refund_request',
      'refund_success',
      'refund_failure',
      'gateway_outage',
      'payment_alert'
    ],
    index: true
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  bookingId: { type: String, index: true },
  transactionId: { type: String, index: true },
  amount: { type: Number },
  currency: { type: String },
  paymentMethod: { type: String, enum: ['khalti', 'stripe', 'paypal'] },
  gateway: { type: String, enum: ['khalti', 'stripe', 'paypal'] },
  gatewayResponse: { type: mongoose.Schema.Types.Mixed },
  webhookEvent: { type: String },
  errorMessage: { type: String },
  ipAddress: { type: String },
  userAgent: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, {
  timestamps: false, // We use our own timestamp field
  collection: 'audit_logs'
});

// Create indexes for efficient querying
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ gateway: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

/**
 * AuditLogService - Comprehensive audit logging for payment operations
 * 
 * Implements audit logging requirements for PCI DSS compliance and security monitoring.
 * All payment-related operations are logged with sanitized data (no sensitive card information).
 * 
 * Requirements: 4.8, 17.8
 */
export class AuditLogService {
  /**
   * Log payment attempt
   * 
   * @param entry - Audit log entry data
   * @returns Promise<void>
   * 
   * Requirements: 4.8, 17.8
   */
  async logPaymentAttempt(entry: {
    userId: string;
    bookingId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await AuditLog.create({
        timestamp: new Date(),
        eventType: 'payment_attempt',
        userId: new mongoose.Types.ObjectId(entry.userId),
        bookingId: entry.bookingId,
        amount: entry.amount,
        currency: entry.currency,
        paymentMethod: entry.paymentMethod,
        gateway: entry.paymentMethod, // Gateway matches payment method
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      });

      console.log(`[AuditLog] Payment attempt logged - User: ${entry.userId}, Booking: ${entry.bookingId}, Amount: ${entry.amount} ${entry.currency}, Method: ${entry.paymentMethod}`);
    } catch (error: any) {
      console.error('[AuditLog] Failed to log payment attempt:', error.message);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Log successful payment
   * 
   * @param entry - Audit log entry data
   * @returns Promise<void>
   * 
   * Requirements: 4.8, 17.8
   */
  async logPaymentSuccess(entry: {
    userId: string;
    bookingId: string;
    transactionId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    gatewayResponse: any;
  }): Promise<void> {
    try {
      // Sanitize gateway response - remove any sensitive data
      const sanitizedResponse = this.sanitizeGatewayResponse(entry.gatewayResponse, entry.paymentMethod);

      await AuditLog.create({
        timestamp: new Date(),
        eventType: 'payment_success',
        userId: new mongoose.Types.ObjectId(entry.userId),
        bookingId: entry.bookingId,
        transactionId: entry.transactionId,
        amount: entry.amount,
        currency: entry.currency,
        paymentMethod: entry.paymentMethod,
        gateway: entry.paymentMethod,
        gatewayResponse: sanitizedResponse,
      });

      console.log(`[AuditLog] Payment success logged - Transaction: ${entry.transactionId}, Amount: ${entry.amount} ${entry.currency}`);
    } catch (error: any) {
      console.error('[AuditLog] Failed to log payment success:', error.message);
    }
  }

  /**
   * Log failed payment
   * 
   * @param entry - Audit log entry data
   * @returns Promise<void>
   * 
   * Requirements: 4.8, 17.8
   */
  async logPaymentFailure(entry: {
    userId: string;
    bookingId: string;
    transactionId?: string;
    amount: number;
    currency: string;
    paymentMethod: string;
    errorMessage: string;
    gatewayResponse?: any;
  }): Promise<void> {
    try {
      // Sanitize gateway response
      const sanitizedResponse = entry.gatewayResponse 
        ? this.sanitizeGatewayResponse(entry.gatewayResponse, entry.paymentMethod)
        : undefined;

      await AuditLog.create({
        timestamp: new Date(),
        eventType: 'payment_failure',
        userId: new mongoose.Types.ObjectId(entry.userId),
        bookingId: entry.bookingId,
        transactionId: entry.transactionId,
        amount: entry.amount,
        currency: entry.currency,
        paymentMethod: entry.paymentMethod,
        gateway: entry.paymentMethod,
        errorMessage: entry.errorMessage,
        gatewayResponse: sanitizedResponse,
      });

      console.log(`[AuditLog] Payment failure logged - User: ${entry.userId}, Booking: ${entry.bookingId}, Error: ${entry.errorMessage}`);
    } catch (error: any) {
      console.error('[AuditLog] Failed to log payment failure:', error.message);
    }
  }

  /**
   * Log webhook received
   * 
   * @param entry - Audit log entry data
   * @returns Promise<void>
   * 
   * Requirements: 4.8, 17.8
   */
  async logWebhookReceived(entry: {
    gateway: string;
    webhookEvent: string;
    transactionId?: string;
    payload: any;
  }): Promise<void> {
    try {
      // Sanitize webhook payload
      const sanitizedPayload = this.sanitizeGatewayResponse(entry.payload, entry.gateway);

      await AuditLog.create({
        timestamp: new Date(),
        eventType: 'webhook_received',
        gateway: entry.gateway,
        webhookEvent: entry.webhookEvent,
        transactionId: entry.transactionId,
        gatewayResponse: sanitizedPayload,
      });

      console.log(`[AuditLog] Webhook received logged - Gateway: ${entry.gateway}, Event: ${entry.webhookEvent}`);
    } catch (error: any) {
      console.error('[AuditLog] Failed to log webhook received:', error.message);
    }
  }

  /**
   * Log webhook signature validation failure (security alert)
   * 
   * @param entry - Audit log entry data
   * @returns Promise<void>
   * 
   * Requirements: 4.8, 17.8
   */
  async logWebhookSignatureFailure(entry: {
    gateway: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await AuditLog.create({
        timestamp: new Date(),
        eventType: 'webhook_signature_failed',
        gateway: entry.gateway,
        errorMessage: 'Webhook signature validation failed - potential security threat',
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: entry.metadata,
      });

      console.error(`[AuditLog] SECURITY ALERT - Webhook signature validation failed for ${entry.gateway} from IP: ${entry.ipAddress}`);
    } catch (error: any) {
      console.error('[AuditLog] Failed to log webhook signature failure:', error.message);
    }
  }

  /**
   * Log refund request
   * 
   * @param entry - Audit log entry data
   * @returns Promise<void>
   * 
   * Requirements: 4.8, 17.8
   */
  async logRefundRequest(entry: {
    userId: string;
    bookingId: string;
    transactionId: string;
    amount: number;
    currency: string;
    gateway: string;
    reason: string;
  }): Promise<void> {
    try {
      await AuditLog.create({
        timestamp: new Date(),
        eventType: 'refund_request',
        userId: new mongoose.Types.ObjectId(entry.userId),
        bookingId: entry.bookingId,
        transactionId: entry.transactionId,
        amount: entry.amount,
        currency: entry.currency,
        gateway: entry.gateway,
        metadata: { reason: entry.reason },
      });

      console.log(`[AuditLog] Refund request logged - Transaction: ${entry.transactionId}, Amount: ${entry.amount} ${entry.currency}, Reason: ${entry.reason}`);
    } catch (error: any) {
      console.error('[AuditLog] Failed to log refund request:', error.message);
    }
  }

  /**
   * Log successful refund
   * 
   * @param entry - Audit log entry data
   * @returns Promise<void>
   * 
   * Requirements: 4.8, 17.8
   */
  async logRefundSuccess(entry: {
    userId: string;
    bookingId: string;
    transactionId: string;
    refundId: string;
    amount: number;
    currency: string;
    gateway: string;
    gatewayResponse: any;
  }): Promise<void> {
    try {
      // Sanitize gateway response
      const sanitizedResponse = this.sanitizeGatewayResponse(entry.gatewayResponse, entry.gateway);

      await AuditLog.create({
        timestamp: new Date(),
        eventType: 'refund_success',
        userId: new mongoose.Types.ObjectId(entry.userId),
        bookingId: entry.bookingId,
        transactionId: entry.transactionId,
        amount: entry.amount,
        currency: entry.currency,
        gateway: entry.gateway,
        gatewayResponse: sanitizedResponse,
        metadata: { refundId: entry.refundId },
      });

      console.log(`[AuditLog] Refund success logged - Refund ID: ${entry.refundId}, Amount: ${entry.amount} ${entry.currency}`);
    } catch (error: any) {
      console.error('[AuditLog] Failed to log refund success:', error.message);
    }
  }

  /**
   * Log failed refund
   * 
   * @param entry - Audit log entry data
   * @returns Promise<void>
   * 
   * Requirements: 4.8, 17.8
   */
  async logRefundFailure(entry: {
    userId: string;
    bookingId: string;
    transactionId: string;
    amount: number;
    currency: string;
    gateway: string;
    errorMessage: string;
  }): Promise<void> {
    try {
      await AuditLog.create({
        timestamp: new Date(),
        eventType: 'refund_failure',
        userId: new mongoose.Types.ObjectId(entry.userId),
        bookingId: entry.bookingId,
        transactionId: entry.transactionId,
        amount: entry.amount,
        currency: entry.currency,
        gateway: entry.gateway,
        errorMessage: entry.errorMessage,
      });

      console.log(`[AuditLog] Refund failure logged - Transaction: ${entry.transactionId}, Error: ${entry.errorMessage}`);
    } catch (error: any) {
      console.error('[AuditLog] Failed to log refund failure:', error.message);
    }
  }

  /**
   * Sanitize gateway response to remove sensitive data
   * 
   * Ensures no complete card numbers or CVV codes are logged (PCI DSS compliance)
   * 
   * @param response - Gateway response object
   * @param gateway - Payment gateway name
   * @returns Sanitized response object
   * 
   * Requirements: 4.5, 17.1, 17.2
   */
  private sanitizeGatewayResponse(response: any, gateway: string): any {
    if (!response) return null;

    // Create a deep copy to avoid modifying original
    const sanitized = JSON.parse(JSON.stringify(response));

    // Remove sensitive fields that might contain card data
    const sensitiveFields = [
      'card_number',
      'cardNumber',
      'card',
      'cvv',
      'cvc',
      'cvv2',
      'card_cvv',
      'card_cvc',
      'pan',
      'track_data',
      'magnetic_stripe',
      'pin',
      'password',
      'secret',
      'private_key',
      'api_key',
      'access_token',
      'refresh_token',
    ];

    // Recursively remove sensitive fields
    const removeSensitiveFields = (obj: any): void => {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          removeSensitiveFields(obj[key]);
        }
      }
    };

    removeSensitiveFields(sanitized);

    // Gateway-specific sanitization
    if (gateway === 'stripe') {
      // Mask last 4 digits of card if present
      if (sanitized.payment_method_details?.card?.last4) {
        sanitized.payment_method_details.card.last4 = '****';
      }
      if (sanitized.charges?.data) {
        sanitized.charges.data.forEach((charge: any) => {
          if (charge.payment_method_details?.card?.last4) {
            charge.payment_method_details.card.last4 = '****';
          }
        });
      }
    }

    return sanitized;
  }

  /**
   * Query audit logs with filters
   * 
   * @param filters - Query filters
   * @returns Promise<AuditLogEntry[]>
   */
  async queryLogs(filters: {
    userId?: string;
    bookingId?: string;
    transactionId?: string;
    eventType?: string;
    gateway?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<any[]> {
    try {
      const query: any = {};

      if (filters.userId) {
        query.userId = new mongoose.Types.ObjectId(filters.userId);
      }
      if (filters.bookingId) {
        query.bookingId = filters.bookingId;
      }
      if (filters.transactionId) {
        query.transactionId = filters.transactionId;
      }
      if (filters.eventType) {
        query.eventType = filters.eventType;
      }
      if (filters.gateway) {
        query.gateway = filters.gateway;
      }
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) {
          query.timestamp.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.timestamp.$lte = filters.endDate;
        }
      }

      const limit = filters.limit || 100;

      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return logs;
    } catch (error: any) {
      console.error('[AuditLog] Failed to query logs:', error.message);
      throw new Error('Failed to query audit logs');
    }
  }

  /**
   * Log gateway outage
   * 
   * @param entry - Audit log entry data
   * @returns Promise<void>
   * 
   * Requirements: 18.5
   */
  async logGatewayOutage(entry: {
    gateway: string;
    failureCount: number;
    lastError: string;
    nextRetryTime: Date;
  }): Promise<void> {
    try {
      await AuditLog.create({
        timestamp: new Date(),
        eventType: 'gateway_outage',
        gateway: entry.gateway,
        errorMessage: `Gateway outage detected after ${entry.failureCount} consecutive failures: ${entry.lastError}`,
        metadata: {
          failureCount: entry.failureCount,
          nextRetryTime: entry.nextRetryTime,
        },
      });

      console.error(`[AuditLog] GATEWAY OUTAGE - ${entry.gateway} is unavailable. Next retry: ${entry.nextRetryTime.toISOString()}`);
    } catch (error: any) {
      console.error('[AuditLog] Failed to log gateway outage:', error.message);
    }
  }

  /**
   * Log payment alert
   * 
   * @param entry - Audit log entry data
   * @returns Promise<void>
   * 
   * Requirements: 20.6, 20.7
   */
  async logPaymentAlert(entry: {
    alertType: 'low_success_rate' | 'high_processing_time';
    message: string;
    threshold: number;
    currentValue: number;
    metrics?: Record<string, any>;
  }): Promise<void> {
    try {
      await AuditLog.create({
        timestamp: new Date(),
        eventType: 'payment_alert',
        errorMessage: entry.message,
        metadata: {
          alertType: entry.alertType,
          threshold: entry.threshold,
          currentValue: entry.currentValue,
          metrics: entry.metrics,
        },
      });

      console.error(`[AuditLog] PAYMENT ALERT - ${entry.alertType}: ${entry.message}`);
    } catch (error: any) {
      console.error('[AuditLog] Failed to log payment alert:', error.message);
    }
  }

  /**
   * Log payment status mismatch between local database and gateway
   * 
   * @param entry - Audit log entry data
   * @returns Promise<void>
   * 
   * Requirements: 13.6, 13.7
   */
  async logPaymentStatusMismatch(entry: {
    transactionId: string;
    localStatus: string;
    gatewayStatus: string;
    gateway: string;
    userId?: string;
  }): Promise<void> {
    try {
      await AuditLog.create({
        timestamp: new Date(),
        eventType: 'payment_alert',
        transactionId: entry.transactionId,
        gateway: entry.gateway,
        userId: entry.userId ? new mongoose.Types.ObjectId(entry.userId) : undefined,
        errorMessage: `Payment status mismatch detected - Local: ${entry.localStatus}, Gateway: ${entry.gatewayStatus}`,
        metadata: {
          alertType: 'status_mismatch',
          localStatus: entry.localStatus,
          gatewayStatus: entry.gatewayStatus,
        },
      });

      console.error(`[AuditLog] STATUS MISMATCH - Transaction ${entry.transactionId}: Local=${entry.localStatus}, Gateway=${entry.gatewayStatus}`);
    } catch (error: any) {
      console.error('[AuditLog] Failed to log payment status mismatch:', error.message);
    }
  }
}

export default new AuditLogService();
