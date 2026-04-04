/**
 * Final verification before testing KYC
 * Run with: node restart-and-test.js
 */

const mongoose = require('mongoose');
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

async function finalVerification() {
  try {
    console.log('🔍 Final Verification Before KYC Testing...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connection: OK');

    // Get user data
    const user = await RegisteredPerson.findOne({ licenseNumber: '04-06-01018658' });
    if (!user) {
      console.log('❌ User not found in database');
      return;
    }

    // Extract date properly (avoiding timezone issues)
    const year = user.dateOfBirth.getFullYear();
    const month = String(user.dateOfBirth.getMonth() + 1).padStart(2, '0');
    const day = String(user.dateOfBirth.getDate()).padStart(2, '0');
    const formattedDOB = `${year}-${month}-${day}`;

    console.log('📋 Database User Data (Ready for KYC):');
    console.log(`  Name: ${user.fullName}`);
    console.log(`  License: ${user.licenseNumber}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Phone: ${user.phone}`);
    console.log(`  DOB (raw): ${user.dateOfBirth}`);
    console.log(`  DOB (formatted): ${formattedDOB}`);
    console.log(`  Address: ${user.address}`);
    console.log(`  Photo: ${user.photoPath}`);
    console.log(`  Active: ${user.isActive}`);

    // Test date comparison with user input
    const userInputDate = '2002-11-20';
    const dateMatch = userInputDate === formattedDOB;
    
    console.log('\n🧪 Date Comparison Test:');
    console.log(`  User will input: "${userInputDate}"`);
    console.log(`  Database has: "${formattedDOB}"`);
    console.log(`  Match result: ${dateMatch ? '✅ PASS' : '❌ FAIL'}`);

    if (dateMatch) {
      console.log('\n🎉 SUCCESS! Date comparison will work correctly!');
      
      console.log('\n🎯 EXACT DATA FOR KYC TESTING:');
      console.log('  Email: sayarstha3@gmail.com');
      console.log('  License Number: 04-06-01018658');
      console.log('  Full Name: Sayar Shrestha');
      console.log('  Father Name: Asha Narayan');
      console.log('  Date of Birth: 2002-11-20');
      console.log('  Expiry Date: 2027-02-19');
      
      console.log('\n🚀 READY TO TEST:');
      console.log('1. Restart your backend server: npm run dev');
      console.log('2. Submit KYC with the exact data above');
      console.log('3. Upload clear selfie and license photos');
      console.log('4. System should auto-approve if everything matches!');
      
      console.log('\n⚠️  STRICT RULES:');
      console.log('• ALL fields must match exactly');
      console.log('• Face similarity ≥70%');
      console.log('• Any mismatch = detailed rejection message');
      
    } else {
      console.log('\n❌ Date comparison will still fail. Need to investigate further.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

finalVerification();