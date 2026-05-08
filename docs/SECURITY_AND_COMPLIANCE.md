# Security and Compliance Documentation

## Overview

This document describes the security and PCI DSS compliance measures implemented in the Hire Ease payment gateway integration system.

## PCI DSS Compliance Measures

### 1. No CVV Storage (Requirement 17.1)

**Implementation:**
- The system NEVER stores CVV/CVC codes in the database
- All payment models explicitly exclude CVV fields
- Runtime validation checks for CVV fields in data structures
- Audit logging sanitizes any potential CVV data

**Validation:**
- `pciComplianceValidator.validateNoCVVStorage()` checks data structures
- Automated checks run on server startup
- Audit log service sanitizes all logged data

### 2. No Complete Card Numbers (Requirements 4.5, 17.2)

**Implementation:**
- Complete card numbers are NEVER stored in the database
- All card data collection happens on gateway-hosted pages
- Log sanitization removes any potential card number patterns
- Only last 4 digits (masked) may be stored for display purposes

**Validation:**
- `pciComplianceValidator.validateNoCompleteCardNumbers()` scans for card patterns
- `sanitizeLogMessage()` removes card numbers from logs
- Audit log service sanitizes gateway responses

### 3. Gateway-Hosted Payment Pages (Requirement 17.3)

**Implementation:**
- **Khalti**: Users are redirected to Khalti's hosted payment page
- **Stripe**: Uses Stripe Elements (client-side tokenization)
- **PayPal**: Users are redirected to PayPal's hosted checkout
- No direct card input on our servers

**Validation:**
- `pciComplianceValidator.validateGatewayHostedPages()` verifies payment flow
- Payment initiation returns redirect URLs or client secrets, never accepts card data

### 4. Encrypted API Credentials (Requirements 4.4, 17.4)

**Implementation:**
- All payment gateway API credentials are encrypted using AES-256-GCM
- Encryption uses PBKDF2 key derivation with 100,000 iterations
- Master encryption key stored in environment variable (should use KMS in production)
- Credentials are encrypted at rest and decrypted only when needed

**Files:**
- `backend/src/utils/credentialEncryption.ts` - Encryption utilities
- `ENCRYPTION_MASTER_KEY` environment variable

**Usage:**
```typescript
import { encryptCredential, decryptCredential } from './utils/credentialEncryption';

// Encrypt sensitive credential
const encrypted = encryptCredential('sk_live_secret_key');

// Decrypt when needed
const decrypted = decryptCredential(encrypted);
```

**Key Generation:**
```bash
# Generate a new master encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 5. TLS 1.2+ Enforcement (Requirements 4.6, 17.5)

**Implementation:**
- All payment gateway communications use HTTPS with TLS 1.2+
- Node.js defaults to TLS 1.2+ for HTTPS connections
- Gateway SDKs (Stripe, PayPal) enforce TLS 1.2+
- Runtime validation checks TLS configuration

**Validation:**
- `pciComplianceValidator.validateTLSVersion()` checks TLS settings
- Automated checks run on server startup

**Production Deployment:**
- Use reverse proxy (nginx, Apache) with TLS 1.2+ configuration
- Obtain SSL/TLS certificates from trusted CA
- Configure HTTPS enforcement in production

### 6. Secure Session Management (Requirement 17.6)

**Implementation:**
- JWT-based authentication with secure tokens
- Tokens expire after 7 days (configurable)
- Payment APIs require valid authentication token
- Session data never includes sensitive payment information

**Files:**
- `backend/src/middleware/auth.ts` - Authentication middleware
- `JWT_SECRET` environment variable

### 7. Authentication Required (Requirement 17.7)

**Implementation:**
- All payment API endpoints require authentication (except webhooks)
- `authenticate` middleware validates JWT tokens
- Unauthorized requests are rejected with 401 status
- Webhook endpoints use signature validation instead of JWT

**Protected Endpoints:**
- `POST /api/payments/initiate` - Requires authentication
- `POST /api/payments/verify` - Requires authentication
- `POST /api/payments/refund` - Requires authentication
- `GET /api/payments/history` - Requires authentication
- `GET /api/payments/receipt/:bookingId` - Requires authentication

**Validation:**
- `pciComplianceValidator.validateAuthenticationRequired()` checks auth status
- Rate limiting middleware tracks authenticated users

### 8. Audit Logging (Requirements 4.8, 17.8)

**Implementation:**
- Comprehensive audit logging for all payment operations
- Logs stored in MongoDB `audit_logs` collection
- All sensitive data is sanitized before logging
- Logs include timestamp, user ID, amount, payment method, and gateway response

**Logged Events:**
- `payment_attempt` - Payment initiation
- `payment_success` - Successful payment
- `payment_failure` - Failed payment
- `webhook_received` - Webhook notification received
- `webhook_signature_failed` - Security alert for invalid webhook
- `refund_request` - Refund initiated
- `refund_success` - Successful refund
- `refund_failure` - Failed refund

**Files:**
- `backend/src/services/auditLogService.ts` - Audit logging service

**Usage:**
```typescript
import auditLogService from './services/auditLogService';

// Log payment attempt
await auditLogService.logPaymentAttempt({
  userId: 'user123',
  bookingId: 'BK001',
  amount: 5000,
  currency: 'NPR',
  paymentMethod: 'khalti',
});

// Log security alert
await auditLogService.logWebhookSignatureFailure({
  gateway: 'stripe',
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
});
```

**Querying Audit Logs:**
```typescript
// Query logs by user
const logs = await auditLogService.queryLogs({
  userId: 'user123',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
  limit: 100,
});

// Query security alerts
const alerts = await auditLogService.queryLogs({
  eventType: 'webhook_signature_failed',
  gateway: 'stripe',
  limit: 50,
});
```

## Security Startup Checks

The system runs comprehensive security checks on startup to ensure PCI DSS compliance.

**Files:**
- `backend/src/utils/securityStartupChecks.ts` - Startup validation
- `backend/src/utils/pciComplianceValidator.ts` - Compliance validators

**Checks Performed:**
1. Credential encryption configuration validation
2. PCI DSS compliance checks (CVV, card numbers, TLS, etc.)
3. Environment variable validation
4. HTTPS enforcement check (production)
5. Payment gateway configuration validation

**Startup Output:**
```
=== Running Security Startup Checks ===

1. Validating credential encryption...
   ✓ Credential encryption validated

2. Running PCI DSS compliance checks...
   ✓ [INFO] 17.1 - No CVV Storage
   ✓ [INFO] 17.2 - No Complete Card Numbers
   ✓ [INFO] 17.3 - Gateway-Hosted Payment Pages
   ✓ [INFO] 17.5 - TLS 1.2+ Enforcement
   ✓ [INFO] 17.4 - Credential Encryption
   ✓ [INFO] 17.7 - Authentication Required

3. Validating environment configuration...
   ✓ Environment variables validated

4. Checking HTTPS enforcement...
   ✓ HTTPS configuration checked

=== Security Startup Check Summary ===
✓ All critical security checks passed
✓ Payment system is ready to process transactions securely
```

## Rate Limiting

**Implementation:**
- Payment endpoints are rate-limited to 10 attempts per user per hour
- Prevents brute force attacks and excessive payment attempts
- Rate limit data stored in memory (use Redis in production)

**Files:**
- `backend/src/middleware/rateLimiting.ts` - Rate limiting middleware

**Configuration:**
- `PAYMENT_RATE_LIMIT_PER_HOUR` environment variable (default: 10)

## Data Sanitization

All gateway responses and webhook payloads are sanitized before logging or storage.

**Sanitization Rules:**
1. Remove CVV/CVC fields
2. Mask complete card numbers
3. Remove API keys and secrets
4. Remove access tokens
5. Mask last 4 digits of cards (if present)

**Files:**
- `backend/src/services/auditLogService.ts` - `sanitizeGatewayResponse()`
- `backend/src/utils/pciComplianceValidator.ts` - `sanitizeLogMessage()`

## Production Deployment Checklist

### Required Configuration

- [ ] Set `NODE_ENV=production`
- [ ] Set `PAYMENT_MODE=production`
- [ ] Generate and set `ENCRYPTION_MASTER_KEY`
- [ ] Configure production payment gateway credentials
- [ ] Set up SSL/TLS certificates
- [ ] Enable `FORCE_HTTPS=true`
- [ ] Configure secure session management
- [ ] Set up Redis for rate limiting (optional but recommended)
- [ ] Configure log aggregation and monitoring
- [ ] Set up security alerts for webhook signature failures

### Security Hardening

- [ ] Use a secure key management service (AWS KMS, Azure Key Vault, HashiCorp Vault)
- [ ] Enable firewall rules to restrict access
- [ ] Configure reverse proxy (nginx, Apache) with security headers
- [ ] Enable HTTPS-only cookies
- [ ] Set up intrusion detection system (IDS)
- [ ] Configure automated security scanning
- [ ] Set up regular security audits
- [ ] Enable database encryption at rest
- [ ] Configure backup and disaster recovery

### Monitoring and Alerting

- [ ] Monitor audit logs for security alerts
- [ ] Set up alerts for webhook signature failures
- [ ] Monitor payment success/failure rates
- [ ] Track rate limiting violations
- [ ] Monitor encryption/decryption errors
- [ ] Set up uptime monitoring
- [ ] Configure error tracking (Sentry, Rollbar, etc.)

## Compliance Validation

### Manual Testing

1. **Test CVV Storage Prevention:**
   - Attempt to store CVV in database → Should fail validation
   - Check audit logs → No CVV codes present

2. **Test Card Number Protection:**
   - Check all logs → No complete card numbers
   - Verify gateway-hosted pages → No direct card input

3. **Test Webhook Security:**
   - Send webhook with invalid signature → Should be rejected
   - Check audit logs → Security alert logged

4. **Test Authentication:**
   - Access payment API without token → Should return 401
   - Access with valid token → Should succeed

5. **Test Rate Limiting:**
   - Make 11 payment attempts in 1 hour → 11th should be rejected
   - Wait 1 hour → Should reset

### Automated Testing

Run PCI DSS compliance checks:
```bash
# Start server (checks run automatically)
npm start

# Check logs for compliance results
```

## Security Incident Response

### Webhook Signature Failure

1. Alert is logged in audit logs with IP address and user agent
2. Request is rejected with 401 status
3. Review audit logs to identify source
4. Block malicious IP addresses if necessary
5. Rotate webhook secrets if compromise suspected

### Suspected Data Breach

1. Immediately review audit logs for suspicious activity
2. Check for any CVV or card number storage violations
3. Notify payment gateway providers
4. Rotate all API credentials
5. Generate new encryption master key
6. Notify affected users if necessary
7. Conduct security audit

## References

- [PCI DSS Requirements](https://www.pcisecuritystandards.org/)
- [Stripe Security Best Practices](https://stripe.com/docs/security)
- [PayPal Security Guidelines](https://developer.paypal.com/docs/security/)
- [Khalti Integration Guide](https://docs.khalti.com/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Support

For security concerns or questions, contact:
- Email: security@hireease.com
- Security Team: security-team@hireease.com
