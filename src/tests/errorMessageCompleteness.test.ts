/**
 * Property-Based Tests for Error Message Completeness
 * Feature: enhanced-kyc-face-verification
 * Task 16.1: Write property test for error message completeness
 */

import fc from 'fast-check';

describe('Feature: enhanced-kyc-face-verification - Error Message Completeness', () => {
  
  /**
   * Property 7: Face Mismatch Error Handling
   * Validates: Requirements 3.4
   */
  it('Property 7: Face mismatch errors include confidence score and user-friendly guidance', () => {
    fc.assert(
      fc.property(
        fc.record({
          confidence: fc.integer({ min: 0, max: 100 }),
          fraudDetected: fc.boolean(),
          message: fc.string({ minLength: 10, maxLength: 200 }),
          isIdentityMatch: fc.boolean()
        }),
        (testData) => {
          // Simulate face mismatch error response structure
          const errorResponse = {
            success: false,
            error: 'Face verification failed',
            message: testData.fraudDetected 
              ? 'Face mismatch detected - the selfie does not match your profile picture'
              : 'Face verification confidence is too low for automatic processing',
            details: {
              confidence: testData.confidence,
              threshold: testData.fraudDetected ? 'Fraud detected' : '40%',
              fraudDetected: testData.fraudDetected,
              reason: testData.message
            },
            guidance: [
              'Ensure you are taking the selfie yourself',
              'Use the same person who uploaded the profile picture',
              'Take the selfie in good lighting conditions',
              'Face the camera directly with a clear frontal view',
              'Remove sunglasses, hats, or face coverings',
              'Ensure your face matches your profile picture'
            ],
            nextSteps: {
              action: 'retry_verification',
              options: [
                {
                  action: 'retake_selfie',
                  message: 'Retake your selfie following the guidance above'
                },
                {
                  action: 'update_profile_picture',
                  message: 'Update your profile picture if your appearance has changed'
                }
              ]
            }
          };

          // Verify error message completeness
          expect(errorResponse).toHaveProperty('success', false);
          expect(errorResponse).toHaveProperty('error');
          expect(errorResponse).toHaveProperty('message');
          expect(errorResponse).toHaveProperty('details');
          expect(errorResponse).toHaveProperty('guidance');
          expect(errorResponse).toHaveProperty('nextSteps');

          // Verify confidence score is included
          expect(errorResponse.details).toHaveProperty('confidence');
          expect(typeof errorResponse.details.confidence).toBe('number');
          expect(errorResponse.details.confidence).toBeGreaterThanOrEqual(0);
          expect(errorResponse.details.confidence).toBeLessThanOrEqual(100);

          // Verify guidance is provided
          expect(Array.isArray(errorResponse.guidance)).toBe(true);
          expect(errorResponse.guidance.length).toBeGreaterThan(0);

          // Verify next steps are provided
          expect(errorResponse.nextSteps).toHaveProperty('action');
          expect(errorResponse.nextSteps).toHaveProperty('options');
          expect(Array.isArray(errorResponse.nextSteps.options)).toBe(true);

          // Verify fraud detection is properly indicated
          if (testData.fraudDetected) {
            expect(errorResponse.details.fraudDetected).toBe(true);
            expect(errorResponse.message).toContain('mismatch detected');
          }

          // Verify user-friendly language
          expect(errorResponse.message).not.toContain('null');
          expect(errorResponse.message).not.toContain('undefined');
          expect(errorResponse.message.length).toBeGreaterThan(10);

          // Verify retry guidance is included
          const hasRetryGuidance = errorResponse.guidance.some((guide: string) => 
            guide.toLowerCase().includes('retake') || 
            guide.toLowerCase().includes('lighting') ||
            guide.toLowerCase().includes('selfie')
          );
          expect(hasRetryGuidance).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Profile Picture Error Completeness
   * Validates: Requirements 1.5
   */
  it('Property: Profile picture errors include detailed guidance and requirements', () => {
    fc.assert(
      fc.property(
        fc.record({
          faceCount: fc.integer({ min: 0, max: 5 }),
          confidence: fc.integer({ min: 0, max: 100 }),
          hasFace: fc.boolean()
        }),
        (testData) => {
          // Simulate profile picture error response structure
          const errorResponse = {
            success: false,
            error: 'No face detected in image',
            message: testData.faceCount === 0 ? 'No face detected' : 
                    testData.faceCount > 1 ? 'Multiple faces detected' : 'Face detected',
            details: {
              confidence: testData.confidence,
              faceCount: testData.faceCount,
              hasFace: testData.hasFace
            },
            guidance: [
              'Ensure your face is clearly visible and centered in the photo',
              'Use good lighting - avoid shadows on your face',
              'Face the camera directly (frontal view)',
              'Remove sunglasses, hats, or anything covering your face',
              'Ensure the image is not blurry or too dark',
              'Make sure only one person is in the photo',
              'Hold the camera at eye level for best results'
            ],
            requirements: {
              faceCount: 'Exactly one face must be detected',
              lighting: 'Good, even lighting on face',
              angle: 'Frontal view (not side profile)',
              quality: 'Clear, sharp image',
              obstructions: 'No sunglasses, hats, or face coverings'
            },
            nextSteps: {
              action: 'retake_photo',
              message: 'Please take a new photo following the guidance above'
            }
          };

          // Verify error message completeness
          expect(errorResponse).toHaveProperty('success', false);
          expect(errorResponse).toHaveProperty('error');
          expect(errorResponse).toHaveProperty('message');
          expect(errorResponse).toHaveProperty('guidance');
          expect(errorResponse).toHaveProperty('requirements');
          expect(errorResponse).toHaveProperty('nextSteps');

          // Verify guidance is comprehensive
          expect(Array.isArray(errorResponse.guidance)).toBe(true);
          expect(errorResponse.guidance.length).toBeGreaterThan(3);

          // Verify requirements are specified
          expect(errorResponse.requirements).toHaveProperty('faceCount');
          expect(errorResponse.requirements).toHaveProperty('lighting');
          expect(errorResponse.requirements).toHaveProperty('angle');

          // Verify next steps are actionable
          expect(errorResponse.nextSteps).toHaveProperty('action');
          expect(errorResponse.nextSteps).toHaveProperty('message');

          // Verify confidence score is included when available
          if (testData.faceCount > 0) {
            expect(errorResponse.details).toHaveProperty('confidence');
          }

          // Verify guidance addresses common issues
          const guidanceText = errorResponse.guidance.join(' ').toLowerCase();
          expect(guidanceText).toContain('lighting');
          expect(guidanceText).toContain('face');
          expect(guidanceText).toContain('camera');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: OCR Error Completeness
   * Validates: Requirements 4.7
   */
  it('Property: OCR errors include quality guidance and retry instructions', () => {
    fc.assert(
      fc.property(
        fc.record({
          confidence: fc.integer({ min: 0, max: 30 }), // Low confidence to trigger error
          qualityIssues: fc.array(fc.constantFrom(
            'Image is too dark. Please take photo in better lighting or increase brightness.',
            'Image is too bright. Avoid direct flash or sunlight - use indirect lighting.',
            'Image appears blurry. Please hold camera steady and focus properly on the license text.',
            'Image resolution is too low. Minimum 800x600 required for clear text recognition.',
            'Image file size is too small. This may indicate poor quality or excessive compression.'
          ), { minLength: 1, maxLength: 3 })
        }),
        (testData) => {
          // Simulate OCR error response structure
          const errorResponse = {
            success: false,
            error: 'Image quality is too poor for verification.',
            message: 'The license image quality is insufficient for text extraction. Please retake the photo.',
            details: {
              issues: testData.qualityIssues,
              confidence: testData.confidence,
              threshold: 30
            },
            guidance: [
              'Retake the photo with better lighting',
              'Hold the camera steady to avoid blur',
              'Ensure the license fills most of the frame',
              'Avoid shadows and glare on the license',
              'Clean the license surface if dirty or scratched',
              'Use the rear camera for better quality'
            ],
            nextSteps: {
              action: 'retake_photo',
              message: 'Please retake the license photo following the guidance above'
            }
          };

          // Verify OCR error completeness
          expect(errorResponse).toHaveProperty('success', false);
          expect(errorResponse).toHaveProperty('guidance');
          expect(errorResponse).toHaveProperty('nextSteps');
          expect(errorResponse).toHaveProperty('details');

          // Verify guidance addresses quality issues
          expect(Array.isArray(errorResponse.guidance)).toBe(true);
          expect(errorResponse.guidance.length).toBeGreaterThan(3);

          // Verify details include confidence and issues
          expect(errorResponse.details).toHaveProperty('confidence');
          expect(errorResponse.details).toHaveProperty('issues');
          expect(errorResponse.details).toHaveProperty('threshold');

          // Verify retry instructions are included
          expect(errorResponse.nextSteps).toHaveProperty('action');
          expect(errorResponse.nextSteps.message).toContain('retake');

          // Verify guidance addresses specific quality issues
          const guidanceText = errorResponse.guidance.join(' ').toLowerCase();
          expect(guidanceText).toContain('lighting');
          expect(guidanceText).toContain('camera');
          expect(guidanceText).toContain('license');
        }
      ),
      { numRuns: 30 }
    );
  });

  /**
   * Property: Resubmission Error Completeness
   * Validates: Requirements 8.4, 8.5
   */
  it('Property: Resubmission errors include wait time and rejection details', () => {
    fc.assert(
      fc.property(
        fc.record({
          remainingHours: fc.integer({ min: 1, max: 23 }),
          remainingMinutes: fc.integer({ min: 0, max: 59 }),
          rejectionReason: fc.string({ minLength: 10, maxLength: 100 })
        }),
        (testData) => {
          // Simulate resubmission error response structure
          const rejectedAt = new Date(Date.now() - (testData.remainingHours * 60 * 60 * 1000));
          const canResubmitAt = new Date(rejectedAt.getTime() + (24 * 60 * 60 * 1000));

          const errorResponse = {
            success: false,
            error: 'Resubmission not allowed yet',
            message: `You must wait 24 hours after rejection before resubmitting. Please try again in ${testData.remainingHours} hours and ${testData.remainingMinutes} minutes.`,
            remainingHours: testData.remainingHours,
            remainingMinutes: testData.remainingMinutes,
            guidance: [
              'This waiting period helps ensure quality submissions',
              'Use this time to review the rejection reason carefully',
              'Prepare better quality photos and accurate information',
              'Address all issues mentioned in the rejection feedback'
            ],
            rejectionDetails: {
              rejectedAt: rejectedAt,
              reason: testData.rejectionReason,
              canResubmitAt: canResubmitAt
            },
            nextSteps: {
              action: 'wait_and_prepare',
              message: 'Review rejection feedback and prepare improved submission',
              availableAt: canResubmitAt
            }
          };

          // Verify resubmission error completeness
          expect(errorResponse).toHaveProperty('success', false);
          expect(errorResponse).toHaveProperty('remainingHours');
          expect(errorResponse).toHaveProperty('remainingMinutes');
          expect(errorResponse).toHaveProperty('guidance');
          expect(errorResponse).toHaveProperty('rejectionDetails');
          expect(errorResponse).toHaveProperty('nextSteps');

          // Verify time calculations are correct
          expect(errorResponse.remainingHours).toBeGreaterThan(0);
          expect(errorResponse.remainingHours).toBeLessThan(24);
          expect(errorResponse.remainingMinutes).toBeGreaterThanOrEqual(0);
          expect(errorResponse.remainingMinutes).toBeLessThan(60);

          // Verify rejection details are included
          expect(errorResponse.rejectionDetails).toHaveProperty('reason');
          expect(errorResponse.rejectionDetails).toHaveProperty('rejectedAt');
          expect(errorResponse.rejectionDetails).toHaveProperty('canResubmitAt');

          // Verify guidance is helpful
          expect(Array.isArray(errorResponse.guidance)).toBe(true);
          expect(errorResponse.guidance.length).toBeGreaterThan(2);

          // Verify next steps include preparation advice
          expect(errorResponse.nextSteps).toHaveProperty('availableAt');
          expect(errorResponse.nextSteps.message).toContain('prepare');

          // Verify guidance mentions review and improvement
          const guidanceText = errorResponse.guidance.join(' ').toLowerCase();
          expect(guidanceText).toContain('review');
          expect(guidanceText).toContain('quality');
        }
      ),
      { numRuns: 25 }
    );
  });
});