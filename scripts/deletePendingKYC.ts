/**
 * Script to delete a pending KYC submission
 * Usage: npx ts-node scripts/deletePendingKYC.ts <submissionId>
 * Or: npx ts-node scripts/deletePendingKYC.ts <userEmail>
 */

import mongoose from 'mongoose';
import KYCSubmission from '../src/models/KYCSubmission';
import User from '../src/models/User';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();

const deletePendingKYC = async (identifier: string) => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✓ Connected to MongoDB');

    let submission;

    // Check if identifier is an email or submission ID
    if (identifier.includes('@')) {
      // It's an email - find user first
      const user = await User.findOne({ email: identifier });
      
      if (!user) {
        console.error(`❌ User with email "${identifier}" not found`);
        process.exit(1);
      }

      // Find pending submission for this user
      submission = await KYCSubmission.findOne({ 
        userId: user._id,
        status: 'pending'
      });

      if (!submission) {
        console.log(`ℹ️  No pending KYC submission found for user "${identifier}"`);
        
        // Check if there are any submissions at all
        const anySubmission = await KYCSubmission.findOne({ userId: user._id }).sort({ submittedAt: -1 });
        if (anySubmission) {
          console.log(`   Latest submission status: ${anySubmission.status}`);
          console.log(`   Submitted at: ${anySubmission.submittedAt}`);
        }
        
        process.exit(0);
      }
    } else {
      // It's a submission ID
      submission = await KYCSubmission.findById(identifier);
      
      if (!submission) {
        console.error(`❌ KYC submission with ID "${identifier}" not found`);
        process.exit(1);
      }

      if (submission.status !== 'pending') {
        console.error(`❌ Cannot delete submission with status "${submission.status}"`);
        console.log(`   Only pending submissions can be deleted`);
        process.exit(1);
      }
    }

    // Delete associated images
    const uploadsDir = path.join(__dirname, '../uploads/kyc');
    
    if (submission.licenseFrontImage) {
      const frontPath = path.join(uploadsDir, submission.licenseFrontImage);
      if (fs.existsSync(frontPath)) {
        fs.unlinkSync(frontPath);
        console.log(`✓ Deleted front image: ${submission.licenseFrontImage}`);
      }
    }

    if (submission.licenseBackImage) {
      const backPath = path.join(uploadsDir, submission.licenseBackImage);
      if (fs.existsSync(backPath)) {
        fs.unlinkSync(backPath);
        console.log(`✓ Deleted back image: ${submission.licenseBackImage}`);
      }
    }

    if (submission.selfieImage) {
      const selfiePath = path.join(uploadsDir, submission.selfieImage);
      if (fs.existsSync(selfiePath)) {
        fs.unlinkSync(selfiePath);
        console.log(`✓ Deleted selfie image: ${submission.selfieImage}`);
      }
    }

    // Delete the submission
    await KYCSubmission.findByIdAndDelete(submission._id);

    console.log('');
    console.log('✅ Pending KYC submission deleted successfully!');
    console.log('-----------------------------------');
    console.log(`Submission ID: ${submission._id}`);
    console.log(`License Number: ${submission.licenseNumber}`);
    console.log(`Full Name: ${submission.fullName}`);
    console.log(`Submitted at: ${submission.submittedAt}`);
    console.log('-----------------------------------');
    console.log('You can now submit a new KYC application');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

// Get identifier from command line arguments
const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Please provide a submission ID or user email');
  console.log('');
  console.log('Usage:');
  console.log('  npx ts-node scripts/deletePendingKYC.ts <submissionId>');
  console.log('  npx ts-node scripts/deletePendingKYC.ts <userEmail>');
  console.log('');
  console.log('Examples:');
  console.log('  npx ts-node scripts/deletePendingKYC.ts 69bf6493f67e33839ce3b19b');
  console.log('  npx ts-node scripts/deletePendingKYC.ts user@example.com');
  process.exit(1);
}

deletePendingKYC(identifier);
