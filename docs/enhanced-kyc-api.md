# Enhanced KYC API Documentation

## KYC Eligibility Check

**GET** `/api/kyc/eligibility`

Checks if the authenticated user is eligible to submit a KYC application.

**Response:**
```json
{
  "success": true,
  "data": {
    "hasProfilePicture": true,
    "hasPendingSubmission": false
  }
}
```

**Error (no profile picture):**
```json
{
  "success": false,
  "error": "Profile picture required before KYC submission",
  "requiresProfilePicture": true
}
```

---

## KYC Submission (Enhanced)

**POST** `/api/kyc/submit` — `multipart/form-data`

Fields: `licenseNumber`, `fullName`, `fatherName?`, `dateOfBirth`, `licenseExpiryDate`, `licenseIssueDate?`, `issuedBy`, `licenseOffice`, `address`, `contactNumber`, `previousSubmissionId?`

Files: `licenseFrontImage` (required), `licenseBackImage?`, `selfieImage` (required)

**Response includes enhanced fields:**
```json
{
  "success": true,
  "data": {
    "submission": {
      "_id": "...",
      "status": "pending",
      "faceDetection": {
        "hasFace": true,
        "identityConfidence": 87.5,
        "isIdentityMatch": true,
        "message": "Face match verified"
      },
      "faceDecision": {
        "resultCode": "VERIFIED",
        "confidence": 87.5,
        "reviewedSignal": "auto-face-match"
      },
      "ocrData": {
        "frontImage": { "licenseNumber": "...", "fullName": "..." },
        "overallConfidence": 82,
        "fieldConfidence": {
          "licenseNumber": 95,
          "fullName": 88,
          "dateOfBirth": 79
        }
      },
      "dataVerification": {
        "licenseNumberMatch": true,
        "nameMatch": true,
        "dobMatch": true,
        "matchScore": 91
      }
    }
  }
}
```

**Resubmission (24-hour window error):**
```json
{
  "success": false,
  "error": "Resubmission not allowed yet",
  "data": { "remainingHours": 18.5 }
}
```

---

## Admin Endpoints

### List Submissions (Enhanced Filtering)

**GET** `/api/kyc/admin/submissions`

Query params: `status`, `search`, `page`, `limit`, `faceConfidenceMin`, `faceConfidenceMax`, `ocrConfidenceMin`, `ocrConfidenceMax`, `autoApproved`, `sortBy` (`submittedAt`|`faceConfidence`|`ocrConfidence`), `sortOrder` (`asc`|`desc`)

### Approve

**PUT** `/api/kyc/admin/submissions/:id/approve`
```json
{ "note": "Optional review note" }
```

### Reject

**PUT** `/api/kyc/admin/submissions/:id/reject`
```json
{ "reason": "Minimum 10 character reason" }
```

### Revoke Approved

**PUT** `/api/kyc/admin/submissions/:id/revoke`
```json
{ "reason": "Minimum 10 character reason" }
```

---

## Confidence Score Thresholds

| Score | Level | Action |
|-------|-------|--------|
| ≥ 85 | High | Auto-approval eligible |
| 60–84 | Medium | Manual review required |
| < 60 | Low | Likely rejection |
