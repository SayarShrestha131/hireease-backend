import { PaymentGateway } from '../models/PaymentTransaction';
import circuitBreakerService from './circuitBreakerService';
import gatewayConfig from '../config/paymentGateway';

/**
 * Gateway Response Time Record
 */
interface ResponseTimeRecord {
  timestamp: Date;
  responseTime: number; // in milliseconds
  success: boolean;
}

/**
 * Gateway Health Status
 */
export interface GatewayHealthStatus {
  gateway: PaymentGateway;
  status: 'available' | 'unavailable' | 'disabled';
  averageResponseTime: number;
  slowResponseCount: number;
  circuitState: string;
  lastChecked: Date;
}

/**
 * GatewayMonitoringService - Monitors gateway response times and health
 * 
 * Tracks response times, logs slow responses, and provides health check endpoint
 * showing gateway status.
 * 
 * Requirements: 18.6, 18.7
 */
export class GatewayMonitoringService {
  private responseTimes: Map<PaymentGateway, ResponseTimeRecord[]>;
  private slowResponseThreshold: number = 10000; // 10 seconds
  private monitoringWindow: number = 300000; // 5 minutes
  private maxRecords: number = 100; // Keep last 100 records per gateway

  constructor() {
    this.responseTimes = new Map();

    // Initialize monitoring for all gateways
    this.initializeMonitoring('khalti');
    this.initializeMonitoring('stripe');
    this.initializeMonitoring('paypal');

    console.log('[GatewayMonitoringService] Initialized');
  }

  /**
   * Initialize monitoring for a gateway
   */
  private initializeMonitoring(gateway: PaymentGateway): void {
    this.responseTimes.set(gateway, []);
  }

  /**
   * Record response time for a gateway operation
   * 
   * @param gateway - Payment gateway
   * @param responseTime - Response time in milliseconds
   * @param success - Whether the operation was successful
   */
  recordResponseTime(gateway: PaymentGateway, responseTime: number, success: boolean): void {
    const records = this.responseTimes.get(gateway) || [];

    // Add new record
    records.push({
      timestamp: new Date(),
      responseTime,
      success,
    });

    // Keep only recent records (within monitoring window)
    const cutoffTime = Date.now() - this.monitoringWindow;
    const recentRecords = records.filter(
      (record) => record.timestamp.getTime() > cutoffTime
    );

    // Limit to max records
    if (recentRecords.length > this.maxRecords) {
      recentRecords.splice(0, recentRecords.length - this.maxRecords);
    }

    this.responseTimes.set(gateway, recentRecords);

    // Log slow responses exceeding 10 seconds (Requirements: 18.6)
    if (responseTime > this.slowResponseThreshold) {
      console.warn(
        `[GatewayMonitoringService] SLOW RESPONSE detected for ${gateway}: ${responseTime}ms (threshold: ${this.slowResponseThreshold}ms)`
      );
    }

    // Log response time for debugging
    console.log(
      `[GatewayMonitoringService] ${gateway} response time: ${responseTime}ms (${success ? 'success' : 'failure'})`
    );
  }

  /**
   * Get average response time for a gateway
   * 
   * @param gateway - Payment gateway
   * @returns Average response time in milliseconds
   */
  getAverageResponseTime(gateway: PaymentGateway): number {
    const records = this.responseTimes.get(gateway) || [];

    if (records.length === 0) {
      return 0;
    }

    const total = records.reduce((sum, record) => sum + record.responseTime, 0);
    return Math.round(total / records.length);
  }

  /**
   * Get count of slow responses for a gateway
   * 
   * @param gateway - Payment gateway
   * @returns Count of slow responses
   */
  getSlowResponseCount(gateway: PaymentGateway): number {
    const records = this.responseTimes.get(gateway) || [];
    return records.filter((record) => record.responseTime > this.slowResponseThreshold).length;
  }

  /**
   * Get health status for a specific gateway
   * 
   * @param gateway - Payment gateway
   * @returns Gateway health status
   */
  getGatewayHealth(gateway: PaymentGateway): GatewayHealthStatus {
    // Check if gateway is enabled in configuration
    const isEnabled = this.isGatewayEnabled(gateway);
    
    if (!isEnabled) {
      return {
        gateway,
        status: 'disabled',
        averageResponseTime: 0,
        slowResponseCount: 0,
        circuitState: 'N/A',
        lastChecked: new Date(),
      };
    }

    // Check circuit breaker status
    const isAvailable = circuitBreakerService.isAvailable(gateway);
    const circuitStatus = circuitBreakerService.getStatus(gateway);

    return {
      gateway,
      status: isAvailable ? 'available' : 'unavailable',
      averageResponseTime: this.getAverageResponseTime(gateway),
      slowResponseCount: this.getSlowResponseCount(gateway),
      circuitState: circuitStatus?.state || 'unknown',
      lastChecked: new Date(),
    };
  }

  /**
   * Get health status for all gateways
   * 
   * @returns Array of gateway health statuses
   */
  getAllGatewayHealth(): GatewayHealthStatus[] {
    return [
      this.getGatewayHealth('khalti'),
      this.getGatewayHealth('stripe'),
      this.getGatewayHealth('paypal'),
    ];
  }

  /**
   * Check if gateway is enabled in configuration
   * 
   * @param gateway - Payment gateway
   * @returns True if enabled, false otherwise
   */
  private isGatewayEnabled(gateway: PaymentGateway): boolean {
    switch (gateway) {
      case 'khalti':
        return gatewayConfig.khalti.enabled;
      case 'stripe':
        return gatewayConfig.stripe.enabled;
      case 'paypal':
        return gatewayConfig.paypal.enabled;
      default:
        return false;
    }
  }

  /**
   * Get simple health check response for API endpoint
   * 
   * @returns Health check response
   */
  getHealthCheckResponse(): {
    khalti: 'available' | 'unavailable' | 'disabled';
    stripe: 'available' | 'unavailable' | 'disabled';
    paypal: 'available' | 'unavailable' | 'disabled';
    mode: string;
  } {
    const khaltiHealth = this.getGatewayHealth('khalti');
    const stripeHealth = this.getGatewayHealth('stripe');
    const paypalHealth = this.getGatewayHealth('paypal');

    return {
      khalti: khaltiHealth.status,
      stripe: stripeHealth.status,
      paypal: paypalHealth.status,
      mode: process.env.PAYMENT_MODE || 'sandbox',
    };
  }

  /**
   * Clear monitoring data for a gateway
   * 
   * @param gateway - Payment gateway
   */
  clearMonitoringData(gateway: PaymentGateway): void {
    this.responseTimes.set(gateway, []);
    console.log(`[GatewayMonitoringService] Cleared monitoring data for ${gateway}`);
  }

  /**
   * Clear all monitoring data
   */
  clearAllMonitoringData(): void {
    this.responseTimes.clear();
    this.initializeMonitoring('khalti');
    this.initializeMonitoring('stripe');
    this.initializeMonitoring('paypal');
    console.log('[GatewayMonitoringService] Cleared all monitoring data');
  }
}

export default new GatewayMonitoringService();
