/**
 * Script to add authorized user to RegisteredPerson table
 * Run with: npx ts-node scripts/addAuthorizedUser.ts
 */

import mongoose from 'mongoose';
import RegisteredPerson from '../src/models/RegisteredPerson';
import path from 'path';
import fs from 'fs';

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/vehicle-rental');
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

const addAuthorizedUser = async () => {
  try {
    await connectDB();

    // Check if reference image exists
    const referenceImagePath = path.join(__dirname, '../reference_images/sayar_shrestha.jpg');
    if (!fs.existsSync(referenceImagePath)) {
      console.error('❌ Reference image not found:', referenceImagePath);
      console.log('Please ensure sayar_shrestha.jpg exists in backend/reference_images/');
      process.exit(1);
    }

    // Check if user already exists
    const existingUser = await RegisteredPerson.findOne({
      licenseNumber: '04-06-01018658'
    });

    if (existingUser) {
      console.log('⚠️  User already exists in database:', existingUser.fullName);
      console.log('Updating existing record...');
      
      // Update existing record
      existingUser.fullName = 'Sayar Shrestha';
      existingUser.email = 'sayarstha3@gmail.com';
      existingUser.phone = '9841234567';
      existingUser.address = 'Kathmandu, Nepal';
      existingUser.dateOfBirth = new Date('2002-11-20');
      existingUser.photoPath = 'sayar_shrestha.jpg';
      existingUser.isActive = true;
      existingUser.notes = 'Authorized user for automated KYC - Updated by script';
      
      await existingUser.save();
      console.log('✅ Updated existing user:', existingUser.fullName);
    } else {
      // Create new user
      const newUser = new RegisteredPerson({
        fullName: 'Sayar Shrestha',
        licenseNumber: '04-06-01018658',
        email: 'sayarstha3@gmail.com',
        phone: '9841234567',
        address: 'Kathmandu, Nepal',
        dateOfBirth: new Date('2002-11-20'),
        photoPath: 'sayar_shrestha.jpg',
        isActive: true,
        notes: 'Authorized user for automated KYC - Added by script'
      });

      await newUser.save();
      console.log('✅ Added new authorized user:', newUser.fullName);
    }

    // Copy reference image to registered-persons directory
    const uploadsDir = path.join(__dirname, '../uploads/registered-persons');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('✅ Created uploads directory:', uploadsDir);
    }

    const targetImagePath = path.join(uploadsDir, 'sayar_shrestha.jpg');
    if (!fs.existsSync(targetImagePath)) {
      fs.copyFileSync(referenceImagePath, targetImagePath);
      console.log('✅ Copied reference image to uploads directory');
    } else {
      console.log('📁 Reference image already exists in uploads directory');
    }

    console.log('\n🎯 User Details Added:');
    console.log('  Name: Sayar Shrestha');
    console.log('  License: 04-06-01018658');
    console.log('  Email: sayarstha3@gmail.com');
    console.log('  DOB: 2002-11-20');
    console.log('  Phone: 9841234567');
    console.log('  Address: Kathmandu, Nepal');
    console.log('  Photo: sayar_shrestha.jpg');

    console.log('\n✨ Authorized user successfully added to RegisteredPerson table!');
    console.log('The automated KYC system will now check against the database.');

  } catch (error) {
    console.error('❌ Error adding authorized user:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

// Run the script
addAuthorizedUser();