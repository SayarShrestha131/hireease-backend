/**
 * Test timezone fix for date comparison
 * Run with: node test-timezone-fix.js
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

// Fixed date comparison function
function compareDates(date1, date2) {
  try {
    // Handle timezone issues by comparing only the date part, not time
    let d1;
    let d2;
    
    if (typeof date1 === 'string') {
      // If it's already a string in YYYY-MM-DD format, use it directly
      if (date1.match(/^\d{4}-\d{2}-\d{2}$/)) {
        d1 = date1;
      } else {
        // Parse and format to avoid timezone issues
        const parsed1 = new Date(date1 + 'T00:00:00.000Z');
        d1 = parsed1.toISOString().split('T')[0];
      }
    } else {
      d1 = date1.toISOString().split('T')[0];
    }
    
    if (typeof date2 === 'string') {
      // If it's already a string in YYYY-MM-DD format, use it directly
      if (date2.match(/^\d{4}-\d{2}-\d{2}$/)) {
        d2 = date2;
      } else {
        // Parse and format to avoid timezone issues
        const parsed2 = new Date(date2 + 'T00:00:00.000Z');
        d2 = parsed2.toISOString().split('T')[0];
      }
    } else {
      d2 = date2.toISOString().split('T')[0];
    }
    
    console.log(`[Date Comparison] Comparing "${d1}" vs "${d2}"`);
    return d1 === d2;
  } catch (error) {
    console.error('[Date Comparison] Error:', error);
    return false;
  }
}

// Fixed date extraction from database
function extractDateFromDB(dbDate) {
  if (!dbDate) return '';
  
  // Get the date in local timezone to avoid UTC conversion issues
  const year = dbDate.getFullYear();
  const month = String(dbDate.getMonth() + 1).padStart(2, '0');
  const day = String(dbDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function testTimezoneFix() {
  try {
    console.log('🕐 Testing Timezone Fix...\n');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get user from database
    const user = await RegisteredPerson.findOne({ licenseNumber: '04-06-01018658' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('📋 Database Date Analysis:');
    console.log('  Raw DB Date:', user.dateOfBirth);
    console.log('  DB Date (toISOString):', user.dateOfBirth.toISOString());
    console.log('  DB Date (toISOString split):', user.dateOfBirth.toISOString().split('T')[0]);
    
    // Extract date using fixed method
    const fixedDBDate = extractDateFromDB(user.dateOfBirth);
    console.log('  DB Date (fixed method):', fixedDBDate);

    // Test different input formats
    const testInputs = [
      '2002-11-20',
      '2002/11/20',
      new Date('2002-11-20'),
      new Date('2002-11-20T00:00:00.000Z')
    ];

    console.log('\n🧪 Testing Date Comparisons:');
    testInputs.forEach((input, index) => {
      console.log(`\nTest ${index + 1}: Input = ${input} (${typeof input})`);
      const result = compareDates(input, fixedDBDate);
      console.log(`  Result: ${result ? '✅ MATCH' : '❌ NO MATCH'}`);
    });

    // Test the specific case that was failing
    console.log('\n🎯 Specific Test Case:');
    const userInput = '2002-11-20'; // What user enters
    const dbDate = fixedDBDate; // What's in database
    
    console.log(`  User Input: "${userInput}"`);
    console.log(`  Database Date: "${dbDate}"`);
    const finalResult = compareDates(userInput, dbDate);
    console.log(`  Final Result: ${finalResult ? '✅ MATCH' : '❌ NO MATCH'}`);

    if (finalResult) {
      console.log('\n🎉 SUCCESS! Timezone issue is fixed!');
    } else {
      console.log('\n❌ Still having issues...');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testTimezoneFix();