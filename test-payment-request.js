/**
 * Test Payment Request
 * 
 * Simulates the exact request from the mobile app to debug the 400 error
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

async function testPaymentRequest() {
  try {
    console.log('🧪 Testing Payment Request\n');

    // Step 1: Login to get auth token
    console.log('1️⃣  Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'Test@1234',
    });

    const authToken = loginResponse.data.token;
    console.log('✅ Logged in successfully');
    console.log('   Token:', authToken.substring(0, 20) + '...\n');

    // Step 2: Get a pending booking
    console.log('2️⃣  Fetching bookings...');
    const bookingsResponse = await axios.get(`${API_BASE_URL}/bookings`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const pendingBooking = bookingsResponse.data.bookings.find(
      (b) => b.status === 'pending'
    );

    if (!pendingBooking) {
      console.log('❌ No pending bookings found');
      console.log('   Available bookings:', bookingsResponse.data.bookings.length);
      return;
    }

    console.log('✅ Found pending booking');
    console.log('   Booking ID:', pendingBooking.bookingId);
    console.log('   Total Price:', pendingBooking.priceBreakdown.totalPrice);
    console.log('   Status:', pendingBooking.status);
    console.log('');

    // Step 3: Initiate payment (this is where the error occurs)
    console.log('3️⃣  Initiating payment...');
    console.log('   Request payload:');
    const paymentPayload = {
      bookingId: pendingBooking.bookingId,
      paymentMethod: 'esewa',
      returnUrl: 'myapp://payment/verify',
    };
    console.log('   ', JSON.stringify(paymentPayload, null, 2));
    console.log('');

    const paymentResponse = await axios.post(
      `${API_BASE_URL}/payments/initiate`,
      paymentPayload,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Payment initiated successfully!');
    console.log('   Response:', JSON.stringify(paymentResponse.data, null, 2));
  } catch (error) {
    console.error('\n❌ Error occurred:');
    
    if (error.response) {
      // Server responded with error
      console.error('   Status:', error.response.status);
      console.error('   Error:', JSON.stringify(error.response.data, null, 2));
      console.error('   Headers:', JSON.stringify(error.response.headers, null, 2));
    } else if (error.request) {
      // Request made but no response
      console.error('   No response received');
      console.error('   Request:', error.request);
    } else {
      // Error setting up request
      console.error('   Message:', error.message);
    }
    
    console.error('\n   Full error:', error);
  }
}

testPaymentRequest();
