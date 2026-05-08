import { PaymentGateway } from '../models/PaymentTransaction';
import circuitBreakerService from '../services/circuitBreakerService';
import gatewayMonitoringService from '../services/gatewayMonitoringService';

/**
 * Gateway Executor - Wraps gateway calls with circuit breaker and monitoring
 * 
 * Provides unified error handling, circuit breaker protection, and response time monitoring
 * for all payment gateway operations.
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6
 */
export class GatewayExecutor {
  /**
   * Execute a gateway operation with circuit breaker and monitoring
   * 
   * @param gateway - Payment gateway
   * @param operation - Async operation to execute
   * @param operationName - Name of the operation for logging
   * @returns Promise with operation result
   * 
   * @throws Error if circuit is open or operation fails
   */
  static async execute<T>(
    gateway: PaymentGateway,
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    // Check if gateway is available (circuit breaker check)
    if (!circuitBreakerService.isAvailable(gateway)) {
      const circuitStatus = circuitBreakerService.getStatus(gateway);
      const nextRetryTime = circuitStatus?.nextRetryTime;
      
      throw new Error(
        `${gateway} payment gateway is temporarily unavailable. ` +
        `Please try a different payment method or try again ${nextRetryTime ? `after ${nextRetryTime.toLocaleTimeString()}` : 'later'}.`
      );
    }

    const startTime = Date.now();
    let success = false;

    try {
      console.log(`[GatewayExecutor] Executing ${operationName} for ${gateway}...`);
      
      // Execute the operation
      const result = await operation();
      
      success = true;
      const responseTime = Date.now() - startTime;

      // Record success in circuit breaker
      circuitBreakerService.recordSuccess(gateway);

      // Record response time in monitoring service
      gatewayMonitoringService.recordResponseTime(gateway, responseTime, true);

      console.log(`[GatewayExecutor] ${operationName} for ${gateway} completed successfully in ${responseTime}ms`);

      return result;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      // Record failure in circuit breaker
      await circuitBreakerService.recordFailure(gateway, error);

      // Record response time in monitoring service
      gatewayMonitoringService.recordResponseTime(gateway, responseTime, false);

      console.error(`[GatewayExecutor] ${operationName} for ${gateway} failed after ${responseTime}ms:`, error.message);

      // Re-throw the error with context
      throw new Error(`${gateway} ${operationName} failed: ${error.message}`);
    }
  }

  /**
   * Check if a gateway is currently available
   * 
   * @param gateway - Payment gateway
   * @returns True if available, false otherwise
   */
  static isGatewayAvailable(gateway: PaymentGateway): boolean {
    return circuitBreakerService.isAvailable(gateway);
  }

  /**
   * Get availability status for all gateways
   * 
   * @returns Object with availability status for each gateway
   */
  static getAvailabilityStatus(): Record<PaymentGateway, 'available' | 'unavailable'> {
    return circuitBreakerService.getAvailabilityStatus();
  }
}

export default GatewayExecutor;
