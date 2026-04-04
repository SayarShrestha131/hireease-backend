import mongoose, { Document, Schema } from 'mongoose';

// IKYCSubmission interface defining the structure of a KYC submission document
export interface IKYCSubmission extends Document {
  userId: mongoose.Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  
  // License Information (User Entered)
  licenseNumber: string;
  fullName: string;
  fatherName: string; // Now required - F/H Name from license
  dateOfBirth: Date;
  licenseExpiryDate: Date;
  licenseIssueDate?: Date;
  issuedBy: string; // Required - e.g., "Government of Nepal"
  licenseOffice: string; // Required - e.g., "Kathmandu Transport Office"
  fullAddress: string; // Required - complete address
  contactNumber: string; // Required - phone number
  citizenshipNumber?: string;
  licenseType?: string; // e.g., 'A', 'B', 'C', 'A+B'
  
  // OCR Extracted Data (from license images)
  ocrData?: {
    frontImage: {
      licenseNumber?: string;
      fullName?: string;
      fatherName?: string;
      dateOfBirth?: string;
      expiryDate?: string;
      issueDate?: string;
      issuingAuthority?: string;
      address?: string;
      citizenshipNumber?: string;
      licenseType?: string;
      rawText: string;
      confidence: number;
      fieldConfidence?: {
        licenseNumber?: number;
        fullName?: number;
        fatherName?: number;
        dateOfBirth?: number;
        expiryDate?: number;
        issueDate?: number;
        issuingAuthority?: number;
        address?: number;
        citizenshipNumber?: number;
        licenseType?: number;
        contactNumber?: number;
        bloodGroup?: number;
      };
    };
    backImage?: {
      address?: string;
      additionalInfo?: string;
      rawText: string;
      confidence: number;
    };
    extractedAt: Date;
    overallConfidence?: number; // Average confidence from both images
    qualityCheck: {
      isGoodQuality: boolean;
      issues: string[];
      recommendation?: string;
    };
  };
  
  // Data Verification (comparison between user input and OCR)
  dataVerification?: {
    licenseNumberMatch: boolean;
    nameMatch: boolean;
    dobMatch: boolean;
    expiryDateMatch: boolean;
    matchScore: number; // Percentage of fields that match
    checkedAt: Date;
  };
  
  // Document Images (filenames stored in uploads/kyc/)
  licenseFrontImage: string;
  licenseBackImage?: string; // Now optional
  selfieImage: string; // Now required
  
  // Face Detection Results
  faceDetection?: {
    hasFace: boolean;
    faceCount?: number;
    confidence: number;
    isRealFace?: boolean;
    isIdentityMatch?: boolean;
    identityConfidence?: number;
    identityMessage?: string;
    message: string;
    verifiedAt: Date;
  };
  faceDecision?: {
    resultCode: 'VERIFIED' | 'UNCERTAIN' | 'REJECTED';
    matched: boolean;
    confidence: number;
    reason: string;
    reviewedSignal: 'auto-face-match' | 'manual-review-needed';
    verifiedAt: Date;
  };
  
  // Review Information
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  
  // Submission History
  submittedAt: Date;
  previousSubmissionId?: mongoose.Types.ObjectId;
  
  // Status History (for tracking status changes, especially revocations)
  statusHistory?: Array<{
    status: 'pending' | 'approved' | 'rejected';
    changedBy?: mongoose.Types.ObjectId;
    changedAt: Date;
    note?: string;
  }>;
  
  // Auto-approval flag (to distinguish auto vs manual approval)
  isAutoApproved?: boolean;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// KYC Submission schema definition
const kycSubmissionSchema = new Schema<IKYCSubmission>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },
    licenseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    fatherName: {
      type: String,
      required: true, // Now required
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: true,
    },
    fullAddress: {
      type: String,
      required: true, // Now required
      trim: true,
    },
    contactNumber: {
      type: String,
      required: true, // Now required
      trim: true,
    },
    licenseExpiryDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value: Date): boolean {
          return value > new Date();
        },
        message: 'License expiry date must be in the future',
      },
    },
    licenseIssueDate: {
      type: Date,
      required: false,
    },
    issuedBy: {
      type: String,
      required: true, // Now required - e.g., "Government of Nepal"
      trim: true,
    },
    licenseOffice: {
      type: String,
      required: true, // Now required - issuing office
      trim: true,
    },
    citizenshipNumber: {
      type: String,
      required: false,
      trim: true,
    },
    licenseType: {
      type: String,
      required: false,
      trim: true,
    },
    licenseFrontImage: {
      type: String,
      required: true,
    },
    licenseBackImage: {
      type: String,
      required: false, // Now optional
    },
    selfieImage: {
      type: String,
      required: true, // Now required
    },
    ocrData: {
      frontImage: {
        type: {
          licenseNumber: String,
          fullName: String,
          fatherName: String,
          dateOfBirth: String,
          expiryDate: String,
          issueDate: String,
          issuingAuthority: String,
          address: String,
          citizenshipNumber: String,
          licenseType: String,
          rawText: String,
          confidence: Number,
          fieldConfidence: {
            type: {
              licenseNumber: Number,
              fullName: Number,
              fatherName: Number,
              dateOfBirth: Number,
              expiryDate: Number,
              issueDate: Number,
              issuingAuthority: Number,
              address: Number,
              citizenshipNumber: Number,
              licenseType: Number,
              contactNumber: Number,
              bloodGroup: Number,
            },
            _id: false,
          },
        },
        _id: false,
      },
      backImage: {
        type: {
          address: String,
          additionalInfo: String,
          rawText: String,
          confidence: Number,
        },
        _id: false,
      },
      extractedAt: Date,
      overallConfidence: Number,
      qualityCheck: {
        type: {
          isGoodQuality: Boolean,
          issues: [String],
          recommendation: String,
        },
        _id: false,
      },
      _id: false,
    },
    dataVerification: {
      type: {
        licenseNumberMatch: Boolean,
        nameMatch: Boolean,
        dobMatch: Boolean,
        expiryDateMatch: Boolean,
        matchScore: Number,
        checkedAt: Date,
      },
      required: false,
      _id: false,
    },
    faceDetection: {
      type: {
        hasFace: Boolean,
        faceCount: Number,
        confidence: Number,
        isRealFace: Boolean,
        isIdentityMatch: Boolean,
        identityConfidence: Number,
        identityMessage: String,
        message: String,
        verifiedAt: Date,
      },
      required: false,
      _id: false,
    },
    faceDecision: {
      type: {
        resultCode: {
          type: String,
          enum: ['VERIFIED', 'UNCERTAIN', 'REJECTED'],
        },
        matched: Boolean,
        confidence: Number,
        reason: String,
        reviewedSignal: {
          type: String,
          enum: ['auto-face-match', 'manual-review-needed'],
        },
        verifiedAt: Date,
      },
      required: false,
      _id: false,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    reviewedAt: {
      type: Date,
      required: false,
    },
    reviewNote: {
      type: String,
      required: false,
      trim: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    previousSubmissionId: {
      type: Schema.Types.ObjectId,
      ref: 'KYCSubmission',
      required: false,
    },
    isAutoApproved: {
      type: Boolean,
      required: false,
      default: false,
    },
    statusHistory: {
      type: [
        {
          status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            required: true,
          },
          changedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: false,
          },
          changedAt: {
            type: Date,
            required: true,
          },
          note: {
            type: String,
            required: false,
          },
          _id: false,
        },
      ],
      required: false,
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: function (doc, ret: any) {
        // Add virtual fields for image URLs
        ret.licenseFrontImageUrl = `/api/kyc/admin/image/${ret.licenseFrontImage}`;
        ret.licenseBackImageUrl = `/api/kyc/admin/image/${ret.licenseBackImage}`;
        
        // Remove _id from nested objects to prevent serialization issues
        if (ret.ocrData) {
          delete ret.ocrData._id;
          delete ret.ocrData.id;
          if (ret.ocrData.frontImage) {
            delete ret.ocrData.frontImage._id;
            delete ret.ocrData.frontImage.id;
          }
          if (ret.ocrData.backImage) {
            delete ret.ocrData.backImage._id;
            delete ret.ocrData.backImage.id;
          }
          if (ret.ocrData.qualityCheck) {
            delete ret.ocrData.qualityCheck._id;
            delete ret.ocrData.qualityCheck.id;
          }
        }
        
        if (ret.dataVerification) {
          delete ret.dataVerification._id;
          delete ret.dataVerification.id;
        }
        
        if (ret.faceDetection) {
          delete ret.faceDetection._id;
          delete ret.faceDetection.id;
        }
        
        if (ret.faceDecision) {
          delete ret.faceDecision._id;
          delete ret.faceDecision.id;
        }
        
        if (ret.statusHistory && Array.isArray(ret.statusHistory)) {
          ret.statusHistory = ret.statusHistory.map((item: any) => {
            const { _id, id, ...rest } = item;
            return rest;
          });
        }
        
        return ret;
      },
    },
  }
);

// Compound index for efficient user status lookup
kycSubmissionSchema.index({ userId: 1, status: 1 });

// Pre-save middleware to enforce approved KYC immutability
kycSubmissionSchema.pre('save', async function (next) {
  // Only apply immutability check if this is an update (not a new document)
  if (!this.isNew) {
    // Get the original document from database
    const original = await KYCSubmission.findById(this._id);
    
    if (original && original.status === 'approved') {
      // Check if any user-entered fields are being modified
      const userFields = [
        'licenseNumber', 'fullName', 'fatherName', 'dateOfBirth', 
        'licenseExpiryDate', 'licenseIssueDate', 'issuedBy', 
        'licenseOffice', 'fullAddress', 'contactNumber', 
        'citizenshipNumber', 'licenseType', 'licenseFrontImage', 
        'licenseBackImage', 'selfieImage'
      ];
      
      const modifiedUserFields = userFields.filter(field => 
        this.isModified(field) && field !== 'updatedAt'
      );
      
      if (modifiedUserFields.length > 0) {
        const error = new Error(
          `Cannot modify approved KYC submission. Modified fields: ${modifiedUserFields.join(', ')}`
        );
        error.name = 'ValidationError';
        return next(error);
      }
      
      // Allow admin-only fields to be modified (for revocation, etc.)
      // These fields can still be updated: status, reviewedBy, reviewedAt, reviewNote, statusHistory
    }
  }
  
  next();
});

// Pre-update middleware to prevent direct updates to approved KYC submissions
kycSubmissionSchema.pre(['updateOne', 'findOneAndUpdate'], async function (next) {
  const update = this.getUpdate() as any;
  
  if (update && (update.$set || update.$unset || Object.keys(update).some(key => !key.startsWith('$')))) {
    // Find the document being updated
    const doc = await this.model.findOne(this.getQuery());
    
    if (doc && doc.status === 'approved') {
      // Check if any user-entered fields are being modified
      const userFields = [
        'licenseNumber', 'fullName', 'fatherName', 'dateOfBirth', 
        'licenseExpiryDate', 'licenseIssueDate', 'issuedBy', 
        'licenseOffice', 'fullAddress', 'contactNumber', 
        'citizenshipNumber', 'licenseType', 'licenseFrontImage', 
        'licenseBackImage', 'selfieImage'
      ];
      
      const updateFields = Object.keys(update.$set || update);
      const modifiedUserFields = updateFields.filter(field => 
        userFields.includes(field) && field !== 'updatedAt'
      );
      
      if (modifiedUserFields.length > 0) {
        const error = new Error(
          `Cannot modify approved KYC submission. Attempted to modify: ${modifiedUserFields.join(', ')}`
        );
        error.name = 'ValidationError';
        return next(error);
      }
    }
  }
  
  next();
});

// Create and export the KYCSubmission model
const KYCSubmission = mongoose.model<IKYCSubmission>('KYCSubmission', kycSubmissionSchema);

export default KYCSubmission;
