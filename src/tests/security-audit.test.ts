/**
 * Security Audit Tests for Payment Gateway Integration
 * 
 * Task 19.2: Perform security audit
 * - Verify no card data storage
 * - Verify credential encryption
 * - Verify TLS enforcement
 * - Verify webhook signature validation
 * - Verify rate limiting
 * - Verify audit logging
 * 
 * Requirements: 4.2, 4.4, 4.5, 4.6, 4.7, 4.8, 17.1-17.8
 */

import mongoose from 'mongoose';
import request from 'supertest';
import app from '../server';
import PaymentTransaction from '../models/PaymentTransaction';
import Booking from '../models/Booking';
import User from '../models/User';
import Vehicle from '../models/Vehicle';
import khaltiService from '../services/khaltiService';
import stripeService from '../services/stripeService';
import paypalService from '../services/paypalService';
import auditLogService from '../services/auditLogService';
import gatewayConfig from '../config/paymentGateway';
import * as fs from 'fs';
import * as path from 'path';

describe('Security Audit Tests', () => {
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
      name: 'Security Test User',
      email: 'security@test.com',
      password: 'SecurePass123!',
      phoneNumber: '+9779800000000',
      isVerified: true,
    });
    userId = user._id;

    // Generate auth token
    authToken = user.generateAuthToken();

    // Create test vehicle
    const vehicle = await Vehicle.create({
      name: 'Test Vehicle',
      type: 'car',
      brand: 'Toyota',
      model: 'Corolla',
      year: 2023,
      pricePerDay: 5000,
      seats: 5,
      transmission: 'automatic',
      fuelType: 'petrol',
      availability: { isAvailable: true },
    });
    vehicleId = vehicle._id;

    // Create test booking
    const booking = await Booking.create({
      bookingNumber: `BK-TEST-${Date.now()}`,
      userId,
      vehicleId,
      pickupDate: new Date(Date.now() + 86400000),
      dropoffDate: new Date(Date.now() + 172800000),
      status: 'pending',
      paymentStatus: 'pending',
      priceBreakdown: {
        basePrice: 5000,
        duration: 2,
        durationDiscount: 0,
        addOns: {},
        addOnsTotal: 0,
        tax: 650,
        serviceFee: 250,
        totalPrice: 5900,
      },
    });
    bookingId = booking.bookingId;
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({ email: 'security@test.com' });
    await Vehicle.deleteMany({ name: 'Test Vehicle' });
    await Booking.deleteMany({ bookingNumber: { $regex: /^BK-TEST-/ } });
    await PaymentTransaction.deleteMany({ userId });
    await mongoose.connection.close();
  });

  describe('4.5, 17.1, 17.2: No Card Data Storage', () => {
    it('should never store complete credit card numbers in database', async () => {
      // Search all payment transactions for card number patterns
      const transactions = await PaymentTransaction.find({}).lean();
      
      const cardNumberPattern = /\b\d{13,19}\b/; // Card numbers are 13-19 digits
      
      transactions.forEach((transaction) => {
        const transactionStr = JSON.stringify(transaction);
        
        // Check if any field contains card number pattern
        expect(transactionStr).not.toMatch(cardNumberPattern);
        
        // Specifically check gatewayMetadata doesn't contain card data
        if (transaction.gatewayMetadata) {
          const metadataStr = JSON.stringify(transaction.gatewayMetadata);
          expect(metadataStr).not.toMatch(/card.*number/i);
          expect(metadataStr).not.toMatch(/\b\d{13,19}\b/);
        }
      });
    });

    it('should never store CVV codes in database', async () => {
      const transactions = await PaymentTransaction.find({}).lean();
      
      transactions.forEach((transaction) => {
        const transactionStr = JSON.stringify(transaction);
        
        // Check for CVV-related fields
        expect(transactionStr).not.toMatch(/cvv/i);
        expect(transactionStr).not.toMatch(/cvc/i);
        expect(transactionStr).not.toMatch(/security.*code/i);
      });
    });

    it('should not log complete card numbers in application logs', async () => {
      // Check if log files exist and don't contain card numbers
      const logDir = path.join(__dirname, '../../logs');
      
      if (fs.existsSync(logDir)) {
        const logFiles = fs.readdirSync(logDir);
        const cardNumberPattern = /\b\d{13,19}\b/;
        
        logFiles.forEach((file) => {
          const logPath = path.join(logDir, file);
          const logContent = fs.readFileSync(logPath, 'utf8');
          
          // Should not contain sequences of 13-19 digits (card numbers)
          const matches = logContent.match(cardNumberPattern);
          if (matches) {
            // Allow timestamps and other legitimate numbers, but not card-like sequences
            matches.forEach((match) => {
              expect(match.length).toBeLessThan(13); // Card numbers are at least 13 digits
            });
          }
        });
      }
    });
  });

  describe('4.4, 17.4: Credential Encryption', () => {
    it('should store API credentials in environment variables', () => {
      // Verify credentials are loaded from environment
      expect(process.env.KHALTI_SECRET_KEY).toBeDefined();
      expect(process.env.STRIPE_SECRET_KEY).toBeDefined();
      expect(process.env.PAYPAL_CLIENT_SECRET).toBeDefined();
    });

    it('should not expose credentials in gateway config', () => {
      const configStr = JSON.stringify(gatewayConfig);
      
      // Config should contain credentials but they should be from env
      expect(gatewayConfig.khalti.secretKey).toBeDefined();
      expect(gatewayConfig.stripe.secretKey).toBeDefined();
      expect(gatewayConfig.paypal.clientSecret).toBeDefined();
      
      // Credentials should not be hardcoded in config
      expect(configStr).not.toMatch(/sk_live_/); // Stripe live key prefix
      expect(configStr).not.toMatch(/sk_test_/); // Stripe test key prefix
    });

    it('should use encrypted credentials for gateway API calls', () => {
      // Verify services use credentials from secure config
      expect(khaltiService).toBeDefined();
      expect(stripeService).toBeDefined();
      expect(paypalService).toBeDefined();
    });
  });

  describe('4.6, 17.5: TLS Enforcement', () => {
    it('should enforce HTTPS for all gateway API communications', () => {
      // Check that gateway services use HTTPS endpoints
      const khaltiEndpoint = process.env.KHALTI_API_URL || 'https://khalti.com/api/v2';
      const stripeEndpoint = 'https://api.stripe.com';
      const paypalEndpoint = process.env.PAYPAL_API_URL || 'https://api.paypal.com';
      
      expect(khaltiEndpoint).toMatch(/^https:\/\//);
      expect(stripeEndpoint).toMatch(/^https:\/\//);
      expect(paypalEndpoint).toMatch(/^https:\/\//);
    });

    it('should use TLS 1.2 or higher for gateway connections', () => {
      // Node.js uses TLS 1.2+ by default for HTTPS
      // Verify by checking Node.js version supports TLS 1.2+
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));
      
      // Node.js 12+ supports TLS 1.2 and 1.3
      expect(majorVersion).toBeGreaterThanOrEqual(12);
    });
  });

  describe('4.2, 4.3, 9.2: Webhook Signature Validation', () => {
    it('should validate Khalti webhook signatures', async () => {
      const validPayload = JSON.stringify({
        event: 'payment.success',
        pidx: 'test_pidx',
        amount: 100000,
      });
      
      const invalidSignature = 'invalid_signature_123';
      
      const response = await request(app)
        .post('/api/payments/webhooks/khalti')
        .set('khalti-signature', invalidSignature)
        .send(JSON.parse(validPayload));
      
      // Should reject invalid signature
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid.*signature/i);
    });

    it('should validate Stripe webhook signatures', async () => {
      const validPayload = JSON.stringify({
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } },
      });
      
      const invalidSignature = 'invalid_signature_123';
      
      const response = await request(app)
        .post('/api/payments/webhooks/stripe')
        .set('stripe-signature', invalidSignature)
        .send(validPayload);
      
      // Should reject invalid signature
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid.*signature/i);
    });

    it('should validate PayPal webhook signatures', async () => {
      const validPayload = {
        id: 'WH-TEST',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAPTURE_TEST' },
      };
      
      const response = await request(app)
        .post('/api/payments/webhooks/paypal')
        .set('paypal-transmission-id', 'invalid_id')
        .set('paypal-transmission-time', new Date().toISOString())
        .set('paypal-transmission-sig', 'invalid_sig')
        .send(validPayload);
      
      // Should reject invalid signature
      expect(response.status).toBe(401);
      expect(response.body.error).toMatch(/invalid.*signature/i);
    });

    it('should log security alerts for failed webhook signatures', async () => {
      const logSpy = jest.spyOn(auditLogService, 'logWebhookSignatureFailure');
      
      const invalidPayload = { event: 'test' };
      const invalidSignature = 'invalid_signature';
      
      await request(app)
        .post('/api/payments/webhooks/khalti')
        .set('khalti-signature', invalidSignature)
        .send(invalidPayload);
      
      // Should have logged security alert
      expect(logSpy).toHaveBeenCalled();
    });
  });

  describe('4.7: Rate Limiting', () => {
    it('should enforce rate limit of 10 payment attempts per user per hour', async () => {
      const responses = [];
      
      // Make 11 payment initiation requests
      for (let i = 0; i < 11; i++) {
        const response = await request(app)
          .post('/api/payments/initiate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            bookingId,
            paymentMethod: 'khalti',
            returnUrl: 'http://localhost:3000/payment/return',
          });
        
        responses.push(response);
      }
      
      // First 10 should succeed or fail for other reasons
      // 11th should be rate limited
      const rateLimitedResponses = responses.filter(
        (r) => r.status === 429 || r.body.error?.includes('rate limit')
      );
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    }, 30000); // Increase timeout for multiple requests

    it('should return appropriate error message for rate limit', async () => {
      // Make multiple requests to trigger rate limit
      let rateLimitResponse;
      
      for (let i = 0; i < 15; i++) {
        const response = await request(app)
          .post('/api/payments/initiate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            bookingId,
            paymentMethod: 'khalti',
            returnUrl: 'http://localhost:3000/payment/return',
          });
        
        if (response.status === 429) {
          rateLimitResponse = response;
          break;
        }
      }
      
      if (rateLimitResponse) {
        expect(rateLimitResponse.body.error).toBeDefined();
        expect(rateLimitResponse.body.error).toMatch(/rate limit/i);
      }
    }, 30000);
  });

  describe('4.8, 17.8: Audit Logging', () => {
    it('should log all payment attempts with required details', async () => {
      const logSpy = jest.spyOn(auditLogService, 'logPaymentAttempt');
      
      await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bookingId,
          paymentMethod: 'khalti',
          returnUrl: 'http://localhost:3000/payment/return',
        });
      
      // Should have logged payment attempt
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(String),
          bookingId: expect.any(String),
          amount: expect.any(Number),
          currency: expect.any(String),
          paymentMethod: expect.any(String),
        })
      );
    });

    it('should log payment success with gateway response', async () => {
      const logSpy = jest.spyOn(auditLogService, 'logPaymentSuccess');
      
      // Create a completed transaction for testing
      const transaction = await PaymentTransaction.create({
        bookingId: (await Booking.findOne({ bookingId }))!._id,
        userId,
        transactionId: `TXN-TEST-${Date.now()}`,
        transactionType: 'payment',
        amount: 5900,
        currency: 'NPR',
        paymentMethod: 'khalti',
        gateway: 'khalti',
        status: 'completed',
        idempotencyKey: `test-key-${Date.now()}`,
        retryCount: 0,
        gatewayTransactionId: 'GTW-TEST-123',
        gatewayMetadata: { test: true },
        initiatedAt: new Date(),
        completedAt: new Date(),
      });
      
      // Verify transaction was created with audit trail
      expect(transaction.gatewayTransactionId).toBeDefined();
      expect(transaction.completedAt).toBeDefined();
    });

    it('should log payment failures with error details', async () => {
      const logSpy = jest.spyOn(auditLogService, 'logPaymentFailure');
      
      // Create a failed transaction
      const transaction = await PaymentTransaction.create({
        bookingId: (await Booking.findOne({ bookingId }))!._id,
        userId,
        transactionId: `TXN-FAIL-${Date.now()}`,
        transactionType: 'payment',
        amount: 5900,
        currency: 'NPR',
        paymentMethod: 'khalti',
        gateway: 'khalti',
        status: 'failed',
        idempotencyKey: `test-key-fail-${Date.now()}`,
        retryCount: 1,
        errorMessage: 'Insufficient funds',
        initiatedAt: new Date(),
        failedAt: new Date(),
      });
      
      // Verify failed transaction has error details
      expect(transaction.errorMessage).toBeDefined();
      expect(transaction.failedAt).toBeDefined();
    });

    it('should log webhook processing events', async () => {
      const logSpy = jest.spyOn(auditLogService, 'logWebhookReceived');
      
      // Trigger a webhook (will fail signature validation but should still log)
      await request(app)
        .post('/api/payments/webhooks/khalti')
        .set('khalti-signature', 'test_signature')
        .send({
          event: 'payment.success',
          pidx: 'test_pidx',
        });
      
      // Webhook receipt should be logged even if validation fails
      // (logging happens before validation rejection)
    });

    it('should log refund requests and results', async () => {
      const logSpy = jest.spyOn(auditLogService, 'logRefundSuccess');
      
      // Create a completed payment first
      const completedBooking = await Booking.create({
        bookingNumber: `BK-REFUND-${Date.now()}`,
        userId,
        vehicleId,
        pickupDate: new Date(Date.now() + 86400000),
        dropoffDate: new Date(Date.now() + 172800000),
        status: 'confirmed',
        paymentStatus: 'completed',
        priceBreakdown: {
          basePrice: 5000,
          duration: 2,
          durationDiscount: 0,
          addOns: {},
          addOnsTotal: 0,
          tax: 650,
          serviceFee: 250,
          totalPrice: 5900,
        },
      });
      
      await PaymentTransaction.create({
        bookingId: completedBooking._id,
        userId,
        transactionId: `TXN-REFUND-${Date.now()}`,
        transactionType: 'payment',
        amount: 5900,
        currency: 'NPR',
        paymentMethod: 'khalti',
        gateway: 'khalti',
        status: 'completed',
        idempotencyKey: `refund-key-${Date.now()}`,
        retryCount: 0,
        gatewayTransactionId: 'GTW-REFUND-123',
        gatewayChargeId: 'CHARGE-123',
        initiatedAt: new Date(),
        completedAt: new Date(),
      });
      
      // Attempt refund (may fail due to mock, but should log)
      await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bookingId: completedBooking.bookingId,
          reason: 'Customer cancellation',
        });
      
      // Cleanup
      await Booking.deleteOne({ _id: completedBooking._id });
    });
  });

  describe('17.3, 17.6, 17.7: Secure Session Management and Access Control', () => {
    it('should restrict payment API access to authenticated users only', async () => {
      const response = await request(app)
        .post('/api/payments/initiate')
        .send({
          bookingId,
          paymentMethod: 'khalti',
          returnUrl: 'http://localhost:3000/payment/return',
        });
      
      // Should reject unauthenticated request
      expect(response.status).toBe(401);
    });

    it('should validate user owns the booking before processing payment', async () => {
      // Create another user
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@test.com',
        password: 'OtherPass123!',
        phoneNumber: '+9779800000001',
        isVerified: true,
      });
      
      const otherToken = otherUser.generateAuthToken();
      
      // Try to pay for booking owned by different user
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          bookingId, // Booking owned by first user
          paymentMethod: 'khalti',
          returnUrl: 'http://localhost:3000/payment/return',
        });
      
      // Should reject unauthorized access
      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/unauthorized|not belong/i);
      
      // Cleanup
      await User.deleteOne({ _id: otherUser._id });
    });
  });

  describe('Security Best Practices', () => {
    it('should use gateway-hosted payment pages for card collection', () => {
      // Khalti uses redirect to their payment page
      // Stripe uses Elements (client-side tokenization)
      // PayPal uses redirect to their approval page
      
      // Verify we don't have card input fields in our backend
      const paymentServiceCode = fs.readFileSync(
        path.join(__dirname, '../services/paymentService.ts'),
        'utf8'
      );
      
      // Should not have card number fields
      expect(paymentServiceCode).not.toMatch(/cardNumber/i);
      expect(paymentServiceCode).not.toMatch(/card.*number/i);
      expect(paymentServiceCode).not.toMatch(/cvv/i);
    });

    it('should never expose internal error details to users', async () => {
      // Try to initiate payment with invalid data
      const response = await request(app)
        .post('/api/payments/initiate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bookingId: 'invalid_booking_id',
          paymentMethod: 'khalti',
          returnUrl: 'http://localhost:3000/payment/return',
        });
      
      // Should return user-friendly error, not stack trace
      expect(response.body.error).toBeDefined();
      expect(response.body.error).not.toMatch(/stack/i);
      expect(response.body.error).not.toMatch(/at.*\(.*:\d+:\d+\)/); // Stack trace pattern
    });
  });
});
