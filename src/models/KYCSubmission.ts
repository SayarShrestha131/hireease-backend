import mongoose, { Document, Schema } from 'mongoose';

// IKYCSubmission interface defining the structure of a KYC submission document
export interface IKYCSubmission extends Document {
  userId: mongoose.Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  
  // License Information (User Entered)
  licenseNumber: string;
  fullName: string;
  dateOfBirth: Date;
  licenseExpiryDate: Date;
  
  // OCR Extracted Data (from license images)
  ocrData?: {
    frontImage: {
      licenseNumber?: string;
      fullName?: string;
      dateOfBirth?: string;
      expiryDate?: string;
      address?: string;
      rawText: string;
      confidence: number;
    };
    backImage: {
      address?: string;
      additionalInfo?: string;
      rawText: string;
      confidence: number;
    };
    extractedAt: Date;
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
    message: string;
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
    dateOfBirth: {
      type: Date,
      required: true,
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
      type: {
        frontImage: {
          licenseNumber: String,
          fullName: String,
          dateOfBirth: String,
          expiryDate: String,
          address: String,
          rawText: String,
          confidence: Number,
        },
        backImage: {
          address: String,
          additionalInfo: String,
          rawText: String,
          confidence: Number,
        },
        extractedAt: Date,
      },
      required: false,
    },
    faceDetection: {
      type: {
        hasFace: Boolean,
        faceCount: Number,
        confidence: Number,
        isRealFace: Boolean,
        message: String,
        verifiedAt: Date,
      },
      required: false,
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
      transform: function (doc, ret: any) {
        // Add virtual fields for image URLs
        ret.licenseFrontImageUrl = `/api/kyc/admin/image/${ret.licenseFrontImage}`;
        ret.licenseBackImageUrl = `/api/kyc/admin/image/${ret.licenseBackImage}`;
        return ret;
      },
    },
  }
);

// Compound index for efficient user status lookup
kycSubmissionSchema.index({ userId: 1, status: 1 });

// Create and export the KYCSubmission model
const KYCSubmission = mongoose.model<IKYCSubmission>('KYCSubmission', kycSubmissionSchema);

export default KYCSubmission;
