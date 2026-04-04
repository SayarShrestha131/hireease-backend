# Admin KYC Review Guide

## Confidence Score Interpretation

| Score | Level | Indicator | Recommended Action |
|-------|-------|-----------|-------------------|
| 85–100 | High | 🟢 Green | Auto-approval eligible |
| 60–84 | Medium | 🟡 Yellow | Manual review required |
| 0–59 | Low | 🔴 Red | Likely reject, check carefully |

## Face Matching Results

- **VERIFIED** — High confidence match (≥85%). Safe to approve if documents are valid.
- **UNCERTAIN** — Medium confidence (60–84%). Manually compare profile picture and selfie.
- **REJECTED** — Low confidence (<60%). Face likely doesn't match; reject unless there's a clear explanation.

## OCR Data Comparison

The system extracts data from license images and compares it with user-entered data:
- **Green fields** — OCR matches user input
- **Red fields** — Mismatch detected; verify manually
- **Match Score** — Overall percentage of matching fields

Low OCR confidence on a field means the text was hard to read. Cross-reference with the actual license image.

## Decision Guidelines

**Approve when:**
- Face confidence ≥ 85% (VERIFIED)
- OCR match score ≥ 80%
- License is not expired
- Images are clear and authentic

**Reject when:**
- Face confidence < 60% (REJECTED)
- Significant data mismatches
- License is expired
- Images appear tampered or fraudulent

**Request resubmission (reject with guidance) when:**
- Images are blurry or low quality
- Selfie doesn't match profile picture due to poor lighting
- OCR failed due to image quality

## Fraud Indicators

- Very low face confidence with high OCR confidence (possible photo substitution)
- Multiple rejected submissions in short time
- Data mismatches on critical fields (name, DOB, license number)
- Unusual submission patterns

## Audit Trail

All approval, rejection, and revocation actions are logged with:
- Admin user ID
- Timestamp
- Notes/reason

This audit trail is stored in `statusHistory` and cannot be modified.
