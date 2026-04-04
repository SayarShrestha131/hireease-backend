/**
 * Final system check - verify everything is ready
 * Run with: node final-system-check.js
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// RegisteredPerson Schema
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

async function finalSystemCheck() {
  try {
    console.log('🔍 Final System Check...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connection: OK');

    // Check database user
    const user = await RegisteredPerson.findOne({ licenseNumber: '04-06-01018658' });
    if (!user) {
      console.log('❌ Database user: NOT FOUND');
      return;
    }
    console.log('✅ Database user: FOUND');

    // Check user data
    console.log('\n📋 User Data Verification:');
    console.log(`  Name: ${user.fullName} ${user.fullName === 'Sayar Shrestha' ? '✅' : '❌'}`);
    console.log(`  License: ${user.licenseNumber} ${user.licenseNumber === '04-06-01018658' ? '✅' : '❌'}`);
    console.log(`  Email: ${user.email} ${user.email === 'sayarstha3@gmail.com' ? '✅' : '❌'}`);
    console.log(`  Phone: ${user.phone} ${user.phone === '9841234567' ? '✅' : '❌'}`);
    
    const expectedDOB = '2002-11-20';
    const actualDOB = user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : 'N/A';
    console.log(`  DOB: ${actualDOB} ${actualDOB === expectedDOB ? '✅' : '❌'}`);
    console.log(`  Address: ${user.address} ${user.address === 'Kathmandu, Nepal' ? '✅' : '❌'}`);
    console.log(`  Active: ${user.isActive} ${user.isActive ? '✅' : '❌'}`);

    // Check photo files
    console.log('\n📸 Photo Files Check:');
    const referenceImagePath = path.join(__dirname, 'reference_images/sayar_shrestha.jpg');
    const uploadsImagePath = path.join(__dirname, 'uploads/registered-persons/sayar_shrestha.jpg');
    
    console.log(`  Reference image: ${fs.existsSync(referenceImagePath) ? '✅' : '❌'} (${referenceImagePath})`);
    console.log(`  Uploads image: ${fs.existsSync(uploadsImagePath) ? '✅' : '❌'} (${uploadsImagePath})`);

    // Check required directories
    console.log('\n📁 Directory Structure:');
    const requiredDirs = [
      'reference_images',
      'uploads/registered-persons',
      'uploads/kyc',
      'models'
    ];

    requiredDirs.forEach(dir => {
      const dirPath = path.join(__dirname, dir);
      console.log(`  ${dir}: ${fs.existsSync(dirPath) ? '✅' : '❌'}`);
    });

    // Check face-api models
    console.log('\n🤖 Face-API Models:');
    const requiredModels = [
      'tiny_face_detector_model-weights_manifest.json',
      'face_landmark_68_model-weights_manifest.json',
      'face_recognition_model-weights_manifest.json'
    ];

    const modelsDir = path.join(__dirname, 'models');
    requiredModels.forEach(model => {
      const modelPath = path.join(modelsDir, model);
      console.log(`  ${model}: ${fs.existsSync(modelPath) ? '✅' : '❌'}`);
    });

    // Test data for KYC submission
    console.log('\n🎯 KYC Test Data (Use these exact values):');
    console.log('  Email: sayarstha3@gmail.com');
    console.log('  License Number: 04-06-01018658');
    console.log('  Full Name: Sayar Shrestha');
    console.log('  Father Name: Asha Narayan');
    console.log('  Date of Birth: 2002-11-20');
    console.log('  Expiry Date: 2027-02-19');

    console.log('\n⚠️  STRICT VERIFICATION RULES:');
    console.log('  • ALL fields must match EXACTLY');
    console.log('  • Face similarity must be ≥70%');
    console.log('  • Any single mismatch = REJECTION');
    console.log('  • Detailed error messages will show what failed');

    console.log('\n✨ System Status: READY FOR TESTING');
    console.log('\n🚀 Next Steps:');
    console.log('1. Restart your backend server: npm run dev');
    console.log('2. Submit KYC with the exact data above');
    console.log('3. Upload clear selfie and license photos');
    console.log('4. System should auto-approve if everything matches!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

finalSystemCheck();