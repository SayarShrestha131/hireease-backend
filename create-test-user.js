/**
 * Create a test user for payment integration testing
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// User schema (simplified)
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  role: { type: String, default: 'user' },
  isVerified: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Check if test user already exists
    const existingUser = await User.findOne({ email: 'test@example.com' });
    
    if (existingUser) {
      console.log('✓ Test user already exists');
      console.log(`  Email: ${existingUser.email}`);
      console.log(`  ID: ${existingUser._id}`);
      await mongoose.connection.close();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('Test123!@#', 10);

    // Create test user
    const testUser = new User({
      name: 'Test User',
      email: 'test@example.com',
      password: hashedPassword,
      phone: '+9779800000000',
      role: 'user',
      isVerified: true
    });

    await testUser.save();

    console.log('✓ Test user created successfully');
    console.log(`  Email: ${testUser.email}`);
    console.log(`  Password: Test123!@#`);
    console.log(`  ID: ${testUser._id}`);

    await mongoose.connection.close();
    console.log('✓ Done');
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

createTestUser();
