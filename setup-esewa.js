/**
 * Setup eSewa Configuration
 * 
 * This script adds eSewa configuration to your .env file
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

console.log('\n🔧 Setting up eSewa Configuration...\n');

// Check if .env exists
if (!fs.existsSync(envPath)) {
  console.log('❌ ERROR: .env file not found!');
  console.log('   Please create a .env file first by copying .env.example\n');
  process.exit(1);
}

// Read current .env file
let envContent = fs.readFileSync(envPath, 'utf8');

console.log('📄 Current .env file found');

// Backup original .env
const backupPath = path.join(__dirname, '.env.backup-esewa');
fs.writeFileSync(backupPath, envContent);
console.log('💾 Backup created: .env.backup-esewa\n');

// eSewa test credentials
const esewaConfig = {
  'ESEWA_ENABLED': 'true',
  'ESEWA_MERCHANT_ID': 'EPAYTEST',
  'ESEWA_MERCHANT_SECRET': 'test_secret_key_esewa',
};

console.log('🔄 Adding eSewa configuration...\n');

// Add eSewa configuration
Object.entries(esewaConfig).forEach(([key, value]) => {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  
  if (regex.test(envContent)) {
    // Update existing key
    envContent = envContent.replace(regex, `${key}=${value}`);
    console.log(`✅ Updated: ${key}=${value}`);
  } else {
    // Add new key
    envContent += `\n${key}=${value}`;
    console.log(`➕ Added: ${key}=${value}`);
  }
});

// Write updated .env file
fs.writeFileSync(envPath, envContent);

console.log('\n✅ .env file updated successfully!\n');
console.log('📋 eSewa Configuration:');
console.log('   ESEWA_ENABLED=true');
console.log('   ESEWA_MERCHANT_ID=EPAYTEST');
console.log('   ESEWA_MERCHANT_SECRET=test_secret_key_esewa\n');

console.log('🎯 Next steps:');
console.log('   1. Restart your backend server (Ctrl+C then npm run dev)');
console.log('   2. Reload your mobile app');
console.log('   3. Try payment with eSewa\n');

console.log('💡 eSewa Test Credentials:');
console.log('   eSewa ID: 9806800001');
console.log('   Password: Nepal@123');
console.log('   MPIN: 1234\n');

console.log('📚 eSewa Documentation:');
console.log('   https://developer.esewa.com.np/\n');
