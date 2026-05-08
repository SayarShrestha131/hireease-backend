import { PaymentGateway } from '../models/PaymentTransaction';
import auditLogService from './auditLogService';

/**
 * Circuit Breaker State
 */
export enum CircuitState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Circuit is open, requests are blocked
  HALF_OPEN = 'half_open', // Testing if service recovered
}

/**
 * Circuit Breaker Configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number; // Number of consecutive failures before opening circuit
  resetTimeout: number; // Time in milliseconds before attempting to close circuit
  monitoringWindow: number; // Time window for tracking failures
}

/**
 * Circuit Breaker Status
 */
interface CircuitBreakerStatus {
  state: CircuitState;
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * CircuitBreakerService - Implements circuit breaker pattern for gateway failures
 * 
 * Tracks consecutive failures per gateway and temporarily disables payment methods
 * when circuit is open. Auto-retries after configured timeout.
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4, 18.5
 */
export class CircuitBreakerService {
  private circuits: Map<PaymentGateway, CircuitBreakerStatus>;
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: 5, // Open circuit after 5 consecutive failures
      resetTimeout: 300000, // Auto-retry after 300 seconds (5 minutes)
      monitoringWindow: 60000, // 1 minute monitoring window
      ...config,
    };

    this.circuits = new Map();

    // Initialize circuits for all gateways
    this.initializeCircuit('khalti');
    this.initializeCircuit('stripe');
    this.initializeCircuit('paypal');
    this.initializeCircuit('esewa'); // Add eSewa circuit

    console.log('[CircuitBreakerService] Initialized with config:', this.config);
  }

  /**
   * Initialize circuit for a gateway
   */
  private initializeCircuit(gateway: PaymentGateway): void {
    this.circuits.set(gateway, {
      state: CircuitState.CLOSED,
      failureCount: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    });
  }

  /**
   * Record a successful operation
   * 
   * @param gateway - Payment gateway
   */
  recordSuccess(gateway: PaymentGateway): void {
    const circuit = this.circuits.get(gateway);
    
    if (!circuit) {
      console.error(`[CircuitBreakerService] Circuit not found for gateway: ${gateway}`);
      return;
    }

    // Reset failure count on success
    circuit.failureCount = 0;
    circuit.totalSuccesses += 1;
    circuit.lastFailureTime = undefined;

    // If circuit was open or half-open, close it
    if (circuit.state !== CircuitState.CLOSED) {
      console.log(`[CircuitBreakerService] Closing circuit for ${gateway} after successful operation`);
      circuit.state = CircuitState.CLOSED;
      circuit.nextRetryTime = undefined;
    }

    this.circuits.set(gateway, circuit);
  }

  /**
   * Record a failed operation
   * 
   * @param gateway - Payment gateway
   * @param error - Error details
   */
  async recordFailure(gateway: PaymentGateway, error: any): Promise<void> {
    const circuit = this.circuits.get(gateway);
    
    if (!circuit) {
      console.error(`[CircuitBreakerService] Circuit not found for gateway: ${gateway}`);
      return;
    }

    // Increment failure count
    circuit.failureCount += 1;
    circuit.totalFailures += 1;
    circuit.lastFailureTime = new Date();

    console.log(`[CircuitBreakerService] Failure recorded for ${gateway}: ${circuit.failureCount}/${this.config.failureThreshold}`);

    // Check if threshold reached
    if (circuit.failureCount >= this.config.failureThreshold && circuit.state === CircuitState.CLOSED) {
      // Open circuit
      circuit.state = CircuitState.OPEN;
      circuit.nextRetryTime = new Date(Date.now() + this.config.resetTimeout);

      console.error(`[CircuitBreakerService] Circuit OPENED for ${gateway} after ${circuit.failureCount} consecutive failures. Next retry at: ${circuit.nextRetryTime.toISOString()}`);

      // Log gateway outage (Requirements: 18.5)
      await auditLogService.logGatewayOutage({
        gateway,
        failureCount: circuit.failureCount,
        lastError: error?.message || 'Unknown error',
        nextRetryTime: circuit.nextRetryTime,
      });
    }

    this.circuits.set(gateway, circuit);
  }

  /**
   * Check if gateway is available for requests
   * 
   * @param gateway - Payment gateway
   * @returns True if gateway is available, false if circuit is open
   */
  isAvailable(gateway: PaymentGateway): boolean {
    const circuit = this.circuits.get(gateway);
    
    if (!circuit) {
      console.error(`[CircuitBreakerService] Circuit not found for gateway: ${gateway}`);
      return false;
    }

    // If circuit is closed, gateway is available
    if (circuit.state === CircuitState.CLOSED) {
      return true;
    }

    // If circuit is open, check if reset timeout has passed
    if (circuit.state === CircuitState.OPEN && circuit.nextRetryTime) {
      const now = new Date();
      
      if (now >= circuit.nextRetryTime) {
        // Transition to half-open state for testing
        console.log(`[CircuitBreakerService] Transitioning ${gateway} circuit to HALF_OPEN for testing`);
        circuit.state = CircuitState.HALF_OPEN;
        circuit.failureCount = 0; // Reset for testing
        this.circuits.set(gateway, circuit);
        return true;
      }
    }

    // If circuit is half-open, allow request for testing
    if (circuit.state === CircuitState.HALF_OPEN) {
      return true;
    }

    // Circuit is open and timeout hasn't passed
    return false;
  }

  /**
   * Get circuit status for a gateway
   * 
   * @param gateway - Payment gateway
   * @returns Circuit status
   */
  getStatus(gateway: PaymentGateway): CircuitBreakerStatus | undefined {
    return this.circuits.get(gateway);
  }

  /**
   * Get status for all gateways
   * 
   * @returns Map of gateway statuses
   */
  getAllStatuses(): Map<PaymentGateway, CircuitBreakerStatus> {
    return new Map(this.circuits);
  }

  /**
   * Manually reset circuit for a gateway
   * 
   * @param gateway - Payment gateway
   */
  reset(gateway: PaymentGateway): void {
    const circuit = this.circuits.get(gateway);
    
    if (!circuit) {
      console.error(`[CircuitBreakerService] Circuit not found for gateway: ${gateway}`);
      return;
    }

    console.log(`[CircuitBreakerService] Manually resetting circuit for ${gateway}`);
    
    circuit.state = CircuitState.CLOSED;
    circuit.failureCount = 0;
    circuit.lastFailureTime = undefined;
    circuit.nextRetryTime = undefined;

    this.circuits.set(gateway, circuit);
  }

  /**
   * Get availability status for all gateways
   * 
   * @returns Object with availability status for each gateway
   */
  getAvailabilityStatus(): Record<PaymentGateway, 'available' | 'unavailable'> {
    return {
      khalti: this.isAvailable('khalti') ? 'available' : 'unavailable',
      stripe: this.isAvailable('stripe') ? 'available' : 'unavailable',
      paypal: this.isAvailable('paypal') ? 'available' : 'unavailable',
      esewa: this.isAvailable('esewa') ? 'available' : 'unavailable',
    };
  }
}

export default new CircuitBreakerService();
