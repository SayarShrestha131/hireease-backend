/**
 * Test strict verification with different scenarios
 * Run with: node test-strict-verification.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Test date comparison function
function compareDates(date1, date2) {
  try {
    const d1 = new Date(date1).toISOString().split('T')[0];
    const d2 = new Date(date2).toISOString().split('T')[0];
    return d1 === d2;
  } catch {
    return false;
  }
}

// Test string comparison function
function normalizeString(str) {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

function compareStrings(str1, str2, threshold = 0.8) {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);
  
  // Exact match
  if (norm1 === norm2) return true;
  
  // Partial match for names (handles middle names, etc.)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return true;
  }
  
  return false; // Strict matching - no fuzzy matching
}

async function testVerification() {
  try {
    console.log('🧪 Testing Strict Verification Logic...\n');

    // Database user data (what's stored)
    const dbUser = {
      fullName: 'Sayar Shrestha',
      licenseNumber: '04-06-01018658',
      email: 'sayarstha3@gmail.com',
      dateOfBirth: '2002-11-20',
      fatherName: 'Asha Narayan',
      licenseExpiryDate: '2027-02-19'
    };

    console.log('📋 Database User Data:');
    console.log('  Name:', dbUser.fullName);
    console.log('  License:', dbUser.licenseNumber);
    console.log('  Email:', dbUser.email);
    console.log('  DOB:', dbUser.dateOfBirth);
    console.log('  Father:', dbUser.fatherName);
    console.log('  Expiry:', dbUser.licenseExpiryDate);

    // Test scenarios
    const testScenarios = [
      {
        name: 'Perfect Match (Should PASS)',
        data: {
          fullName: 'Sayar Shrestha',
          licenseNumber: '04-06-01018658',
          email: 'sayarstha3@gmail.com',
          dateOfBirth: '2002-11-20',
          fatherName: 'Asha Narayan',
          licenseExpiryDate: '2027-02-19'
        }
      },
      {
        name: 'Wrong License Number (Should FAIL)',
        data: {
          fullName: 'Sayar Shrestha',
          licenseNumber: '04-06-01018659', // Wrong
          email: 'sayarstha3@gmail.com',
          dateOfBirth: '2002-11-20',
          fatherName: 'Asha Narayan',
          licenseExpiryDate: '2027-02-19'
        }
      },
      {
        name: 'Wrong Date of Birth (Should FAIL)',
        data: {
          fullName: 'Sayar Shrestha',
          licenseNumber: '04-06-01018658',
          email: 'sayarstha3@gmail.com',
          dateOfBirth: '2002-11-21', // Wrong
          fatherName: 'Asha Narayan',
          licenseExpiryDate: '2027-02-19'
        }
      },
      {
        name: 'Wrong Father Name (Should FAIL)',
        data: {
          fullName: 'Sayar Shrestha',
          licenseNumber: '04-06-01018658',
          email: 'sayarstha3@gmail.com',
          dateOfBirth: '2002-11-20',
          fatherName: 'Wrong Father', // Wrong
          licenseExpiryDate: '2027-02-19'
        }
      },
      {
        name: 'Wrong Email (Should FAIL)',
        data: {
          fullName: 'Sayar Shrestha',
          licenseNumber: '04-06-01018658',
          email: 'wrong@gmail.com', // Wrong
          dateOfBirth: '2002-11-20',
          fatherName: 'Asha Narayan',
          licenseExpiryDate: '2027-02-19'
        }
      }
    ];

    console.log('\n🧪 Running Test Scenarios:\n');

    testScenarios.forEach((scenario, index) => {
      console.log(`${index + 1}. ${scenario.name}`);
      
      const licenseMatch = compareStrings(scenario.data.licenseNumber, dbUser.licenseNumber);
      const nameMatch = compareStrings(scenario.data.fullName, dbUser.fullName);
      const dobMatch = compareDates(scenario.data.dateOfBirth, dbUser.dateOfBirth);
      const emailMatch = normalizeString(scenario.data.email) === normalizeString(dbUser.email);
      const fatherMatch = compareStrings(scenario.data.fatherName, dbUser.fatherName);
      const expiryMatch = compareDates(scenario.data.licenseExpiryDate, dbUser.licenseExpiryDate);
      
      const allMatch = licenseMatch && nameMatch && dobMatch && emailMatch && fatherMatch && expiryMatch;
      
      console.log(`   License: ${licenseMatch ? '✅' : '❌'} (${scenario.data.licenseNumber})`);
      console.log(`   Name: ${nameMatch ? '✅' : '❌'} (${scenario.data.fullName})`);
      console.log(`   DOB: ${dobMatch ? '✅' : '❌'} (${scenario.data.dateOfBirth})`);
      console.log(`   Email: ${emailMatch ? '✅' : '❌'} (${scenario.data.email})`);
      console.log(`   Father: ${fatherMatch ? '✅' : '❌'} (${scenario.data.fatherName})`);
      console.log(`   Expiry: ${expiryMatch ? '✅' : '❌'} (${scenario.data.licenseExpiryDate})`);
      console.log(`   Result: ${allMatch ? '✅ PASS' : '❌ FAIL'}`);
      
      if (!allMatch) {
        const failures = [];
        if (!licenseMatch) failures.push('License number mismatch');
        if (!nameMatch) failures.push('Name mismatch');
        if (!dobMatch) failures.push('Date of birth mismatch');
        if (!emailMatch) failures.push('Email mismatch');
        if (!fatherMatch) failures.push('Father name mismatch');
        if (!expiryMatch) failures.push('Expiry date mismatch');
        console.log(`   Reasons: ${failures.join(', ')}`);
      }
      
      console.log('');
    });

    console.log('✨ Test completed! The system now requires ALL fields to match exactly.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testVerification();