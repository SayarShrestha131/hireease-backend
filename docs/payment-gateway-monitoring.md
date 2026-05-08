# Payment Gateway Failover and Monitoring

This document describes the payment gateway failover and monitoring features implemented for the Hire Ease payment system.

## Overview

The payment system now includes:
1. **Circuit Breaker Pattern** - Automatically disables failing gateways
2. **Gateway Health Monitoring** - Tracks response times and availability
3. **Payment Analytics** - Comprehensive metrics and alerting

## Features

### 1. Circuit Breaker Pattern

The circuit breaker protects the system from cascading failures by tracking gateway failures and temporarily disabling problematic gateways.

**Configuration:**
- Failure Threshold: 5 consecutive failures
- Reset Timeout: 300 seconds (5 minutes)
- States: CLOSED (normal), OPEN (disabled), HALF_OPEN (testing)

**Behavior:**
- After 5 consecutive failures, the circuit opens and the gateway is disabled
- Users are shown an error suggesting alternative payment methods
- After 5 minutes, the circuit transitions to HALF_OPEN for testing
- If the test succeeds, the circuit closes; if it fails, it reopens

**Service:** `backend/src/services/circuitBreakerService.ts`

### 2. Gateway Health Monitoring

Monitors gateway response times and provides health status for each gateway.

**Metrics Tracked:**
- Average response time (last 5 minutes)
- Slow response count (responses > 10 seconds)
- Circuit breaker state
- Gateway availability status

**Endpoints:**

#### Basic Health Check
```
GET /api/payments/health
```

Response:
```json
{
  "success": true,
  "data": {
    "khalti": "available",
    "stripe": "available",
    "paypal": "unavailable",
    "mode": "sandbox"
  }
}
```

#### Detailed Health Check
```
GET /api/payments/health/detailed
```

Response:
```json
{
  "success": true,
  "data": {
    "gateways": [
      {
        "gateway": "khalti",
        "status": "available",
        "averageResponseTime": 1250,
        "slowResponseCount": 0,
        "circuitState": "closed",
        "lastChecked": "2024-01-15T10:30:00.000Z"
      },
      {
        "gateway": "stripe",
        "status": "available",
        "averageResponseTime": 850,
        "slowResponseCount": 0,
        "circuitState": "closed",
        "lastChecked": "2024-01-15T10:30:00.000Z"
      },
      {
        "gateway": "paypal",
        "status": "unavailable",
        "averageResponseTime": 15000,
        "slowResponseCount": 3,
        "circuitState": "open",
        "lastChecked": "2024-01-15T10:30:00.000Z"
      }
    ],
    "mode": "sandbox",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Service:** `backend/src/services/gatewayMonitoringService.ts`

### 3. Payment Analytics and Metrics

Tracks payment performance metrics and triggers alerts when thresholds are exceeded.

**Metrics Tracked:**
- Success rate (successful / total payments)
- Average processing time
- Failure rate by reason
- Payment volume by method
- Revenue by method

**Alert Thresholds:**
- Success rate < 85%
- Processing time > 30 seconds

**Endpoints:**

#### Get Metrics for Date Range
```
GET /api/payments/metrics?startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "successRate": 92.5,
    "averageProcessingTime": 2500,
    "failureRate": 7.5,
    "failuresByReason": {
      "Insufficient funds": 15,
      "Invalid card": 8,
      "Network timeout": 3
    },
    "volumeByMethod": {
      "khalti": 120,
      "stripe": 85,
      "paypal": 45
    },
    "revenueByMethod": {
      "khalti": 125000,
      "stripe": 95000,
      "paypal": 48000
    },
    "totalPayments": 250,
    "totalSuccessful": 231,
    "totalFailed": 19,
    "totalRevenue": 268000,
    "dateRange": {
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T23:59:59.999Z"
    }
  }
}
```

#### Get Current Statistics
```
GET /api/payments/statistics
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "last24Hours": { /* metrics */ },
    "last7Days": { /* metrics */ },
    "last30Days": { /* metrics */ }
  }
}
```

**Service:** `backend/src/services/paymentAnalyticsService.ts`

## Integration with Gateway Services

The `GatewayExecutor` utility wraps all gateway operations with circuit breaker and monitoring:

```typescript
import GatewayExecutor from '../utils/gatewayExecutor';

// Example usage in a gateway service
const result = await GatewayExecutor.execute(
  'khalti',
  async () => {
    // Your gateway operation here
    return await khaltiApi.createPayment(...);
  },
  'createPayment'
);
```

**Benefits:**
- Automatic circuit breaker protection
- Response time tracking
- Consistent error handling
- Gateway availability checks

## Audit Logging

All monitoring events are logged to the audit log:

**New Event Types:**
- `gateway_outage` - Circuit breaker opened due to failures
- `payment_alert` - Alert triggered (low success rate, high processing time)

**Query Audit Logs:**
```typescript
const logs = await auditLogService.queryLogs({
  eventType: 'gateway_outage',
  gateway: 'khalti',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
});
```

## Monitoring Dashboard Recommendations

For production deployments, consider integrating with:

1. **Prometheus + Grafana** - For real-time metrics visualization
2. **Sentry** - For error tracking and alerting
3. **PagerDuty** - For on-call alerting when circuits open
4. **ELK Stack** - For centralized log analysis

## Testing

### Test Circuit Breaker

1. Simulate gateway failures by temporarily disabling a gateway
2. Make 5 consecutive payment attempts
3. Verify circuit opens and gateway becomes unavailable
4. Wait 5 minutes and verify circuit transitions to HALF_OPEN
5. Make a successful payment to close the circuit

### Test Monitoring

1. Make several payment requests
2. Check `/api/payments/health/detailed` for response times
3. Simulate slow responses (>10 seconds) and verify logging
4. Check monitoring data is retained for 5 minutes

### Test Analytics

1. Create test payments with various outcomes
2. Query `/api/payments/metrics` for date range
3. Verify success rate, failure rate, and revenue calculations
4. Trigger alerts by creating many failures (success rate < 85%)

## Configuration

All services use default configurations but can be customized:

```typescript
// Circuit Breaker
const circuitBreaker = new CircuitBreakerService({
  failureThreshold: 5,
  resetTimeout: 300000,
  monitoringWindow: 60000,
});

// Analytics
const analytics = new PaymentAnalyticsService({
  successRateThreshold: 85,
  processingTimeThreshold: 30000,
});
```

## Requirements Fulfilled

- **18.1-18.5**: Circuit breaker pattern with failure tracking and auto-recovery
- **18.6-18.7**: Gateway health monitoring with response time tracking
- **20.1-20.7**: Payment analytics with success rate, processing time, and alerting

## Next Steps

1. Add admin middleware to protect metrics endpoints
2. Integrate with external monitoring tools
3. Create dashboard UI for visualizing metrics
4. Set up automated alerts via email/SMS
5. Add more granular metrics (per-gateway, per-user, etc.)
