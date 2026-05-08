/**
 * Force verify the test user by directly updating MongoDB
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

async function forceVerifyUser() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB');
    
    const db = client.db();
    const users = db.collection('users');
    
    // Update the test user
    const result = await users.updateOne(
      { email: 'test@example.com' },
      { 
        $set: { 
          isEmailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpires: null
        } 
      }
    );
    
    if (result.matchedCount === 0) {
      console.log('✗ Test user not found');
    } else {
      console.log('✓ Test user verified successfully');
      
      // Fetch and display the user
      const user = await users.findOne({ email: 'test@example.com' });
      console.log(`  Email: ${user.email}`);
      console.log(`  isEmailVerified: ${user.isEmailVerified}`);
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
  } finally {
    await client.close();
    console.log('✓ Done');
  }
}

forceVerifyUser();
