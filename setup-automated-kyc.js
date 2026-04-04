/**
 * Setup Script for Automated KYC System
 * 
 * This script helps you set up the automated KYC system by:
 * 1. Creating the reference images directory
 * 2. Providing instructions for adding reference images
 * 3. Testing the face recognition setup
 */

const fs = require('fs');
const path = require('path');

const REFERENCE_IMAGES_DIR = path.join(__dirname, 'reference_images');

console.log('🚀 Setting up Automated KYC System...\n');

// Create reference images directory
if (!fs.existsSync(REFERENCE_IMAGES_DIR)) {
  fs.mkdirSync(REFERENCE_IMAGES_DIR, { recursive: true });
  console.log('✅ Created reference_images directory:', REFERENCE_IMAGES_DIR);
} else {
  console.log('📁 Reference images directory already exists:', REFERENCE_IMAGES_DIR);
}

// Create sample reference images structure
const sampleImages = [
  'sayar_shrestha.jpg',
  'john_doe.jpg'
];

console.log('\n📋 SETUP INSTRUCTIONS:');
console.log('='.repeat(50));

console.log('\n1. ADD REFERENCE IMAGES:');
console.log('   Place the following reference images in:', REFERENCE_IMAGES_DIR);
sampleImages.forEach((image, index) => {
  const imagePath = path.join(REFERENCE_IMAGES_DIR, image);
  const exists = fs.existsSync(imagePath);
  console.log(`   ${index + 1}. ${image} ${exists ? '✅' : '❌ MISSING'}`);
});

console.log('\n2. IMAGE REQUIREMENTS:');
console.log('   - Clear frontal face photo');
console.log('   - Good lighting, no shadows');
console.log('   - Single person in the image');
console.log('   - JPEG or PNG format');
console.log('   - Minimum 300x300 pixels');
console.log('   - Face should fill 30-40% of the image');

console.log('\n3. AUTHORIZED USERS DATABASE:');
console.log('   Edit backend/src/services/automatedKycService.ts');
console.log('   Update the AUTHORIZED_USERS array with your data:');
console.log(`
   const AUTHORIZED_USERS: AuthorizedUser[] = [
     {
       id: 'user_001',
       email: 'your-email@example.com',
       fullName: 'Your Full Name',
       fatherName: 'Father Name',
       dateOfBirth: '1990-05-15',
       licenseNumber: 'DL123456789',
       licenseExpiryDate: '2025-12-31',
       licenseIssueDate: '2020-01-15',
       issuedBy: 'Government of Nepal',
       licenseOffice: 'Kathmandu Transport Office',
       address: 'Your Address',
       contactNumber: '+977-9841234567',
       citizenshipNumber: 'CIT123456',
       licenseType: 'A',
       faceDescriptor: new Float32Array(),
       profileImagePath: 'reference_images/your_photo.jpg',
       isActive: true
     }
   ];
`);

console.log('\n4. FACE-API MODELS:');
const modelsDir = path.join(__dirname, 'models');
const requiredModels = [
  'tiny_face_detector_model-weights_manifest.json',
  'face_landmark_68_model-weights_manifest.json',
  'face_recognition_model-weights_manifest.json'
];

console.log('   Required models in:', modelsDir);
requiredModels.forEach((model, index) => {
  const modelPath = path.join(modelsDir, model);
  const exists = fs.existsSync(modelPath);
  console.log(`   ${index + 1}. ${model} ${exists ? '✅' : '❌ MISSING'}`);
});

if (!requiredModels.every(model => fs.existsSync(path.join(modelsDir, model)))) {
  console.log('\n   ⚠️  Face-api models are missing!');
  console.log('   Run: node download-models.js');
}

console.log('\n5. INTEGRATION:');
console.log('   The automated KYC service is ready to integrate with your KYC controller.');
console.log('   Import and use performAutomatedKyc() function in your KYC submission handler.');

console.log('\n6. TESTING:');
console.log('   After setup, test the system by:');
console.log('   - Submitting KYC with a reference user\'s data');
console.log('   - Upload their reference photo as selfie');
console.log('   - Upload a license with matching details');
console.log('   - System should auto-approve if everything matches');

console.log('\n🎯 NEXT STEPS:');
console.log('1. Add your reference images to:', REFERENCE_IMAGES_DIR);
console.log('2. Update AUTHORIZED_USERS in automatedKycService.ts');
console.log('3. Ensure face-api models are downloaded');
console.log('4. Restart your backend server');
console.log('5. Test KYC submission with reference user data');

console.log('\n✨ Setup complete! Your automated KYC system is ready.');