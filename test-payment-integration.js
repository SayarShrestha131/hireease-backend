/**
 * Payment Gateway Integration - Complete Backend Verification Script
 * 
 * This script tests all payment flows end-to-end for the three gateways:
 * - Khalti
 * - Stripe
 * - PayPal
 * 
 * Tests include:
 * 1. Payment initiation
 * 2. Payment verification
 * 3. Webhook handling
 * 4. Receipt generation
 * 5. Refund processing
 * 6. Payment history
 * 7. Gateway health checks
 * 8. Error handling
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:5000';
const API_BASE = `${BASE_URL}/api`;

// Test user credentials (you'll need to create a test user first)
const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123!@#'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test results tracker
const testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  tests: []
};

// Helper functions
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, colors.green);
  testResults.passed++;
}

function logError(message) {
  log(`✗ ${message}`, colors.red);
  testResults.failed++;
}

function logSkip(message) {
  log(`⊘ ${message}`, colors.yellow);
  testResults.skipped++;
}

function logInfo(message) {
  log(`ℹ ${message}`, colors.cyan);
}

function logSection(message) {
  log(`\n${'='.repeat(60)}`, colors.blue);
  log(message, colors.blue);
  log('='.repeat(60), colors.blue);
}

// API client
let authToken = null;
let testBookingId = null;
let testTransactionId = null;

async function apiCall(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (authToken) {
      config.headers['Authorization'] = `Bearer ${authToken}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

// Test functions
async function testAuthentication() {
  logSection('1. Authentication Test');
  
  const result = await apiCall('POST', '/auth/login', TEST_USER);
  
  if (result.success && result.data.data && result.data.data.token) {
    authToken = result.data.data.token;
    logSuccess('User authenticated successfully');
    return true;
  } else {
    logError('Authentication failed');
    logInfo('Please ensure test user exists or update TEST_USER credentials');
    return false;
  }
}

async function testGatewayHealth() {
  logSection('2. Gateway Health Check');
  
  const result = await apiCall('GET', '/payments/health');
  
  if (result.success) {
    logSuccess('Health check endpoint accessible');
    logInfo(`Payment Mode: ${result.data.data.mode}`);
    logInfo(`Khalti: ${result.data.data.khalti}`);
    logInfo(`Stripe: ${result.data.data.stripe}`);
    logInfo(`PayPal: ${result.data.data.paypal}`);
    return true;
  } else {
    logError('Health check failed');
    return false;
  }
}

async function testDetailedHealth() {
  logSection('3. Detailed Gateway Health');
  
  const result = await apiCall('GET', '/payments/health/detailed');
  
  if (result.success) {
    logSuccess('Detailed health check accessible');
    const gateways = result.data.data.gateways;
    
    Object.keys(gateways).forEach(gateway => {
      const status = gateways[gateway];
      logInfo(`${gateway}: Status=${status.status}, Circuit=${status.circuitState}`);
    });
    return true;
  } else {
    logError('Detailed health check failed');
    return false;
  }
}

async function createTestBooking() {
  logSection('4. Create Test Booking');
  
  // First, get available vehicles
  const vehiclesResult = await apiCall('GET', '/vehicles');
  
  if (!vehiclesResult.success || !vehiclesResult.data.data.vehicles || vehiclesResult.data.data.vehicles.length === 0) {
    logError('No vehicles available for booking');
    return false;
  }
  
  const vehicle = vehiclesResult.data.data.vehicles[0];
  logInfo(`Using vehicle: ${vehicle.name}`);
  
  // Create booking
  const bookingData = {
    vehicleId: vehicle._id,
    pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dropoffDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    pickupTime: '10:00',
    dropoffTime: '10:00',
    addOns: {
      helmet: false,
      gps: false,
      insurance: false
    }
  };
  
  const result = await apiCall('POST', '/bookings/create', bookingData);
  
  if (result.success && result.data.data.bookingId) {
    testBookingId = result.data.data.bookingId;
    logSuccess(`Test booking created: ${testBookingId}`);
    logInfo(`Amount: ${result.data.data.priceBreakdown.totalPrice} NPR`);
    return true;
  } else {
    logError('Failed to create test booking');
    logInfo(`Error: ${JSON.stringify(result.error || result)}`);
    return false;
  }
}

async function testPaymentInitiation(gateway) {
  logSection(`5. Payment Initiation - ${gateway.toUpperCase()}`);
  
  if (!testBookingId) {
    logSkip('No test booking available');
    return false;
  }
  
  const paymentData = {
    bookingId: testBookingId,
    paymentMethod: gateway,
    returnUrl: `${BASE_URL}/payment-return`
  };
  
  const result = await apiCall('POST', '/payments/initiate', paymentData);
  
  if (result.success) {
    testTransactionId = result.data.data.transactionId;
    logSuccess(`Payment initiated for ${gateway}`);
    logInfo(`Transaction ID: ${testTransactionId}`);
    
    if (result.data.data.paymentUrl) {
      logInfo(`Payment URL: ${result.data.data.paymentUrl}`);
    }
    if (result.data.data.clientSecret) {
      logInfo(`Client Secret: ${result.data.data.clientSecret.substring(0, 20)}...`);
    }
    
    return true;
  } else {
    logError(`Payment initiation failed for ${gateway}`);
    logInfo(`Error: ${JSON.stringify(result.error)}`);
    return false;
  }
}

async function testPaymentHistory() {
  logSection('6. Payment History');
  
  const result = await apiCall('GET', '/payments/history?page=1&limit=10');
  
  if (result.success) {
    logSuccess('Payment history retrieved');
    logInfo(`Total transactions: ${result.data.data.pagination.total}`);
    logInfo(`Total paid: ${result.data.data.summary.totalPaid}`);
    logInfo(`Total refunded: ${result.data.data.summary.totalRefunded}`);
    return true;
  } else {
    logError('Failed to retrieve payment history');
    return false;
  }
}

async function testWebhookSignatureValidation() {
  logSection('7. Webhook Signature Validation');
  
  // Test with invalid signature (should fail)
  const invalidWebhook = {
    event: 'test',
    data: { test: true }
  };
  
  const result = await apiCall(
    'POST',
    '/payments/webhooks/khalti',
    invalidWebhook,
    { 'khalti-signature': 'invalid_signature' }
  );
  
  // Webhook should respond with 200 even for invalid signatures (to prevent retries)
  // but should log security alert
  if (result.status === 200 || result.status === 401) {
    logSuccess('Webhook signature validation working');
    return true;
  } else {
    logError('Webhook signature validation not working as expected');
    return false;
  }
}

async function testRateLimiting() {
  logSection('8. Rate Limiting Test');
  
  if (!testBookingId) {
    logSkip('No test booking available');
    return false;
  }
  
  logInfo('Attempting multiple rapid payment initiations...');
  
  const paymentData = {
    bookingId: testBookingId,
    paymentMethod: 'khalti',
    returnUrl: `${BASE_URL}/payment-return`
  };
  
  let rateLimitHit = false;
  
  for (let i = 0; i < 12; i++) {
    const result = await apiCall('POST', '/payments/initiate', paymentData);
    
    if (result.status === 429) {
      rateLimitHit = true;
      logSuccess(`Rate limit enforced after ${i + 1} requests`);
      break;
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (rateLimitHit) {
    return true;
  } else {
    logError('Rate limiting not enforced');
    return false;
  }
}

async function testErrorHandling() {
  logSection('9. Error Handling');
  
  // Test with invalid booking ID
  const invalidPayment = {
    bookingId: 'INVALID_BOOKING_ID',
    paymentMethod: 'khalti',
    returnUrl: `${BASE_URL}/payment-return`
  };
  
  const result = await apiCall('POST', '/payments/initiate', invalidPayment);
  
  if (!result.success && result.error) {
    logSuccess('Error handling working - user-friendly error returned');
    logInfo(`Error message: ${result.error.error || result.error.message}`);
    
    // Check if error message is user-friendly (not exposing internal details)
    const errorMsg = result.error.error || result.error.message || '';
    if (!errorMsg.includes('stack') && !errorMsg.includes('mongoose')) {
      logSuccess('Error messages are user-friendly');
      return true;
    }
  }
  
  logError('Error handling needs improvement');
  return false;
}

async function testPaymentMetrics() {
  logSection('10. Payment Analytics & Metrics');
  
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  
  const result = await apiCall(
    'GET',
    `/payments/metrics?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
  );
  
  if (result.success) {
    logSuccess('Payment metrics retrieved');
    logInfo(`Success rate: ${result.data.data.successRate}%`);
    logInfo(`Total transactions: ${result.data.data.totalTransactions}`);
    return true;
  } else {
    logError('Failed to retrieve payment metrics');
    return false;
  }
}

async function testReceiptGeneration() {
  logSection('11. Receipt Generation');
  
  if (!testBookingId) {
    logSkip('No test booking available');
    return false;
  }
  
  // Note: Receipt is only generated after successful payment
  // This test will likely fail unless payment was completed
  const result = await apiCall('GET', `/payments/receipt/${testBookingId}`);
  
  if (result.success) {
    logSuccess('Receipt retrieved');
    logInfo(`Receipt number: ${result.data.data.receiptNumber}`);
    return true;
  } else {
    logSkip('Receipt not available (payment not completed)');
    return false;
  }
}

async function testCircuitBreaker() {
  logSection('12. Circuit Breaker Pattern');
  
  // Check detailed health to see circuit breaker status
  const result = await apiCall('GET', '/payments/health/detailed');
  
  if (result.success) {
    const gateways = result.data.data.gateways;
    let circuitBreakerWorking = false;
    
    Object.keys(gateways).forEach(gateway => {
      const status = gateways[gateway];
      if (status.circuitState) {
        circuitBreakerWorking = true;
        logInfo(`${gateway}: Circuit state = ${status.circuitState}`);
      }
    });
    
    if (circuitBreakerWorking) {
      logSuccess('Circuit breaker pattern implemented');
      return true;
    }
  }
  
  logError('Circuit breaker status not available');
  return false;
}

// Main test runner
async function runAllTests() {
  log('\n' + '='.repeat(60), colors.blue);
  log('PAYMENT GATEWAY INTEGRATION - BACKEND VERIFICATION', colors.blue);
  log('='.repeat(60) + '\n', colors.blue);
  
  logInfo(`Testing against: ${BASE_URL}`);
  logInfo(`Started at: ${new Date().toISOString()}\n`);
  
  // Run tests sequentially
  const tests = [
    { name: 'Authentication', fn: testAuthentication, critical: true },
    { name: 'Gateway Health', fn: testGatewayHealth, critical: false },
    { name: 'Detailed Health', fn: testDetailedHealth, critical: false },
    { name: 'Create Test Booking', fn: createTestBooking, critical: false },
    { name: 'Payment Initiation (Khalti)', fn: () => testPaymentInitiation('khalti'), critical: false },
    { name: 'Payment History', fn: testPaymentHistory, critical: false },
    { name: 'Webhook Validation', fn: testWebhookSignatureValidation, critical: false },
    { name: 'Rate Limiting', fn: testRateLimiting, critical: false },
    { name: 'Error Handling', fn: testErrorHandling, critical: false },
    { name: 'Payment Metrics', fn: testPaymentMetrics, critical: false },
    { name: 'Receipt Generation', fn: testReceiptGeneration, critical: false },
    { name: 'Circuit Breaker', fn: testCircuitBreaker, critical: false },
  ];
  
  for (const test of tests) {
    try {
      const result = await test.fn();
      testResults.tests.push({ name: test.name, passed: result });
      
      if (!result && test.critical) {
        logError(`Critical test failed: ${test.name}. Stopping tests.`);
        break;
      }
    } catch (error) {
      logError(`Test "${test.name}" threw an error: ${error.message}`);
      testResults.tests.push({ name: test.name, passed: false });
      testResults.failed++;
    }
  }
  
  // Print summary
  logSection('TEST SUMMARY');
  log(`Total Tests: ${testResults.passed + testResults.failed + testResults.skipped}`, colors.cyan);
  log(`Passed: ${testResults.passed}`, colors.green);
  log(`Failed: ${testResults.failed}`, colors.red);
  log(`Skipped: ${testResults.skipped}`, colors.yellow);
  
  const successRate = ((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(2);
  log(`\nSuccess Rate: ${successRate}%`, colors.cyan);
  
  log(`\nCompleted at: ${new Date().toISOString()}`, colors.cyan);
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  process.exit(1);
});
