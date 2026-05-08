/**
 * Debug Payment Issue
 * 
 * This script helps diagnose the 400 error when initiating payment
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function debugPaymentIssue() {
  try {
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Import models
    const Booking = require('./dist/models/Booking').default;
    const User = require('./dist/models/User').default;

    // 1. Check recent bookings
    console.log('📋 Checking recent bookings...');
    const recentBookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(5);

    console.log(`Found ${recentBookings.length} recent bookings:\n`);
    
    recentBookings.forEach((booking, index) => {
      console.log(`${index + 1}. Booking ID: ${booking.bookingId}`);
      console.log(`   MongoDB _id: ${booking._id}`);
      console.log(`   Status: ${booking.status}`);
      console.log(`   Payment Status: ${booking.paymentStatus}`);
      console.log(`   User ID: ${booking.userId}`);
      console.log(`   Vehicle ID: ${booking.vehicleId}`);
      console.log(`   Total Price: Rs. ${booking.priceBreakdown?.totalPrice || 0}`);
      console.log(`   Payment Retry Count: ${booking.paymentRetryCount || 0}`);
      console.log(`   Created: ${booking.createdAt}`);
      console.log('');
    });

    // 2. Check for pending bookings specifically
    console.log('⏳ Checking pending bookings...');
    const pendingBookings = await Booking.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .limit(3);

    console.log(`Found ${pendingBookings.length} pending bookings:\n`);
    
    pendingBookings.forEach((booking, index) => {
      console.log(`${index + 1}. Booking ID: ${booking.bookingId}`);
      console.log(`   MongoDB _id: ${booking._id}`);
      console.log(`   User ID: ${booking.userId}`);
      console.log(`   Total Price: Rs. ${booking.priceBreakdown?.totalPrice || 0}`);
      console.log(`   Payment Method: ${booking.paymentMethod || 'Not set'}`);
      console.log(`   Payment Gateway: ${booking.paymentGateway || 'Not set'}`);
      console.log('');
    });

    // 3. Test booking lookup by bookingId (same as payment service does)
    if (pendingBookings.length > 0) {
      const testBookingId = pendingBookings[0].bookingId;
      console.log(`🧪 Testing booking lookup with bookingId: ${testBookingId}`);
      
      const foundBooking = await Booking.findOne({ bookingId: testBookingId });
      
      if (foundBooking) {
        console.log('✅ Booking found successfully!');
        console.log(`   Status: ${foundBooking.status}`);
        console.log(`   User ID: ${foundBooking.userId}`);
        console.log(`   Total: Rs. ${foundBooking.priceBreakdown?.totalPrice}`);
      } else {
        console.log('❌ Booking NOT found - This is the problem!');
      }
      console.log('');
    }

    // 4. Check eSewa configuration
    console.log('⚙️  Checking eSewa configuration...');
    console.log(`   PAYMENT_MODE: ${process.env.PAYMENT_MODE}`);
    console.log(`   ESEWA_ENABLED: ${process.env.ESEWA_ENABLED}`);
    console.log(`   ESEWA_MERCHANT_ID: ${process.env.ESEWA_MERCHANT_ID}`);
    console.log(`   ESEWA_MERCHANT_SECRET: ${process.env.ESEWA_MERCHANT_SECRET ? '***SET***' : 'NOT SET'}`);
    console.log('');

    // 5. Check if there are any users
    console.log('👥 Checking users...');
    const userCount = await User.countDocuments();
    console.log(`   Total users: ${userCount}`);
    
    if (userCount > 0) {
      const sampleUser = await User.findOne().select('name email');
      console.log(`   Sample user: ${sampleUser?.name} (${sampleUser?.email})`);
    }
    console.log('');

    console.log('✅ Diagnostic complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Make sure you have a pending booking');
    console.log('   2. Use the exact bookingId shown above (e.g., BK-20260502-4862)');
    console.log('   3. Ensure you are authenticated as the user who created the booking');
    console.log('   4. Check backend logs for detailed error messages');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

debugPaymentIssue();
