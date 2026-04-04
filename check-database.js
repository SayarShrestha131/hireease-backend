/**
 * Check RegisteredPerson database
 * Run with: node check-database.js
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

async function checkDatabase() {
  try {
    console.log('🔍 Checking RegisteredPerson database...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all registered persons
    const allUsers = await RegisteredPerson.find({});
    console.log(`\n📊 Total users in database: ${allUsers.length}\n`);

    if (allUsers.length === 0) {
      console.log('❌ No users found in RegisteredPerson table');
    } else {
      allUsers.forEach((user, index) => {
        console.log(`👤 User ${index + 1}:`);
        console.log(`   ID: ${user._id}`);
        console.log(`   Name: ${user.fullName}`);
        console.log(`   License: ${user.licenseNumber}`);
        console.log(`   Email: ${user.email || 'N/A'}`);
        console.log(`   Phone: ${user.phone || 'N/A'}`);
        console.log(`   DOB: ${user.dateOfBirth ? user.dateOfBirth.toISOString().split('T')[0] : 'N/A'}`);
        console.log(`   Address: ${user.address || 'N/A'}`);
        console.log(`   Photo: ${user.photoPath}`);
        console.log(`   Active: ${user.isActive}`);
        console.log(`   Created: ${user.registeredAt}`);
        console.log(`   Notes: ${user.notes || 'N/A'}`);
        console.log('');
      });
    }

    // Check specifically for Sayar Shrestha
    const sayar = await RegisteredPerson.findOne({ licenseNumber: '04-06-01018658' });
    if (sayar) {
      console.log('🎯 Sayar Shrestha found in database! ✅');
      console.log('   Ready for automated KYC verification');
    } else {
      console.log('❌ Sayar Shrestha not found in database');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkDatabase();