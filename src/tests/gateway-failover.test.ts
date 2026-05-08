/**
 * Payment Gateway Failover Tests
 * 
 * Task 19.3: Test payment gateway failover scenarios
 * - Test circuit breaker with simulated gateway failures
 * - Test health check endpoint accuracy
 * - Test alternative payment method suggestion
 * 
 * Requirements: 18.1-18.7
 */

import mongoose from 'mongoose';
import request from 'supertest';
import app from '../server';
import circuitBreakerService, { CircuitState } from '../services/circuitBreakerService';
import gatewayMonitoringService from '../services/gatewayMonitoringService';
import khaltiService from '../services/khaltiService';
import stripeService from '../services/stripeService';
import paypalService from '../services/paypalService';
import User from '../models/User';
import Vehicle from '../models/Vehicle';
import Booking from '../models/Booking';
import PaymentTransaction from '../models/PaymentTransaction';

describe('Payment Gateway Failover Tests', () => {
  let authToken: string;
  let userId: mongoose.Types.ObjectId;
  let bookingId: string;
  let vehicleId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hire-ease-test');
    }

    // Create test user
    const user = await User.create({
      name: 'Failover Test User',
      email: 'failover@test.com',
      password: 'FailoverPass123!',
      phoneNumber: '+9779800000010',
      isVerified: true,
    });
    userId = user._id;
    authToken = user.generateAuthToken();

    // Create test vehicle
    const vehicle = await Vehicle.create({
      name: 'Failover Test Vehicle',
      type: 'car',
      brand: 'Honda',
      model: 'Civic',
      year: 2023,
      pricePerDay: 6000,
      seats: 5,
      transmission: 'automatic',
      fuelType: 'petrol',
      availability: { isAvailable: true },
    });
    vehicleId = vehicle._id;

    // Create test booking
    const booking = await Booking.create({
      bookingNumber: `BK-FAILOVER-${Date.now()}`,
      userId,
      vehicleId,
      pickupDate: new Date(Date.now() + 86400000),
      dropoffDate: new Date(Date.now() + 172800000),
      status: 'pending',
      paymentStatus: 'pending',
      priceBreakdown: {
        basePrice: 6000,
        duration: 2,
        durationDiscount: 0,
        addOns: {},
        addOnsTotal: 0,
        tax: 780,
        serviceFee: 300,
        totalPrice: 7080,
      },
    });
    bookingId = booking.bookingId;
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({ email: 'failover@test.com' });
    await Vehicle.deleteMany({ name: 'Failover Test Vehicle' });
    await Booking.deleteMany({ bookingNumber: { $regex: /^BK-FAILOVER-/ } });
    await PaymentTransaction.deleteMany({ userId });
    
    // Reset circuit breakers
    circuitBreakerService.reset('khalti');
    circuitBreakerService.reset('stripe');
    circuitBreakerService.reset('paypal');
    
    await mongoose.connection.close();
  });

  beforeEach(() => {
    // Reset circuit breakers before each test
    circuitBreakerService.reset('khalti');
    circuitBreakerService.reset('stripe');
    circuitBreakerService.reset('paypal');
    
    // Clear monitoring data
    gatewayMonitoringService.clearAllMonitoringData();
  });

  describe('18.3, 18.4: Circuit Breaker Pattern', () => {
    it('should open circuit after 5 consecutive failures', async () => {
      // Record 5 consecutive failures for Khalti
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure('khalti', new Error('Gateway timeout'));
      }

      // Check circuit status
      const status = circuitBreakerService.getStatus('khalti');
      expect(status?.state).toBe(CircuitState.OPEN);
      expect(status?.failureCount).toBe(5);
    });

    it('should block requests when circuit is open', async () => {
      // Open the circuit by recording failures
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure('khalti', new Error('Gateway error'));
      }

      // Check if gateway is available
      const isAvailable = circuitBreakerService.isAvailable('khalti');
      expect(isAvailable).toBe(false);
    });

    it('should automatically retry after 300 seconds (5 minutes)', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure('stripe', new Error('Gateway error'));
      }

      const status = circuitBreakerService.getStatus('stripe');
      expect(status?.state).toBe(CircuitState.OPEN);
      expect(status?.nextRetryTime).toBeDefined();

      // Verify retry time is approximately 300 seconds in the future
      const now = Date.now();
      const retryTime = status?.nextRetryTime?.getTime() || 0;
      const timeDiff = retryTime - now;

      // Should be around 300000ms (5 minutes), allow 1 second tolerance
      expect(timeDiff).toBeGreaterThan(299000);
      expect(timeDiff).toBeLessThan(301000);
    });

    it('should transition to half-open state after timeout', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure('paypal', new Error('Gateway error'));
      }

      // Get status and manually set nextRetryTime to past
      const status = circuitBreakerService.getStatus('paypal');
      if (status) {
        status.nextRetryTime = new Date(Date.now() - 1000); // 1 second ago
      }

      // Check availability (should transition to half-open)
      const isAvailable = circuitBreakerService.isAvailable('paypal');
      expect(isAvailable).toBe(true);

      const newStatus = circuitBreakerService.getStatus('paypal');
      expect(newStatus?.state).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after successful operation in half-open state', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure('khalti', new Error('Gateway error'));
      }

      // Transition to half-open
      const status = circuitBreakerService.getStatus('khalti');
      if (status) {
        status.nextRetryTime = new Date(Date.now() - 1000);
      }
      circuitBreakerService.isAvailable('khalti'); // Triggers transition

      // Record success
      circuitBreakerService.recordSuccess('khalti');

      // Circuit should be closed
      const finalStatus = circuitBreakerService.getStatus('khalti');
      expect(finalStatus?.state).toBe(CircuitState.CLOSED);
      expect(finalStatus?.failureCount).toBe(0);
    });

    it('should reset failure count on successful operation', async () => {
      // Record some failures (but not enough to open circuit)
      await circuitBreakerService.recordFailure('stripe', new Error('Error 1'));
      await circuitBreakerService.recordFailure('stripe', new Error('Error 2'));
      await circuitBreakerService.recordFailure('stripe', new Error('Error 3'));

      let status = circuitBreakerService.getStatus('stripe');
      expect(status?.failureCount).toBe(3);

      // Record success
      circuitBreakerService.recordSuccess('stripe');

      // Failure count should be reset
      status = circuitBreakerService.getStatus('stripe');
      expect(status?.failureCount).toBe(0);
      expect(status?.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('18.1, 18.5: Gateway Outage Logging', () => {
    it('should log gateway outage when circuit opens', async () => {
      const consoleSpy = jest.spyOn(console, 'error');

      // Record failures to open circuit
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure('khalti', new Error(`Failure ${i + 1}`));
      }

      // Should have logged circuit opening
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Circuit OPENED for khalti')
      );

      consoleSpy.mockRestore();
    });

    it('should include failure count and next retry time in outage log', async () => {
      const consoleSpy = jest.spyOn(console, 'error');

      // Open circuit
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure('paypal', new Error('Gateway timeout'));
      }

      // Verify log contains required information
      const logCalls = consoleSpy.mock.calls.map((call) => call.join(' '));
      const outageLog = logCalls.find((log) => log.includes('Circuit OPENED'));

      expect(outageLog).toBeDefined();
      expect(outageLog).toContain('5 consecutive failures');
      expect(outageLog).toContain('Next retry at:');

      consoleSpy.mockRestore();
    });
  });

  describe('18.6: Gateway Response Time Monitoring', () => {
    it('should track gateway response times', () => {
      // Record some response times
      gatewayMonitoringService.recordResponseTime('khalti', 1500, true);
      gatewayMonitoringService.recordResponseTime('khalti', 2000, true);
      gatewayMonitoringService.recordResponseTime('khalti', 1800, true);

      // Get average response time
      const avgTime = gatewayMonitoringService.getAverageResponseTime('khalti');
      expect(avgTime).toBeGreaterThan(0);
      expect(avgTime).toBeCloseTo(1766, 0); // Average of 1500, 2000, 1800
    });

    it('should log slow responses exceeding 10 seconds', () => {
      const consoleSpy = jest.spyOn(console, 'warn');

      // Record a slow response (11 seconds)
      gatewayMonitoringService.recordResponseTime('stripe', 11000, true);

      // Should have logged slow response warning
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SLOW RESPONSE detected for stripe')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('11000ms')
      );

      consoleSpy.mockRestore();
    });

    it('should count slow responses per gateway', () => {
      // Record mix of fast and slow responses
      gatewayMonitoringService.recordResponseTime('paypal', 2000, true);
      gatewayMonitoringService.recordResponseTime('paypal', 12000, true); // Slow
      gatewayMonitoringService.recordResponseTime('paypal', 3000, true);
      gatewayMonitoringService.recordResponseTime('paypal', 15000, true); // Slow
      gatewayMonitoringService.recordResponseTime('paypal', 1000, true);

      // Get slow response count
      const slowCount = gatewayMonitoringService.getSlowResponseCount('paypal');
      expect(slowCount).toBe(2);
    });

    it('should track both successful and failed operations', () => {
      // Record mix of successes and failures
      gatewayMonitoringService.recordResponseTime('khalti', 1500, true);
      gatewayMonitoringService.recordResponseTime('khalti', 2000, false);
      gatewayMonitoringService.recordResponseTime('khalti', 1800, true);

      // Average should include all operations
      const avgTime = gatewayMonitoringService.getAverageResponseTime('khalti');
      expect(avgTime).toBeGreaterThan(0);
    });
  });

  describe('18.7: Health Check Endpoint', () => {
    it('should return status of all payment gateways', async () => {
      const response = await request(app).get('/api/payments/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('khalti');
      expect(response.body.data).toHaveProperty('stripe');
      expect(response.body.data).toHaveProperty('paypal');
      expect(response.body.data).toHaveProperty('mode');
    });

    it('should show available status for enabled gateways with closed circuit', async () => {
      const response = await request(app).get('/api/payments/health');

      const { khalti, stripe, paypal } = response.body.data;

      // Enabled gateways should be available or disabled
      expect(['available', 'disabled']).toContain(khalti);
      expect(['available', 'disabled']).toContain(stripe);
      expect(['available', 'disabled']).toContain(paypal);
    });

    it('should show unavailable status when circuit is open', async () => {
      // Open circuit for Khalti
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure('khalti', new Error('Gateway error'));
      }

      const response = await request(app).get('/api/payments/health');

      expect(response.status).toBe(200);
      expect(response.body.data.khalti).toBe('unavailable');
    });

    it('should show disabled status for gateways not enabled in config', async () => {
      const response = await request(app).get('/api/payments/health');

      // At least one gateway might be disabled in test config
      const statuses = [
        response.body.data.khalti,
        response.body.data.stripe,
        response.body.data.paypal,
      ];

      // All should be valid status values
      statuses.forEach((status) => {
        expect(['available', 'unavailable', 'disabled']).toContain(status);
      });
    });

    it('should include current payment mode in health check', async () => {
      const response = await request(app).get('/api/payments/health');

      expect(response.body.data.mode).toBeDefined();
      expect(['sandbox', 'production']).toContain(response.body.data.mode);
    });
  });

  describe('18.7: Detailed Gateway Health Status', () => {
    it('should provide detailed health information for each gateway', async () => {
      const response = await request(app).get('/api/payments/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.gateways).toBeInstanceOf(Array);
      expect(response.body.data.gateways.length).toBe(3);
    });

    it('should include average response time in detailed health', async () => {
      // Record some response times
      gatewayMonitoringService.recordResponseTime('stripe', 1500, true);
      gatewayMonitoringService.recordResponseTime('stripe', 2500, true);

      const response = await request(app).get('/api/payments/health/detailed');

      const stripeHealth = response.body.data.gateways.find(
        (g: any) => g.gateway === 'stripe'
      );

      expect(stripeHealth).toBeDefined();
      expect(stripeHealth.averageResponseTime).toBeGreaterThan(0);
    });

    it('should include slow response count in detailed health', async () => {
      // Record a slow response
      gatewayMonitoringService.recordResponseTime('paypal', 12000, true);

      const response = await request(app).get('/api/payments/health/detailed');

      const paypalHealth = response.body.data.gateways.find(
        (g: any) => g.gateway === 'paypal'
      );

      expect(paypalHealth).toBeDefined();
      expect(paypalHealth.slowResponseCount).toBeGreaterThanOrEqual(1);
    });

    it('should include circuit breaker state in detailed health', async () => {
      const response = await request(app).get('/api/payments/health/detailed');

      const khaltiHealth = response.body.data.gateways.find(
        (g: any) => g.gateway === 'khalti'
      );

      expect(khaltiHealth).toBeDefined();
      expect(khaltiHealth.circuitState).toBeDefined();
      expect(['closed', 'open', 'half_open', 'unknown']).toContain(
        khaltiHealth.circuitState
      );
    });
  });

  describe('18.2: Alternative Payment Method Suggestion', () => {
    it('should suggest alternative payment methods when gateway is unavailable', async () => {
      // Open circuit for Khalti
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure('khalti', new Error('Gateway error'));
      }

      // Try to initiate payment with Khalti
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bookingId,
          paymentMethod: 'khalti',
          returnUrl: 'http://localhost:3000/payment/return',
        });

      // Should fail with suggestion to try alternative method
      expect(response.status).toBe(400);
      expect(response.body.error || response.body.suggestedAction).toMatch(
        /alternative|different.*method|try.*stripe|try.*paypal/i
      );
    });

    it('should return available payment methods in health check', async () => {
      const response = await request(app).get('/api/payments/health');

      const availableMethods = [];
      if (response.body.data.khalti === 'available') availableMethods.push('khalti');
      if (response.body.data.stripe === 'available') availableMethods.push('stripe');
      if (response.body.data.paypal === 'available') availableMethods.push('paypal');

      // At least one method should be available
      expect(availableMethods.length).toBeGreaterThan(0);
    });
  });

  describe('Circuit Breaker Integration with Payment Flow', () => {
    it('should prevent payment initiation when circuit is open', async () => {
      // Open circuit for Stripe
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure('stripe', new Error('Gateway timeout'));
      }

      // Try to initiate payment
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bookingId,
          paymentMethod: 'stripe',
          returnUrl: 'http://localhost:3000/payment/return',
        });

      // Should fail due to circuit being open
      expect(response.status).toBe(400);
    });

    it('should allow payment with alternative gateway when one is down', async () => {
      // Open circuit for Khalti
      for (let i = 0; i < 5; i++) {
        await circuitBreakerService.recordFailure('khalti', new Error('Gateway error'));
      }

      // Check health to see available alternatives
      const healthResponse = await request(app).get('/api/payments/health');

      // Find an available alternative
      const availableGateway =
        healthResponse.body.data.stripe === 'available'
          ? 'stripe'
          : healthResponse.body.data.paypal === 'available'
          ? 'paypal'
          : null;

      if (availableGateway) {
        // Try payment with available gateway
        const paymentResponse = await request(app)
          .post('/api/payments/initiate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            bookingId,
            paymentMethod: availableGateway,
            returnUrl: 'http://localhost:3000/payment/return',
          });

        // Should succeed or fail for reasons other than circuit breaker
        expect(paymentResponse.status).not.toBe(503); // Not service unavailable
      }
    });
  });

  describe('Manual Circuit Reset', () => {
    it('should allow manual circuit reset', () => {
      // Open circuit
      for (let i = 0; i < 5; i++) {
        circuitBreakerService.recordFailure('paypal', new Error('Error'));
      }

      let status = circuitBreakerService.getStatus('paypal');
      expect(status?.state).toBe(CircuitState.OPEN);

      // Manually reset
      circuitBreakerService.reset('paypal');

      // Circuit should be closed
      status = circuitBreakerService.getStatus('paypal');
      expect(status?.state).toBe(CircuitState.CLOSED);
      expect(status?.failureCount).toBe(0);
    });
  });
});
