/**
 * Test data generators for KYC property-based tests
 */
import * as fc from 'fast-check';

/** User with or without profile picture */
export const userGenerator = (hasProfilePicture?: boolean) =>
  fc.record({
    _id: fc.string({ minLength: 24, maxLength: 24 }).filter(s => /^[0-9a-fA-F]{24}$/.test(s)),
    email: fc.emailAddress(),
    username: fc.string({ minLength: 2, maxLength: 30 }),
    profilePicture: hasProfilePicture === true
      ? fc.string({ minLength: 5, maxLength: 50 })
      : hasProfilePicture === false
        ? fc.constant(null)
        : fc.option(fc.string({ minLength: 5, maxLength: 50 }), { nil: null }),
  });

/** KYC form data */
export const kycFormDataGenerator = () =>
  fc.record({
    licenseNumber: fc.stringMatching(/^[A-Za-z0-9]{5,15}$/),
    fullName: fc.string({ minLength: 2, maxLength: 60 }),
    fatherName: fc.option(fc.string({ minLength: 2, maxLength: 60 }), { nil: undefined }),
    dateOfBirth: fc.date({ min: new Date('1950-01-01'), max: new Date('2005-01-01') }),
    licenseExpiryDate: fc.date({ min: new Date(), max: new Date('2035-01-01') }),
    issuedBy: fc.constant('Government of Nepal'),
    licenseOffice: fc.string({ minLength: 3, maxLength: 50 }),
    address: fc.string({ minLength: 5, maxLength: 100 }),
    contactNumber: fc.stringMatching(/^[0-9]{10}$/),
  });

/** Face confidence score */
export const faceConfidenceGenerator = () =>
  fc.float({ min: 0, max: 100, noNaN: true });

/** Face detection result */
export const faceDetectionGenerator = () =>
  fc.record({
    hasFace: fc.boolean(),
    confidence: faceConfidenceGenerator(),
    isIdentityMatch: fc.boolean(),
    identityConfidence: faceConfidenceGenerator(),
    message: fc.string({ minLength: 5, maxLength: 100 }),
    verifiedAt: fc.date().map(d => d.toISOString()),
  });

/** OCR data generator */
export const ocrDataGenerator = () =>
  fc.record({
    frontImage: fc.record({
      licenseNumber: fc.option(fc.stringMatching(/^[A-Za-z0-9]{5,15}$/), { nil: undefined }),
      fullName: fc.option(fc.string({ minLength: 2, maxLength: 60 }), { nil: undefined }),
      dateOfBirth: fc.option(fc.string({ minLength: 8, maxLength: 12 }), { nil: undefined }),
      rawText: fc.string({ minLength: 0, maxLength: 500 }),
      confidence: fc.float({ min: 0, max: 100, noNaN: true }),
    }),
    overallConfidence: fc.float({ min: 0, max: 100, noNaN: true }),
    fieldConfidence: fc.record({
      licenseNumber: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: undefined }),
      fullName: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: undefined }),
      dateOfBirth: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: undefined }),
    }),
    extractedAt: fc.date().map(d => d.toISOString()),
    qualityCheck: fc.record({
      isGoodQuality: fc.boolean(),
      issues: fc.array(fc.string({ minLength: 3, maxLength: 50 }), { maxLength: 5 }),
    }),
  });

/** Image file mock */
export const imageMockGenerator = (fieldName = 'image') =>
  fc.record({
    fieldname: fc.constant(fieldName),
    originalname: fc.string({ minLength: 3, maxLength: 30 }).map((s: string) => `${s}.jpg`),
    mimetype: fc.constantFrom('image/jpeg', 'image/png'),
    size: fc.integer({ min: 1000, max: 5 * 1024 * 1024 }),
    filename: fc.string({ minLength: 16, maxLength: 32 }).filter(s => /^[0-9a-fA-F]+$/.test(s)).map((s: string) => `${s}.jpg`),
    path: fc.string({ minLength: 16, maxLength: 32 }).filter(s => /^[0-9a-fA-F]+$/.test(s)).map((s: string) => `uploads/${s}.jpg`),
  });

/** Rejection timestamp (within or beyond 24-hour window) */
export const rejectionTimestampGenerator = (withinWindow: boolean) => {
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  return withinWindow
    ? fc.integer({ min: 1, max: windowMs - 1 }).map(ms => new Date(now - ms))
    : fc.integer({ min: windowMs + 1, max: windowMs * 7 }).map(ms => new Date(now - ms));
};
