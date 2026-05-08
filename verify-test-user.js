/**
 * Verify the test user's email
 */

const mongoose = require('mongoose');
require('dotenv').config();

// User schema (simplified)
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  phone: String,
  role: { type: String, default: 'user' },
  isVerified: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

async function verifyTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Find and update test user
    const user = await User.findOneAndUpdate(
      { email: 'test@example.com' },
      { 
        isVerified: true,
        emailVerified: true,
        isEmailVerified: true
      },
      { new: true }
    );

    if (!user) {
      console.log('✗ Test user not found');
      await mongoose.connection.close();
      return;
    }

    console.log('✓ Test user verified successfully');
    console.log(`  Email: ${user.email}`);
    console.log(`  isVerified: ${user.isVerified}`);
    console.log(`  emailVerified: ${user.emailVerified}`);

    await mongoose.connection.close();
    console.log('✓ Done');
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

verifyTestUser();
