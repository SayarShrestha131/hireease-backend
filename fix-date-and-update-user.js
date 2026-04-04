/**
 * Fix date issue and update user data
 * Run with: node fix-date-and-update-user.js
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

async function fixUserData() {
  try {
    console.log('🔧 Fixing user data...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find Sayar Shrestha
    const user = await RegisteredPerson.findOne({ licenseNumber: '04-06-01018658' });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('📋 Current user data:');
    console.log('  DOB (current):', user.dateOfBirth);
    console.log('  DOB (formatted):', user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : 'N/A');

    // Fix the date - create proper date object
    const correctDate = new Date('2002-11-20T00:00:00.000Z'); // Explicit UTC date
    
    console.log('\n🔧 Updating with correct date:');
    console.log('  New DOB:', correctDate);
    console.log('  New DOB (formatted):', correctDate.toISOString().split('T')[0]);

    // Update the user with correct data
    user.dateOfBirth = correctDate;
    user.fullName = 'Sayar Shrestha';
    user.email = 'sayarstha3@gmail.com';
    user.phone = '9841234567';
    user.address = 'Kathmandu, Nepal';
    user.notes = 'Authorized user for automated KYC - Date fixed';
    
    await user.save();

    // Verify the update
    const updatedUser = await RegisteredPerson.findOne({ licenseNumber: '04-06-01018658' });
    
    console.log('\n✅ Updated user data:');
    console.log('  ID:', updatedUser._id);
    console.log('  Name:', updatedUser.fullName);
    console.log('  License:', updatedUser.licenseNumber);
    console.log('  Email:', updatedUser.email);
    console.log('  Phone:', updatedUser.phone);
    console.log('  DOB (raw):', updatedUser.dateOfBirth);
    console.log('  DOB (formatted):', updatedUser.dateOfBirth.toISOString().split('T')[0]);
    console.log('  Address:', updatedUser.address);
    console.log('  Photo:', updatedUser.photoPath);
    console.log('  Active:', updatedUser.isActive);

    // Test date comparison
    const testDate1 = '2002-11-20';
    const testDate2 = updatedUser.dateOfBirth.toISOString().split('T')[0];
    console.log('\n🧪 Date comparison test:');
    console.log('  Input date:', testDate1);
    console.log('  DB date:', testDate2);
    console.log('  Match:', testDate1 === testDate2 ? '✅' : '❌');

    console.log('\n✨ User data fixed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

fixUserData();