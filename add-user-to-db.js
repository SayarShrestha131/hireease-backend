/**
 * Simple script to add user to RegisteredPerson database
 * Run with: node add-user-to-db.js
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// RegisteredPerson Schema (simplified)
const RegisteredPersonSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  licenseNumber: { type: String, required: true, unique: true, trim: true, uppercase: true },
  email: { type: String, trim: true, lowercase: true },
  phone: { type: String, trim: true },
  address: { type: String, trim: true },
  photoPath: { type: String, required: true },
  dateOfBirth: { type: Date },
  registeredAt: { type: Date, default: Date.now },
  lastVerifiedAt: { type: Date },
  verificationCount: { type: Number, default: 0 },
  failedVerificationCount: { type: Number, default: 0 },
  lockoutUntil: { type: Date },
  isActive: { type: Boolean, default: true },
  notes: { type: String }
}, { timestamps: true });

const RegisteredPerson = mongoose.model('RegisteredPerson', RegisteredPersonSchema);

async function addUserToDatabase() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if reference image exists
    const referenceImagePath = path.join(__dirname, 'reference_images/sayar_shrestha.jpg');
    if (!fs.existsSync(referenceImagePath)) {
      console.error('❌ Reference image not found:', referenceImagePath);
      process.exit(1);
    }
    console.log('✅ Reference image found');

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(__dirname, 'uploads/registered-persons');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('✅ Created uploads directory');
    }

    // Copy reference image to uploads directory
    const targetImagePath = path.join(uploadsDir, 'sayar_shrestha.jpg');
    if (!fs.existsSync(targetImagePath)) {
      fs.copyFileSync(referenceImagePath, targetImagePath);
      console.log('✅ Copied reference image to uploads directory');
    }

    // Check if user already exists
    const existingUser = await RegisteredPerson.findOne({
      licenseNumber: '04-06-01018658'
    });

    if (existingUser) {
      console.log('⚠️  User already exists. Updating...');
      
      // Update existing user
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
      console.log('✅ Added new user:', newUser.fullName);
    }

    // Verify the user was added
    const verifyUser = await RegisteredPerson.findOne({
      licenseNumber: '04-06-01018658'
    });

    if (verifyUser) {
      console.log('\n🎯 User Successfully Added to Database:');
      console.log('  ID:', verifyUser._id);
      console.log('  Name:', verifyUser.fullName);
      console.log('  License:', verifyUser.licenseNumber);
      console.log('  Email:', verifyUser.email);
      console.log('  Phone:', verifyUser.phone);
      console.log('  DOB:', verifyUser.dateOfBirth.toISOString().split('T')[0]);
      console.log('  Address:', verifyUser.address);
      console.log('  Photo:', verifyUser.photoPath);
      console.log('  Active:', verifyUser.isActive);
      console.log('  Created:', verifyUser.registeredAt);
    }

    console.log('\n✨ Database setup complete!');
    console.log('\n🚀 Next Steps:');
    console.log('1. Restart your backend server');
    console.log('2. Test KYC submission with your details');
    console.log('3. System should auto-approve instantly!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    if (error.code === 11000) {
      console.log('⚠️  Duplicate key error - user might already exist');
      console.log('Try checking your database manually or delete existing record first');
    }
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
addUserToDatabase();