# Payment Gateway Integration - Testing Guide

## Overview

This document provides comprehensive testing procedures for Task 19 (Final integration and end-to-end testing) of the Payment Gateway Integration specification. It covers security audits, failover scenarios, and reconciliation/reporting verification.

## Test Files Created

1. **security-audit.test.ts** - Security compliance and PCI DSS verification
2. **gateway-failover.test.ts** - Circuit breaker and failover scenario testing
3. **payment-reconciliation.test.ts** - Reconciliation reports and analytics testing

## Prerequisites

### Environment Setup

1. **Test Database**: Ensure MongoDB test instance is running
   ```bash
   # Set test database URL in .env
   MONGODB_URI=mongodb://localhost:27017/hire-ease-test
   ```

2. **Payment Gateway Credentials**: Configure sandbox credentials
   ```bash
   PAYMENT_MODE=sandbox
   
   # Khalti Sandbox
   KHALTI_ENABLED=true
   KHALTI_PUBLIC_KEY=test_public_key_xxx
   KHALTI_SECRET_KEY=test_secret_key_xxx
   KHALTI_WEBHOOK_SECRET=test_webhook_secret_xxx
   
   # Stripe Test Mode
   STRIPE_ENABLED=true
   STRIPE_PUBLIC_KEY=pk_test_YOUR_KEY
   STRIPE_SECRET_KEY=sk_test_YOUR_SECRET
   STRIPE_WEBHOOK_SECRET=whsec_test_YOUR_WEBHOOK
   
   # PayPal Sandbox
   PAYPAL_ENABLED=true
   PAYPAL_CLIENT_ID=sandbox_client_id_xxx
   PAYPAL_CLIENT_SECRET=sandbox_client_secret_xxx
   PAYPAL_WEBHOOK_ID=sandbox_webhook_id_xxx
   ```

3. **Install Dependencies**:
   ```bash
   cd backend
   npm install
   ```

## Running Tests

### Run All Payment Integration Tests

```bash
npm test -- --testPathPattern="security-audit|gateway-failover|payment-reconciliation"
```

### Run Individual Test Suites

#### Task 19.2: Security Audit Tests
```bash
npm test -- security-audit.test.ts
```

**What it tests:**
- No card data storage (Requirements 4.5, 17.1, 17.2)
- Credential encryption (Requirements 4.4, 17.4)
- TLS enforcement (Requirements 4.6, 17.5)
- Webhook signature validation (Requirements 4.2, 4.3, 9.2)
- Rate limiting (Requirement 4.7)
- Audit logging (Requirements 4.8, 17.8)

**Expected Results:**
- ✓ All payment transactions should NOT contain card numbers or CVV codes
- ✓ API credentials should be loaded from environment variables
- ✓ All gateway endpoints should use HTTPS
- ✓ Invalid webhook signatures should be rejected with 401 status
- ✓ 11th payment attempt within an hour should be rate limited
- ✓ All payment operations should be logged with required details

#### Task 19.3: Gateway Failover Tests
```bash
npm test -- gateway-failover.test.ts
```

**What it tests:**
- Circuit breaker pattern (Requirements 18.3, 18.4, 18.5)
- Gateway outage logging (Requirements 18.1, 18.5)
- Response time monitoring (Requirement 18.6)
- Health check endpoint (Requirement 18.7)
- Alternative payment method suggestions (Requirement 18.2)

**Expected Results:**
- ✓ Circuit should open after 5 consecutive failures
- ✓ Requests should be blocked when circuit is open
- ✓ Circuit should auto-retry after 300 seconds
- ✓ Circuit should transition to half-open state for testing
- ✓ Slow responses (>10 seconds) should be logged
- ✓ Health check endpoint should show accurate gateway status
- ✓ Alternative payment methods should be suggested when gateway is down

#### Task 19.4: Reconciliation and Reporting Tests
```bash
npm test -- payment-reconciliation.test.ts
```

**What it tests:**
- Reconciliation report generation (Requirements 13.1, 13.2, 13.3)
- CSV export functionality (Requirements 13.4, 13.5)
- Payment status sync (Requirements 13.6, 13.7)
- Payment analytics metrics (Requirements 20.1-20.5)
- Payment alerts (Requirements 20.6, 20.7)

**Expected Results:**
- ✓ Reconciliation reports should include all transactions in date range
- ✓ Summary should calculate successful, failed, and refunded totals
- ✓ Transactions should be grouped by payment method
- ✓ CSV export should include all required fields
- ✓ Status sync should detect mismatches between local and gateway
- ✓ Analytics should track success rate, processing time, and volume
- ✓ Metrics API should require date range parameters

## Manual Testing Procedures

### Security Audit Manual Checks

#### 1. Database Inspection
```bash
# Connect to MongoDB
mongo hire-ease-test

# Check for card data in transactions
db.paymenttransactions.find({}).forEach(function(doc) {
  var str = JSON.stringify(doc);
  if (str.match(/\b\d{13,19}\b/)) {
    print("WARNING: Potential card number found in transaction: " + doc._id);
  }
});

# Check for CVV codes
db.paymenttransactions.find({
  $or: [
    { "gatewayMetadata.cvv": { $exists: true } },
    { "gatewayMetadata.cvc": { $exists: true } }
  ]
}).count(); // Should return 0
```

#### 2. Log File Inspection
```bash
# Check application logs for sensitive data
cd backend/logs
grep -r "\b\d{13,19}\b" . # Should not find card numbers
grep -ri "cvv\|cvc" . # Should not find CVV codes
```

#### 3. Environment Variable Verification
```bash
# Verify credentials are not hardcoded
cd backend
grep -r "sk_live_\|sk_te" src/ # Should only find in config loading (check for live/test keys)
grep -r "KHALTI_SECRET_KEY\s*=" src/ # Should not find hardcoded values
```

### Failover Scenario Manual Testing

#### 1. Simulate Gateway Downtime

**Test Khalti Failover:**
```bash
# Temporarily disable Khalti in .env
KHALTI_ENABLED=false

# Restart server
npm run dev

# Try to initiate payment with Khalti
curl -X POST http://localhost:5000/api/payments/initiate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "BK-TEST-123",
    "paymentMethod": "khalti",
    "returnUrl": "http://localhost:3000/payment/return"
  }'

# Expected: Error suggesting alternative payment method
```

**Test Circuit Breaker:**
```bash
# Use invalid credentials to trigger failures
# Make 5+ payment attempts rapidly
# Check health endpoint
curl http://localhost:5000/api/payments/health

# Expected: Khalti status should be "unavailable"
```

#### 2. Monitor Response Times

```bash
# Check detailed health status
curl http://localhost:5000/api/payments/health/detailed

# Expected response:
{
  "success": true,
  "data": {
    "gateways": [
      {
        "gateway": "khalti",
        "status": "available",
        "averageResponseTime": 1500,
        "slowResponseCount": 0,
        "circuitState": "closed",
        "lastChecked": "2024-01-15T10:30:00.000Z"
      },
      ...
    ]
  }
}
```

### Reconciliation Manual Testing

#### 1. Generate Reconciliation Report

```bash
# Get reconciliation report for date range
curl -X GET "http://localhost:5000/api/payments/reconciliation?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Expected: JSON report with summary and transactions
```

#### 2. Export CSV Report

```bash
# Download CSV export
curl -X GET "http://localhost:5000/api/payments/reconciliation?startDate=2024-01-01&endDate=2024-12-31&format=csv" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -o reconciliation-report.csv

# Verify CSV content
cat reconciliation-report.csv | head -n 5
```

#### 3. Sync Payment Status

```bash
# Sync specific transaction with gateway
curl -X POST http://localhost:5000/api/payments/sync-status \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": "TXN-20240115-1234"
  }'

# Expected: Status comparison between local and gateway
{
  "success": true,
  "data": {
    "transactionId": "TXN-20240115-1234",
    "localStatus": "completed",
    "gatewayStatus": "completed",
    "statusMismatch": false,
    "message": "Status is in sync with gateway."
  }
}
```

#### 4. Check Payment Metrics

```bash
# Get payment analytics
curl -X GET "http://localhost:5000/api/payments/metrics?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# Expected: Metrics including success rate, processing time, volume
```

## Test Coverage Summary

### Task 19.2: Security Audit
- ✅ No card data storage verification
- ✅ Credential encryption checks
- ✅ TLS enforcement validation
- ✅ Webhook signature validation
- ✅ Rate limiting enforcement
- ✅ Audit logging verification
- ✅ Access control testing
- ✅ Error message sanitization

### Task 19.3: Gateway Failover
- ✅ Circuit breaker opens after 5 failures
- ✅ Requests blocked when circuit open
- ✅ Auto-retry after 300 seconds
- ✅ Half-open state transition
- ✅ Circuit closes on success
- ✅ Gateway outage logging
- ✅ Response time tracking
- ✅ Slow response detection (>10s)
- ✅ Health check endpoint accuracy
- ✅ Alternative method suggestions

### Task 19.4: Reconciliation & Reporting
- ✅ Date range filtering
- ✅ Total calculations (successful, failed, refunded)
- ✅ Net revenue calculation
- ✅ Grouping by payment method
- ✅ CSV export with all fields
- ✅ Gateway transaction ID inclusion
- ✅ Status sync with gateway
- ✅ Mismatch detection
- ✅ Success rate tracking
- ✅ Processing time metrics
- ✅ Failure rate by reason
- ✅ Volume and revenue by method
- ✅ Metrics API endpoint

## Known Issues and Limitations

### Test Environment Limitations

1. **Gateway API Mocking**: Some tests may require mocking gateway APIs since sandbox environments have rate limits and may not support all test scenarios.

2. **Webhook Testing**: Webhook signature validation tests may need to be adjusted based on actual gateway webhook formats.

3. **Rate Limiting**: Rate limit tests may take time to execute (30+ seconds) due to the need to make multiple requests.

### Manual Verification Required

1. **Production Credentials**: Verify production credentials are properly encrypted and stored securely (cannot be fully automated).

2. **TLS Version**: Verify TLS 1.2+ is enforced at the infrastructure level (load balancer, reverse proxy).

3. **Log Rotation**: Verify log files are properly rotated and archived to prevent sensitive data accumulation.

## Troubleshooting

### Tests Failing Due to Missing Credentials

**Problem**: Tests fail with "credentials required" errors.

**Solution**:
```bash
# Copy .env.example to .env
cp .env.example .env

# Fill in test credentials
nano .env
```

### Circuit Breaker Tests Timing Out

**Problem**: Circuit breaker tests take too long or timeout.

**Solution**:
```javascript
// Increase test timeout in test file
it('should test circuit breaker', async () => {
  // ...
}, 30000); // 30 second timeout
```

### Database Connection Issues

**Problem**: Tests fail to connect to MongoDB.

**Solution**:
```bash
# Start MongoDB
mongod --dbpath /path/to/test/db

# Or use Docker
docker run -d -p 27017:27017 mongo:latest
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
name: Payment Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:latest
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd backend
          npm install
      
      - name: Run security audit tests
        run: npm test -- security-audit.test.ts
        env:
          MONGODB_URI: mongodb://localhost:27017/hire-ease-test
          PAYMENT_MODE: sandbox
      
      - name: Run failover tests
        run: npm test -- gateway-failover.test.ts
      
      - name: Run reconciliation tests
        run: npm test -- payment-reconciliation.test.ts
```

## Conclusion

This testing guide provides comprehensive coverage for Task 19 of the Payment Gateway Integration. All three subtasks (19.2, 19.3, 19.4) are covered with automated tests and manual verification procedures.

### Next Steps

1. Run all automated tests to verify implementation
2. Perform manual security audit checks
3. Test failover scenarios in staging environment
4. Generate reconciliation reports with real data
5. Document any issues found
6. Create bug reports for failures
7. Verify fixes and re-test

### Sign-off Checklist

- [ ] All automated tests pass
- [ ] Manual security checks completed
- [ ] Failover scenarios tested
- [ ] Reconciliation reports generated
- [ ] CSV exports verified
- [ ] Status sync tested
- [ ] Analytics metrics validated
- [ ] Documentation updated
- [ ] Issues logged and tracked
