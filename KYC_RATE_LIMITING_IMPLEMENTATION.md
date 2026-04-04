# KYC Rate Limiting Implementation

## Overview

This document describes the implementation of rate limiting for KYC submissions to prevent abuse and ensure system stability.

## Implementation Details

### Rate Limiting Configuration

- **Endpoint**: `POST /api/kyc/submit`
- **Limit**: 3 submissions per day per user
- **Window**: 24 hours (86,400,000 milliseconds)
- **Key Strategy**: User ID for authenticated users
- **Headers**: Standard rate limit headers enabled

### Code Location

The rate limiting is implemented in `backend/src/routes/kycRoutes.ts`:

```typescript
const kycSubmitLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hour window (1 day)
  max: 3, // Maximum 3 requests per day
  message: {
    success: false,
    error: 'Rate limit exceeded: Maximum 3 KYC submissions per day allowed.',
    message: 'You have exceeded the daily limit of 3 KYC submissions. Please try again tomorrow.',
    retryAfter: '24 hours'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: any) => {
    // Use user ID for authenticated users to ensure per-user limiting
    return req.user?._id?.toString();
  },
});
```

### Middleware Application

The rate limiter is applied to the KYC submit route:

```typescript
router.post(
  '/submit',
  authenticate,           // Authentication first
  kycSubmitLimiter,      // Rate limiting second
  uploadKYCDocuments,    // File upload handling
  handleUploadError,     // Error handling
  validateKYCSubmission, // Validation
  submitKYC             // Controller
);
```

## Features

### 1. Per-User Rate Limiting

- Each authenticated user has their own rate limit counter
- Uses user ID as the key for tracking submissions
- Different users have independent limits

### 2. Clear Error Messages

When rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": "Rate limit exceeded: Maximum 3 KYC submissions per day allowed.",
  "message": "You have exceeded the daily limit of 3 KYC submissions. Please try again tomorrow.",
  "retryAfter": "24 hours"
}
```

### 3. Rate Limit Headers

All responses include standard rate limit headers:

- `RateLimit-Limit`: Maximum number of requests allowed (3)
- `RateLimit-Remaining`: Number of requests remaining in current window
- `RateLimit-Reset`: Unix timestamp when the rate limit window resets

### 4. Security Considerations

- **User-based limiting**: Prevents users from bypassing limits by changing IP addresses
- **Authentication required**: Rate limiting only applies to authenticated users
- **IPv6 safe**: Uses express-rate-limit's built-in IP handling for fallback scenarios

## Testing

### Unit Tests

The implementation includes comprehensive unit tests in `backend/src/tests/kycRateLimit.test.ts`:

- Configuration validation
- Error message format verification
- Header presence validation
- Security requirements compliance

### Manual Testing

A manual test script is available at `backend/test-kyc-rate-limit.js` for integration testing.

## Requirements Compliance

This implementation satisfies **Requirements 11.7 (Security)**:

- ✅ Implements rate limiter: 3 submissions per day per user
- ✅ Returns clear error message when limit exceeded
- ✅ Adds rate limit headers to response

## Usage Examples

### Successful Submission (Within Limit)

```bash
curl -X POST http://localhost:5000/api/kyc/submit \
  -H "Authorization: Bearer <token>" \
  -F "licenseNumber=ABC123" \
  -F "fullName=John Doe" \
  -F "licenseFrontImage=@front.jpg" \
  -F "selfieImage=@selfie.jpg"
```

Response:
```
HTTP/1.1 201 Created
RateLimit-Limit: 3
RateLimit-Remaining: 2
RateLimit-Reset: 1640995200

{
  "success": true,
  "message": "KYC submission successful...",
  "data": { ... }
}
```

### Rate Limited Submission (Exceeded Limit)

```bash
# 4th submission within 24 hours
curl -X POST http://localhost:5000/api/kyc/submit \
  -H "Authorization: Bearer <token>" \
  -F "licenseNumber=ABC123" \
  -F "fullName=John Doe" \
  -F "licenseFrontImage=@front.jpg" \
  -F "selfieImage=@selfie.jpg"
```

Response:
```
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 3
RateLimit-Remaining: 0
RateLimit-Reset: 1640995200

{
  "success": false,
  "error": "Rate limit exceeded: Maximum 3 KYC submissions per day allowed.",
  "message": "You have exceeded the daily limit of 3 KYC submissions. Please try again tomorrow.",
  "retryAfter": "24 hours"
}
```

## Monitoring and Maintenance

### Logs

Rate limiting events are automatically logged by express-rate-limit. Monitor for:

- High frequency of rate limit violations (may indicate abuse)
- Unusual patterns in submission timing

### Configuration Updates

To modify rate limiting parameters:

1. Update the `kycSubmitLimiter` configuration in `kycRoutes.ts`
2. Update corresponding tests
3. Update this documentation
4. Deploy changes

### Performance Impact

- Minimal performance overhead
- In-memory storage (default) - suitable for single-instance deployments
- For multi-instance deployments, consider using Redis store:

```typescript
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL);

const kycSubmitLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
  // ... other options
});
```

## Troubleshooting

### Common Issues

1. **Rate limit not working**: Ensure middleware is applied in correct order
2. **Users bypassing limits**: Verify keyGenerator is using user ID correctly
3. **Headers missing**: Check standardHeaders is set to true

### Debug Mode

Enable debug logging:

```typescript
const kycSubmitLimiter = rateLimit({
  // ... other options
  skip: (req) => {
    console.log(`Rate limit check for user: ${req.user?._id}`);
    return false;
  }
});
```