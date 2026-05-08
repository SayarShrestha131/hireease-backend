/**
 * Test Khalti Configuration
 * 
 * This script tests if Khalti is properly configured in the backend
 */

require('dotenv').config();

console.log('\n🔍 Testing Khalti Configuration...\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log('  PAYMENT_MODE:', process.env.PAYMENT_MODE || 'NOT SET');
console.log('  KHALTI_ENABLED:', process.env.KHALTI_ENABLED || 'NOT SET');
console.log('  KHALTI_PUBLIC_KEY:', process.env.KHALTI_PUBLIC_KEY ? 'SET ✅' : 'NOT SET ❌');
console.log('  KHALTI_SECRET_KEY:', process.env.KHALTI_SECRET_KEY ? 'SET ✅' : 'NOT SET ❌');
console.log('  KHALTI_WEBHOOK_SECRET:', process.env.KHALTI_WEBHOOK_SECRET ? 'SET ✅' : 'NOT SET ❌');

console.log('\n');

// Check if Khalti is enabled
if (process.env.KHALTI_ENABLED === 'false' || !process.env.KHALTI_ENABLED) {
  console.log('⚠️  WARNING: KHALTI_ENABLED is set to false or not set!');
  console.log('   To enable Khalti, set KHALTI_ENABLED=true in your .env file\n');
}

// Check if keys are set
if (!process.env.KHALTI_SECRET_KEY || process.env.KHALTI_SECRET_KEY === 'your-khalti-secret-key') {
  console.log('❌ ERROR: KHALTI_SECRET_KEY is not configured!');
  console.log('   You need to set your Khalti secret key in the .env file\n');
  console.log('   For testing, use Khalti test credentials:');
  console.log('   Get your test keys from: https://docs.khalti.com/getting-started/test-credentials/\n');
  process.exit(1);
}

if (!process.env.KHALTI_PUBLIC_KEY || process.env.KHALTI_PUBLIC_KEY === 'your-khalti-public-key') {
  console.log('❌ ERROR: KHALTI_PUBLIC_KEY is not configured!');
  console.log('   You need to set your Khalti public key in the .env file\n');
  process.exit(1);
}

console.log('✅ Khalti configuration looks good!\n');
console.log('📝 Next steps:');
console.log('   1. Make sure KHALTI_ENABLED=true in your .env file');
console.log('   2. Restart your backend server');
console.log('   3. Try the payment flow again\n');
