# Enhanced KYC Detail View - Usage Guide

## Overview
The enhanced KYC detail view (`admin-kyc-enhanced.html`) provides a comprehensive visualization of confidence scores and face verification results for KYC submissions.

## Accessing the View
Navigate to: `http://localhost:3000/admin-kyc-enhanced.html?id=<submission_id>`

**Requirements:**
- Must be logged in as admin (token stored in localStorage)
- Must provide valid submission ID as query parameter

## Features

### 1. Face Verification Section
- **Decision Result Badge**: Color-coded badge showing:
  - ✓ VERIFIED (green) - Face match confidence ≥85%
  - ? UNCERTAIN (yellow) - Face match confidence 60-84%
  - ✗ REJECTED (red) - Face match confidence <60%

- **Face Match Confidence**: 
  - Large percentage display
  - Animated progress bar with color coding
  - Confidence message from face detection service

### 2. OCR Confidence Section
- **Overall OCR Confidence**:
  - Large percentage display
  - Animated progress bar with color coding
  - Calculated from all extracted fields

- **Field-Level Confidence**:
  - Individual progress bars for each extracted field
  - Shows field value and confidence percentage
  - Color coding: Green (≥85%), Yellow (≥60%), Red (<60%)

### 3. Color Coding System
- **Green (≥85%)**: High confidence - likely accurate
- **Yellow (≥60%)**: Medium confidence - review recommended
- **Red (<60%)**: Low confidence - manual verification required

## Data Structure
The view expects the following data from the backend API:

```javascript
{
  faceDecision: {
    resultCode: 'VERIFIED' | 'UNCERTAIN' | 'REJECTED'
  },
  faceDetection: {
    identityConfidence: number, // 0-100
    identityMessage: string,
    message: string
  },
  ocrData: {
    overallConfidence: number, // 0-100
    frontImage: {
      licenseNumber: string,
      fullName: string,
      // ... other fields
      confidence: number, // Image-level confidence
      fieldConfidence: { // Optional field-level confidence
        licenseNumber: number,
        fullName: number,
        // ... other fields
      }
    }
  }
}
```

## Notes
- If field-level confidence is not available, the view falls back to image-level confidence
- Missing data is handled gracefully with "N/A" or appropriate messages
- Raw JSON data is displayed at the bottom for debugging purposes
