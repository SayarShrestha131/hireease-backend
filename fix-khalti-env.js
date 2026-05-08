/**
 * Fix Khalti Environment Variables
 * 
 * This script updates your .env file with working Khalti test credentials
 */

const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

console.log('\n🔧 Fixing Khalti Configuration in .env file...\n');

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
const backupPath = path.join(__dirname, '.env.backup');
fs.writeFileSync(backupPath, envContent);
console.log('💾 Backup created: .env.backup\n');

// Update Khalti configuration
const updates = {
  'PAYMENT_MODE': 'sandbox',
  'KHALTI_ENABLED': 'true',
  'KHALTI_PUBLIC_KEY': 'test_public_key_dc74e0fd57cb46cd93832aee0a390234',
  'KHALTI_SECRET_KEY': 'test_secret_key_f59e8b7d18b4499ca40f68195a846e9b',
  'KHALTI_WEBHOOK_SECRET': 'test_webhook_secret_here',
};

console.log('🔄 Updating Khalti configuration...\n');

Object.entries(updates).forEach(([key, value]) => {
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
console.log('📋 Updated configuration:');
console.log('   PAYMENT_MODE=sandbox');
console.log('   KHALTI_ENABLED=true');
console.log('   KHALTI_PUBLIC_KEY=test_public_key_dc74e0fd57cb46cd93832aee0a390234');
console.log('   KHALTI_SECRET_KEY=test_secret_key_f59e8b7d18b4499ca40f68195a846e9b');
console.log('   KHALTI_WEBHOOK_SECRET=test_webhook_secret_here\n');

console.log('🎯 Next steps:');
console.log('   1. Restart your backend server (Ctrl+C then npm run dev)');
console.log('   2. Test configuration: node test-khalti-api.js');
console.log('   3. Try payment in mobile app\n');

console.log('💡 If you need to restore the original .env, use: .env.backup\n');
