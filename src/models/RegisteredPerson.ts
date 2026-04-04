/**
 * Registered Person Model
 * Stores people's data for face recognition verification
 */

import mongoose, { Document, Schema } from 'mongoose';

export interface IRegisteredPerson extends Document {
  fullName: string;
  licenseNumber: string;
  email?: string;
  phone?: string;
  address?: string;
  photoPath: string; // Path to stored photo
  dateOfBirth?: Date;
  registeredAt: Date;
  lastVerifiedAt?: Date;
  verificationCount: number;
  failedVerificationCount: number;
  lockoutUntil?: Date;
  isActive: boolean;
  notes?: string;
}

const RegisteredPersonSchema = new Schema<IRegisteredPerson>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    photoPath: {
      type: String,
      required: true,
    },
    dateOfBirth: {
      type: Date,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    lastVerifiedAt: {
      type: Date,
    },
    verificationCount: {
      type: Number,
      default: 0,
    },
    failedVerificationCount: {
      type: Number,
      default: 0,
    },
    lockoutUntil: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster searches
RegisteredPersonSchema.index({ licenseNumber: 1 });
RegisteredPersonSchema.index({ fullName: 'text' });

export default mongoose.model<IRegisteredPerson>('RegisteredPerson', RegisteredPersonSchema);
