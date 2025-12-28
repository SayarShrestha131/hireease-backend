import { connectDatabase } from '../config/database';
import User from '../models/User';

/**
 * Script to create an admin user
 * Run with: npx ts-node src/scripts/createAdmin.ts
 */

const createAdminUser = async () => {
  try {
    // Connect to database
    await connectDatabase();

    const adminEmail = 'admin@vehiclerental.com';
    const adminPassword = 'admin123456';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (existingAdmin) {
      console.log('❌ Admin user already exists');
      console.log(`Email: ${adminEmail}`);
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      isEmailVerified: true,
      username: 'Admin',
    });

    console.log('✅ Admin user created successfully!');
    console.log('-----------------------------------');
    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${adminPassword}`);
    console.log('-----------------------------------');
    console.log('You can now login to the admin panel at:');
    console.log('http://localhost:5000/admin.html');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();
