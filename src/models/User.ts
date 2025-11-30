import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// IUser interface defining the structure of a User document
export interface IUser extends Document {
  email: string;
  password: string;
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
      transform: function (doc, ret) {
        delete ret.password;
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
