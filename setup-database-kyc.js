/**
 * Setup Database for Automated KYC
 * Run with: node setup-database-kyc.js
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Setting up Database for Automated KYC...\n');

try {
  // Run the TypeScript script to add authorized user
  console.log('📝 Adding authorized user to RegisteredPerson table...');
  
  const scriptPath = path.join(__dirname, 'scripts/addAuthorizedUser.ts');
  execSync(`npx ts-node ${scriptPath}`, { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  
  console.log('\n✅ Database setup complete!');
  console.log('\n🎯 Next Steps:');
  console.log('1. Restart your backend server');
  console.log('2. Test KYC submission with your details:');
  console.log('   - Email: sayarstha3@gmail.com');
  console.log('   - License: 04-06-01018658');
  console.log('   - Name: Sayar Shrestha');
  console.log('   - Father: Asha Narayan');
  console.log('   - DOB: 2002-11-20');
  console.log('   - Expiry: 2027-02-19');
  console.log('3. Upload clear selfie and license photo');
  console.log('4. System should auto-approve instantly!');
  
} catch (error) {
  console.error('❌ Error setting up database:', error.message);
  console.log('\n🔧 Troubleshooting:');
  console.log('1. Make sure MongoDB is running');
  console.log('2. Check your .env file has correct MONGODB_URI');
  console.log('3. Ensure sayar_shrestha.jpg exists in backend/reference_images/');
  console.log('4. Try running: npm install');
}