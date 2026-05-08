import PaymentTransaction, { PaymentMethod, PaymentGateway } from '../models/PaymentTransaction';
import auditLogService from './auditLogService';

/**
 * Payment Metrics
 */
export interface PaymentMetrics {
  successRate: number; // Percentage of successful payments
  averageProcessingTime: number; // Average time in milliseconds
  failureRate: number; // Percentage of failed payments
  failuresByReason: Record<string, number>; // Count of failures grouped by reason
  volumeByMethod: Record<PaymentMethod, number>; // Payment count by method
  revenueByMethod: Record<PaymentMethod, number>; // Revenue by method
  totalPayments: number;
  totalSuccessful: number;
  totalFailed: number;
  totalRevenue: number;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}

/**
 * Alert Configuration
 */
interface AlertConfig {
  successRateThreshold: number; // Alert when success rate drops below this percentage
  processingTimeThreshold: number; // Alert when processing time exceeds this (milliseconds)
}

/**
 * PaymentAnalyticsService - Tracks payment metrics and analytics
 * 
 * Monitors payment success rate, processing time, failure reasons, volume, and revenue.
 * Provides alerts when metrics fall below thresholds.
 * 
 * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 20.7
 */
export class PaymentAnalyticsService {
  private alertConfig: AlertConfig;

  constructor(config?: Partial<AlertConfig>) {
    this.alertConfig = {
      successRateThreshold: 85, // Alert when success rate drops below 85%
      processingTimeThreshold: 30000, // Alert when processing time exceeds 30 seconds
      ...config,
    };

    console.log('[PaymentAnalyticsService] Initialized with config:', this.alertConfig);
  }

  /**
   * Get payment metrics for a date range
   * 
   * @param startDate - Start date for metrics
   * @param endDate - End date for metrics
   * @returns Payment metrics
   * 
   * Requirements: 20.1, 20.2, 20.3, 20.4, 20.5
   */
  async getPaymentMetrics(startDate: Date, endDate: Date): Promise<PaymentMetrics> {
    try {
      // Query all payment transactions in date range
      const transactions = await PaymentTransaction.find({
        transactionType: 'payment',
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      }).lean();

      const totalPayments = transactions.length;
      const totalSuccessful = transactions.filter((t) => t.status === 'completed').length;
      const totalFailed = transactions.filter((t) => t.status === 'failed').length;

      // Calculate success rate (Requirements: 20.1)
      const successRate = totalPayments > 0 ? (totalSuccessful / totalPayments) * 100 : 0;

      // Calculate failure rate (Requirements: 20.3)
      const failureRate = totalPayments > 0 ? (totalFailed / totalPayments) * 100 : 0;

      // Calculate average processing time (Requirements: 20.2)
      const completedTransactions = transactions.filter(
        (t) => t.status === 'completed' && t.completedAt && t.initiatedAt
      );

      let averageProcessingTime = 0;
      if (completedTransactions.length > 0) {
        const totalProcessingTime = completedTransactions.reduce((sum, t) => {
          const processingTime = t.completedAt!.getTime() - t.initiatedAt.getTime();
          return sum + processingTime;
        }, 0);
        averageProcessingTime = Math.round(totalProcessingTime / completedTransactions.length);
      }

      // Group failures by reason (Requirements: 20.3)
      const failuresByReason: Record<string, number> = {};
      transactions
        .filter((t) => t.status === 'failed' && t.errorMessage)
        .forEach((t) => {
          const reason = t.errorMessage || 'Unknown error';
          failuresByReason[reason] = (failuresByReason[reason] || 0) + 1;
        });

      // Calculate volume by payment method (Requirements: 20.4)
      const volumeByMethod: Record<PaymentMethod, number> = {
        khalti: 0,
        stripe: 0,
        paypal: 0,
        esewa: 0,
      };

      transactions.forEach((t) => {
        if (t.paymentMethod) {
          volumeByMethod[t.paymentMethod] = (volumeByMethod[t.paymentMethod] || 0) + 1;
        }
      });

      // Calculate revenue by payment method (Requirements: 20.4)
      const revenueByMethod: Record<PaymentMethod, number> = {
        khalti: 0,
        stripe: 0,
        paypal: 0,
        esewa: 0,
      };

      let totalRevenue = 0;

      transactions
        .filter((t) => t.status === 'completed')
        .forEach((t) => {
          if (t.paymentMethod) {
            revenueByMethod[t.paymentMethod] = (revenueByMethod[t.paymentMethod] || 0) + t.amount;
            totalRevenue += t.amount;
          }
        });

      const metrics: PaymentMetrics = {
        successRate: Math.round(successRate * 100) / 100,
        averageProcessingTime,
        failureRate: Math.round(failureRate * 100) / 100,
        failuresByReason,
        volumeByMethod,
        revenueByMethod,
        totalPayments,
        totalSuccessful,
        totalFailed,
        totalRevenue,
        dateRange: {
          startDate,
          endDate,
        },
      };

      // Check for alerts (Requirements: 20.6, 20.7)
      await this.checkAlerts(metrics);

      return metrics;
    } catch (error: any) {
      console.error('[PaymentAnalyticsService] Failed to get payment metrics:', error);
      throw new Error('Failed to retrieve payment metrics');
    }
  }

  /**
   * Check metrics against alert thresholds and trigger alerts
   * 
   * @param metrics - Payment metrics
   * 
   * Requirements: 20.6, 20.7
   */
  private async checkAlerts(metrics: PaymentMetrics): Promise<void> {
    // Alert when success rate drops below threshold (Requirements: 20.6)
    if (metrics.successRate < this.alertConfig.successRateThreshold && metrics.totalPayments > 0) {
      console.error(
        `[PaymentAnalyticsService] ALERT: Payment success rate dropped to ${metrics.successRate}% (threshold: ${this.alertConfig.successRateThreshold}%)`
      );

      await auditLogService.logPaymentAlert({
        alertType: 'low_success_rate',
        message: `Payment success rate dropped to ${metrics.successRate}%`,
        threshold: this.alertConfig.successRateThreshold,
        currentValue: metrics.successRate,
        metrics: {
          totalPayments: metrics.totalPayments,
          totalSuccessful: metrics.totalSuccessful,
          totalFailed: metrics.totalFailed,
        },
      });
    }

    // Alert when processing time exceeds threshold (Requirements: 20.7)
    if (metrics.averageProcessingTime > this.alertConfig.processingTimeThreshold) {
      console.error(
        `[PaymentAnalyticsService] ALERT: Average payment processing time exceeded ${metrics.averageProcessingTime}ms (threshold: ${this.alertConfig.processingTimeThreshold}ms)`
      );

      await auditLogService.logPaymentAlert({
        alertType: 'high_processing_time',
        message: `Average payment processing time exceeded ${metrics.averageProcessingTime}ms`,
        threshold: this.alertConfig.processingTimeThreshold,
        currentValue: metrics.averageProcessingTime,
        metrics: {
          averageProcessingTime: metrics.averageProcessingTime,
        },
      });
    }
  }

  /**
   * Get real-time payment statistics
   * 
   * @returns Current payment statistics
   */
  async getCurrentStatistics(): Promise<{
    last24Hours: PaymentMetrics;
    last7Days: PaymentMetrics;
    last30Days: PaymentMetrics;
  }> {
    const now = new Date();

    // Last 24 hours
    const last24HoursStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last24Hours = await this.getPaymentMetrics(last24HoursStart, now);

    // Last 7 days
    const last7DaysStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last7Days = await this.getPaymentMetrics(last7DaysStart, now);

    // Last 30 days
    const last30DaysStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last30Days = await this.getPaymentMetrics(last30DaysStart, now);

    return {
      last24Hours,
      last7Days,
      last30Days,
    };
  }

  /**
   * Get gateway-specific metrics
   * 
   * @param gateway - Payment gateway
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Gateway-specific metrics
   */
  async getGatewayMetrics(
    gateway: PaymentGateway,
    startDate: Date,
    endDate: Date
  ): Promise<Partial<PaymentMetrics>> {
    try {
      const transactions = await PaymentTransaction.find({
        transactionType: 'payment',
        gateway,
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      }).lean();

      const totalPayments = transactions.length;
      const totalSuccessful = transactions.filter((t) => t.status === 'completed').length;
      const totalFailed = transactions.filter((t) => t.status === 'failed').length;

      const successRate = totalPayments > 0 ? (totalSuccessful / totalPayments) * 100 : 0;
      const failureRate = totalPayments > 0 ? (totalFailed / totalPayments) * 100 : 0;

      const totalRevenue = transactions
        .filter((t) => t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        successRate: Math.round(successRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
        totalPayments,
        totalSuccessful,
        totalFailed,
        totalRevenue,
      };
    } catch (error: any) {
      console.error(`[PaymentAnalyticsService] Failed to get gateway metrics for ${gateway}:`, error);
      throw new Error(`Failed to retrieve metrics for ${gateway}`);
    }
  }

  /**
   * Update alert configuration
   * 
   * @param config - New alert configuration
   */
  updateAlertConfig(config: Partial<AlertConfig>): void {
    this.alertConfig = {
      ...this.alertConfig,
      ...config,
    };
    console.log('[PaymentAnalyticsService] Alert config updated:', this.alertConfig);
  }

  /**
   * Get alert configuration
   * 
   * @returns Current alert configuration
   */
  getAlertConfig(): AlertConfig {
    return { ...this.alertConfig };
  }
}

export default new PaymentAnalyticsService();
