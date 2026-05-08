/**
 * Test Actual Payment with Real User
 */

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');

const API_BASE_URL = 'http://localhost:5000/api';

async function testActualPayment() {
  try {
    console.log('🧪 Testing Actual Payment Flow\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const User = require('./dist/models/User').default;
    const Booking = require('./dist/models/Booking').default;

    // Get a real user
    const user = await User.findOne({ email: 'sayarstha3@gmail.com' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 User found:', user.email);
    console.log('   User ID:', user._id);

    // Generate token manually (since we don't have the method)
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET || 'hireease-dev-secret-key-2024',
      { expiresIn: '7d' }
    );

    console.log('🔑 Generated token:', token.substring(0, 30) + '...\n');

    // Get a pending booking for this user
    const booking = await Booking.findOne({
      userId: user._id,
      status: 'pending'
    }).sort({ createdAt: -1 });

    if (!booking) {
      console.log('❌ No pending booking found for this user');
      return;
    }

    console.log('📋 Booking found:');
    console.log('   Booking ID:', booking.bookingId);
    console.log('   Status:', booking.status);
    console.log('   Total Price:', booking.priceBreakdown.totalPrice);
    console.log('');

    // Make the payment request
    console.log('💳 Initiating payment...');
    const paymentPayload = {
      bookingId: booking.bookingId,
      paymentMethod: 'esewa',
      returnUrl: 'myapp://payment/verify',
    };

    console.log('   Payload:', JSON.stringify(paymentPayload, null, 2));
    console.log('   Token:', token.substring(0, 30) + '...');
    console.log('');

    const response = await axios.post(
      `${API_BASE_URL}/payments/initiate`,
      paymentPayload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ SUCCESS! Payment initiated');
    console.log('   Response:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('\n❌ ERROR:');
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
      console.error('   Headers:', error.response.headers);
    } else if (error.request) {
      console.error('   No response received');
    } else {
      console.error('   Error:', error.message);
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testActualPayment();
