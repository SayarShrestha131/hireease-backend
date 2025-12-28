import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Contact Information interface
export interface IContactInfo {
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
}

// Emergency Contact interface
export interface IEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

// Notification Preferences interface
export interface INotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  bookingUpdates: boolean;
  promotions: boolean;
  reminders: boolean;
}

// Document interface
export interface IDocument {
  type: string; // 'license', 'id', 'insurance', etc.
  url: string;
  uploadedAt: Date;
  verified: boolean;
}

// IUser interface defining the structure of a User document
export interface IUser extends Document {
  email: string;
  password: string;
  role: 'user' | 'admin';
  username?: string;
  dateOfBirth?: Date;
  contactInfo?: IContactInfo;
  emergencyContacts?: IEmergencyContact[];
  notificationPreferences?: INotificationPreferences;
  documents?: IDocument[];
  isEmailVerified: boolean;
  emailVerificationCode?: string;
  emailVerificationExpires?: Date;
  resetPasswordCode?: string;
  resetPasswordExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateResetCode(): string;
  generateEmailVerificationCode(): string;
}

// User schema definition
const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    username: {
      type: String,
      required: false,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
      required: false,
    },
    contactInfo: {
      phone: { type: String, required: false },
      address: { type: String, required: false },
      city: { type: String, required: false },
      country: { type: String, required: false },
      postalCode: { type: String, required: false },
    },
    emergencyContacts: [
      {
        name: { type: String, required: true },
        relationship: { type: String, required: true },
        phone: { type: String, required: true },
      },
    ],
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      push: { type: Boolean, default: true },
      bookingUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      reminders: { type: Boolean, default: true },
    },
    documents: [
      {
        type: { type: String, required: true },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false },
      },
    ],
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationCode: {
      type: String,
      required: false,
    },
    emailVerificationExpires: {
      type: Date,
      required: false,
    },
    resetPasswordCode: {
      type: String,
      required: false,
    },
    resetPasswordExpires: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret: any) {
        delete ret.password;
        delete ret.emailVerificationCode;
        delete ret.resetPasswordCode;
        return ret;
      },
    },
  }
);

// Pre-save hook to hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    // Generate salt and hash password with 10 rounds
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate email verification code (6-digit)
userSchema.methods.generateEmailVerificationCode = function (): string {
  // Generate random 6-digit code
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash the code and store it in the database
  this.emailVerificationCode = crypto
    .createHash('sha256')
    .update(verificationCode)
    .digest('hex');

  // Set expiration to 30 minutes from now
  this.emailVerificationExpires = new Date(Date.now() + 30 * 60 * 1000);

  // Return the unhashed code to send via email
  return verificationCode;
};

// Instance method to generate password reset code (6-digit)
userSchema.methods.generateResetCode = function (): string {
  // Generate random 6-digit code
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash the code and store it in the database
  this.resetPasswordCode = crypto
    .createHash('sha256')
    .update(resetCode)
    .digest('hex');

  // Set expiration to 15 minutes from now (codes expire faster than tokens)
  this.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);

  // Return the unhashed code to send via email
  return resetCode;
};

// Create and export the User model
const User = mongoose.model<IUser>('User', userSchema);

export default User;
