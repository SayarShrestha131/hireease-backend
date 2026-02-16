/**
 * Script to make a user an admin
 * Usage: ts-node scripts/makeAdmin.ts <email>
 */

import mongoose from 'mongoose';
import User from '../src/models/User';
import dotenv from 'dotenv';

dotenv.config();

const makeAdmin = async (email: string) => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('✓ Connected to MongoDB');

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      console.error(`❌ User with email "${email}" not found`);
      process.exit(1);
    }

    // Update role to admin
    user.role = 'admin';
    await user.save();

    console.log(`✓ User "${email}" is now an admin!`);
    console.log(`  User ID: ${user._id}`);
    console.log(`  Username: ${user.username || 'N/A'}`);
    console.log(`  Role: ${user.role}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

// Get email from command line arguments
const email = process.argv[2];

if (!email) {
  console.error('❌ Please provide an email address');
  console.log('Usage: ts-node scripts/makeAdmin.ts <email>');
  process.exit(1);
}

makeAdmin(email);
