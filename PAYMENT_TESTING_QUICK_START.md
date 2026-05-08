# Payment Gateway Integration - Quick Start Testing Guide

## Quick Test Execution

### 1. Setup (One-time)

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Configure test credentials in .env
nano .env
```

### 2. Run All Payment Tests

```bash
# Run all three test suites
npm test -- --testPathPattern="security-audit|gateway-failover|payment-reconciliation"
```

### 3. Run Individual Test Suites

```bash
# Task 19.2: Security Audit
npm test -- security-audit.test.ts

# Task 19.3: Gateway Failover
npm test -- gateway-failover.test.ts

# Task 19.4: Reconciliation & Reporting
npm test -- payment-reconciliation.test.ts
```

### 4. Run with Coverage

```bash
npm test -- --coverage --testPathPattern="security-audit|gateway-failover|payment-reconciliation"
```

## Quick Manual Tests

### Check Health Status
```bash
curl http://localhost:5000/api/payments/health
```

### Get Reconciliation Report
```bash
curl -X GET "http://localhost:5000/api/payments/reconciliation?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Download CSV Report
```bash
curl -X GET "http://localhost:5000/api/payments/reconciliation?startDate=2024-01-01&endDate=2024-12-31&format=csv" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -o report.csv
```

### Check Payment Metrics
```bash
curl -X GET "http://localhost:5000/api/payments/metrics?startDate=2024-01-01&endDate=2024-12-31" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Expected Results Summary

### Task 19.2: Security Audit ✓
- No card data in database
- Credentials from environment
- HTTPS enforced
- Webhooks validated
- Rate limiting active
- All operations logged

### Task 19.3: Gateway Failover ✓
- Circuit opens after 5 failures
- Auto-retry after 5 minutes
- Health check accurate
- Slow responses logged
- Alternative methods suggested

### Task 19.4: Reconciliation ✓
- Reports generated correctly
- CSV export works
- Status sync functional
- Metrics calculated
- Analytics accurate

## Troubleshooting

### Tests Fail - Missing Credentials
```bash
# Check .env file has all required variables
grep -E "KHALTI|STRIPE|PAYPAL" .env
```

### Tests Timeout
```bash
# Increase timeout in jest.config.js
testTimeout: 30000
```

### Database Connection Error
```bash
# Start MongoDB
mongod --dbpath /path/to/test/db

# Or use Docker
docker run -d -p 27017:27017 mongo:latest
```

## Documentation

- **Full Testing Guide**: `backend/docs/payment-integration-testing-guide.md`
- **Test Report Template**: `backend/docs/payment-integration-test-report.md`
- **Sandbox Testing**: `backend/docs/sandbox-testing-guide.md`

## Test Files Location

```
backend/src/tests/
├── security-audit.test.ts           # Task 19.2
├── gateway-failover.test.ts         # Task 19.3
└── payment-reconciliation.test.ts   # Task 19.4
```

## Quick Verification Checklist

- [ ] All automated tests pass
- [ ] No card data in database
- [ ] Webhook signatures validated
- [ ] Rate limiting enforced
- [ ] Circuit breaker works
- [ ] Health check accurate
- [ ] Reports generate correctly
- [ ] CSV export works
- [ ] Status sync functional
- [ ] Metrics calculated correctly

## Next Steps

1. Run automated tests
2. Review test results
3. Perform manual checks
4. Fill out test report
5. Document issues
6. Get sign-off

## Support

For issues or questions:
- Check full testing guide
- Review test logs
- Check application logs
- Verify environment configuration
