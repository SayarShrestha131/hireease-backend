/**
 * Property-Based Testing Setup
 * Shared configuration and utilities for fast-check PBT tests
 */
import * as fc from 'fast-check';

// Configure fast-check global settings
fc.configureGlobal({
  numRuns: 100,
  verbose: false,
});

export { fc };

/**
 * Common arbitraries for KYC testing
 */
export const arbitraries = {
  /** Confidence score: 0-100 */
  confidenceScore: fc.float({ min: 0, max: 100, noNaN: true }),

  /** Valid user ID (MongoDB ObjectId-like) */
  userId: fc.string({ minLength: 24, maxLength: 24 }).filter(s => /^[0-9a-fA-F]{24}$/.test(s)),

  /** KYC status */
  kycStatus: fc.constantFrom('pending', 'approved', 'rejected'),

  /** Timestamp within last 30 days */
  recentTimestamp: fc.date({
    min: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    max: new Date(),
  }),

  /** Rejection reason (valid: ≥10 chars) */
  validRejectionReason: fc.string({ minLength: 10, maxLength: 200 }),

  /** Rejection reason (invalid: <10 chars) */
  invalidRejectionReason: fc.string({ minLength: 0, maxLength: 9 }),

  /** License number */
  licenseNumber: fc.stringMatching(/^[A-Za-z0-9\-]{5,20}$/),

  /** Face decision result code */
  faceResultCode: fc.constantFrom('VERIFIED', 'UNCERTAIN', 'REJECTED'),
};
