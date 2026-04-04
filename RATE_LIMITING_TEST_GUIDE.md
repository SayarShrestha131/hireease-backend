# Profile Picture Upload Rate Limiting Test Guide

## Overview
This guide demonstrates how to test the rate limiting functionality for profile picture uploads.

## Implementation Details

### Rate Limiting Configuration
- **Limit**: 5 uploads per hour per user
- **Window**: 1 hour (3600000 ms)
- **Key**: User ID for authenticated users, IP address for unauthenticated
- **Headers**: Standard rate limit headers enabled

### Error Response Format
When rate limit is exceeded, the API returns:
```json
{
  "success": false,
  "error": "Too many profile picture uploads. You can upload up to 5 pictures per hour.",
  "retryAfter": "Please try again in an hour.",
  "resetTime": "2024-01-15T15:30:00.000Z",
  "limit": 5,
  "windowMs": 3600000
}
```

### Rate Limit Headers
The following headers are included in responses:
- `RateLimit-Limit`: Maximum number of requests allowed
- `RateLimit-Remaining`: Number of requests remaining in current window
- `RateLimit-Reset`: Time when the rate limit window resets

## Manual Testing Steps

### Prerequisites
1. Start the backend server: `npm run dev`
2. Have a valid JWT token for authentication
3. Prepare a test image file

### Test Procedure

1. **First 5 uploads** - Should succeed:
   ```bash
   curl -X POST http://localhost:5000/api/profile/picture \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -F "profilePicture=@test-image.jpg"
   ```

2. **6th upload** - Should be rate limited:
   ```bash
   curl -X POST http://localhost:5000/api/profile/picture \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -F "profilePicture=@test-image.jpg"
   ```
   Expected response: HTTP 429 with rate limit error

3. **Check headers** in responses:
   - Look for `RateLimit-*` headers
   - Verify `RateLimit-Remaining` decreases with each request

### Testing Different Users
Rate limiting is per-user, so different authenticated users have separate limits:

1. Upload 5 times with User A token
2. Upload with User B token - should succeed (separate limit)
3. Upload again with User A token - should be rate limited

### Security Features
- **IPv6 Support**: Properly handles IPv6 addresses for unauthenticated users
- **User-based Limiting**: Authenticated users are rate limited by user ID
- **Fallback to IP**: Unauthenticated requests are rate limited by IP address
- **Clear Error Messages**: User-friendly error messages with retry guidance

## Requirements Compliance
This implementation satisfies **Requirements 11.7 (Security)**:
- ✅ Implements rate limiter: 5 uploads per hour per user
- ✅ Returns clear error message when limit exceeded  
- ✅ Adds rate limit headers to response

## Code Location
- Route configuration: `backend/src/routes/profileRoutes.ts`
- Test file: `backend/src/tests/profilePictureRateLimit.test.ts`