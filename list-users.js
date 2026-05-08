/**
 * List Users
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const User = require('./dist/models/User').default;

    const users = await User.find().select('name email role isVerified');
    
    console.log(`Found ${users.length} users:\n`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'No name'}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Verified: ${user.isVerified}`);
      console.log(`   ID: ${user._id}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

listUsers();
