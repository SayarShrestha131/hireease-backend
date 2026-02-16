# KYC System Error Handling Documentation

## Overview

This document describes the comprehensive error handling and user feedback mechanisms implemented in the KYC verification system.

## Backend Error Handling

### 1. File Upload Error Handling

**Location:** `backend/src/middleware/uploadMiddleware.ts`

The upload middleware now includes comprehensive error handling for multer file upload errors:

- **File Size Limit (413):** "File size exceeds the 5MB limit. Please upload smaller images."
- **File Count Limit (400):** "Too many files. Please upload only front and back images of your license."
- **Unexpected File Field (400):** "Unexpected file field. Please upload only licenseFrontImage and licenseBackImage."
- **Invalid File Type (400):** "Invalid file type. Only JPEG, JPG, PNG, and PDF files are allowed."

### 2. Controller Error Messages

**Location:** `backend/src/controllers/kycController.ts`

Enhanced error messages for better user understanding:

- **Authentication Required (401):** "Authentication required. Please log in to submit KYC."
- **Missing Images (400):** "Both license front and back images are required. Please upload clear photos of both sides of your license."
- **Duplicate Pending (400):** "You already have a pending KYC submission. Please wait for it to be reviewed before submitting again."

### 3. Route Configuration

**Location:** `backend/src/routes/kycRoutes.ts`

The KYC submission route now includes the `handleUploadError` middleware:

```typescript
router.post(
  '/submit',
  authenticate,
  kycSubmitLimiter,
  uploadKYCDocuments,
  handleUploadError,  // New middleware
  validateKYCSubmission,
  submitKYC
);
```

## Frontend Error Handling

### 1. Toast Notification System

**Location:** `frontend/my-expo-app/src/utils/toast.ts`

A new toast utility provides consistent user feedback:

- `showSuccess(message, onPress?)` - Success notifications
- `showError(message, onPress?)` - Error notifications
- `showInfo(message, onPress?)` - Info notifications
- `showWarning(message, onPress?)` - Warning notifications
- `showConfirmation(title, message, onConfirm, onCancel?)` - Confirmation dialogs

### 2. Enhanced KYC Service

**Location:** `frontend/my-expo-app/src/services/kycService.ts`

#### Retry Mechanism

The service now includes automatic retry logic for failed operations:

- **Max Retries:** 2 attempts (3 total tries)
- **Retry Delay:** Exponential backoff (1s, 2s, 4s)
- **Smart Retry:** Only retries on server errors (5xx) and network errors
- **No Retry:** Client errors (4xx) fail immediately

#### Enhanced Error Messages

The service provides user-friendly error messages for all scenarios:

| Status Code | User-Friendly Message |
|-------------|----------------------|
| 400 (expired) | "Your license has expired. Please provide a valid license." |
| 400 (pending) | "You already have a pending KYC submission. Please wait for review." |
| 400 (image) | "Invalid image file. Please upload clear photos of your license (JPEG, PNG, or PDF, max 5MB)." |
| 401 | "Your session has expired. Please log in again." |
| 403 | "You do not have permission to perform this action." |
| 404 | "The requested information could not be found." |
| 413 | "Image file is too large. Please upload images smaller than 5MB." |
| 429 | "Too many requests. Please wait a moment and try again." |
| 500 | "Server error. Our team has been notified. Please try again later." |
| 503 | "Service temporarily unavailable. Please try again in a few moments." |
| Network Error | "Network error. Please check your internet connection and try again." |
| Timeout | "Request timeout. Please check your internet connection and try again." |

### 3. UI Components

#### LoadingOverlay Component

**Location:** `frontend/my-expo-app/src/components/LoadingOverlay.tsx`

A reusable loading overlay for async operations:

```typescript
<LoadingOverlay 
  visible={isSubmitting} 
  message="Uploading your documents..." 
/>
```

#### SuccessMessage Component

**Location:** `frontend/my-expo-app/src/components/SuccessMessage.tsx`

A success message banner to complement the existing ErrorMessage component:

```typescript
<SuccessMessage 
  message={successMessage} 
  onDismiss={() => setSuccessMessage(null)} 
/>
```

### 4. Screen-Level Error Handling

#### KYCSubmissionScreen

- **Form Validation:** Client-side validation with field-specific error messages
- **Image Upload Errors:** User-friendly messages for permission and picker errors
- **Submission Errors:** Toast notifications with detailed error messages
- **Loading State:** Full-screen loading overlay during submission
- **Success Feedback:** Toast notification with navigation callback

#### KYCStatusScreen

- **Loading State:** Centered spinner with message
- **Error State:** Full-screen error view with retry button
- **Network Errors:** Toast notifications on refresh failures
- **Pull-to-Refresh:** Silent error handling to avoid duplicate messages

#### KYCDetailScreen (Admin)

- **Loading State:** Centered spinner during data fetch
- **Error State:** Full-screen error view with retry button
- **Action Errors:** Toast notifications for approve/reject failures
- **Loading Overlay:** Modal overlay during approve/reject actions
- **Success Feedback:** Toast notification with navigation callback
- **Validation:** Client-side validation for rejection reason

#### KYCReviewListScreen (Admin)

- **Loading State:** Centered spinner during initial load
- **Error State:** Full-screen error view with retry button
- **Network Errors:** Toast notifications on fetch failures
- **Pull-to-Refresh:** Silent error handling to avoid duplicate messages
- **Pagination Errors:** Non-intrusive error handling for load more

## Error Handling Best Practices

### 1. User-Friendly Messages

All error messages are written in plain language that:
- Explains what went wrong
- Provides actionable guidance
- Avoids technical jargon
- Maintains a helpful tone

### 2. Consistent Error Format

Backend errors follow a consistent format:

```json
{
  "success": false,
  "error": "User-friendly error message"
}
```

### 3. Logging

All errors are logged with context:

```typescript
console.error('[KYC Service] ❌ Submit KYC failed:', error);
```

### 4. Graceful Degradation

- Network errors trigger retry mechanism
- Failed operations show clear error messages
- Users can always retry failed operations
- Loading states prevent duplicate submissions

### 5. Edge Case Handling

The system handles:
- Expired tokens (401) - Automatic logout
- Network timeouts - Retry with exponential backoff
- Large files (413) - Clear size limit message
- Invalid file types - Specific format requirements
- Duplicate submissions - Informative prevention message
- Server errors (500) - Reassuring message with retry option

## Testing Error Scenarios

### Manual Testing Checklist

- [ ] Submit KYC with expired license
- [ ] Submit KYC with oversized images (>5MB)
- [ ] Submit KYC with invalid file types
- [ ] Submit duplicate pending KYC
- [ ] Test network disconnection during submission
- [ ] Test server timeout scenarios
- [ ] Test admin approval with network error
- [ ] Test admin rejection with short reason
- [ ] Test image loading failures
- [ ] Test pull-to-refresh error handling

### Automated Testing

Error handling can be tested by:
1. Mocking network failures in service tests
2. Testing retry mechanism with controlled failures
3. Validating error message transformations
4. Testing loading state transitions

## Future Enhancements

1. **Offline Support:** Queue submissions when offline
2. **Progress Tracking:** Show upload progress for large files
3. **Error Analytics:** Track error rates and types
4. **Smart Retry:** Adjust retry strategy based on error type
5. **Partial Upload Recovery:** Resume failed uploads
6. **Error Reporting:** Allow users to report persistent errors
