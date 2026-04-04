import mongoose, { Document, Schema } from 'mongoose';

export type VerificationResultCode = 'VERIFIED' | 'UNCERTAIN' | 'REJECTED' | 'ERROR';

export interface IVerificationAttempt extends Document {
  userId: string;
  timestamp: Date;
  distance?: number;
  result: VerificationResultCode;
}

const VerificationAttemptSchema = new Schema<IVerificationAttempt>(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    distance: {
      type: Number,
    },
    result: {
      type: String,
      enum: ['VERIFIED', 'UNCERTAIN', 'REJECTED', 'ERROR'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IVerificationAttempt>('VerificationAttempt', VerificationAttemptSchema);
