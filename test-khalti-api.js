/**
 * Test Khalti API Connection
 * 
 * This script tests if we can connect to Khalti API
 */

require('dotenv').config();
const axios = require('axios');

async function testKhaltiAPI() {
  console.log('\n🔍 Testing Khalti API Connection...\n');

  const secretKey = process.env.KHALTI_SECRET_KEY;
  const mode = process.env.PAYMENT_MODE || 'sandbox';
  
  const baseUrl = mode === 'production'
    ? 'https://khalti.com/api/v2'
    : 'https://a.khalti.com/api/v2';

  console.log('📍 Base URL:', baseUrl);
  console.log('🔑 Secret Key:', secretKey ? 'SET ✅' : 'NOT SET ❌');
  console.log('🎯 Mode:', mode);
  console.log('\n');

  if (!secretKey) {
    console.log('❌ ERROR: KHALTI_SECRET_KEY is not set!');
    process.exit(1);
  }

  try {
    console.log('📤 Sending test payment request to Khalti...\n');

    const payload = {
      return_url: 'http://localhost:3000/payment/verify',
      website_url: 'http://localhost:3000',
      amount: 100000, // Rs. 1000 in paisa
      purchase_order_id: 'TEST-' + Date.now(),
      purchase_order_name: 'Test Booking',
      customer_info: {
        name: 'Test Customer',
        email: 'test@example.com',
        phone: '9800000000',
      },
    };

    console.log('📋 Request payload:', JSON.stringify(payload, null, 2));
    console.log('\n');

    const response = await axios.post(
      `${baseUrl}/epayment/initiate/`,
      payload,
      {
        headers: {
          'Authorization': `Key ${secretKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    console.log('✅ SUCCESS! Khalti API is working!\n');
    console.log('📥 Response:', JSON.stringify(response.data, null, 2));
    console.log('\n');
    console.log('🎉 Your Khalti configuration is correct!');
    console.log('   The payment flow should work now.\n');

  } catch (error) {
    console.log('❌ ERROR: Failed to connect to Khalti API\n');
    
    if (error.response) {
      console.log('📥 Error Response:');
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
      console.log('\n');

      if (error.response.status === 401) {
        console.log('🔑 Authentication Error:');
        console.log('   Your KHALTI_SECRET_KEY might be incorrect.');
        console.log('   Please check your .env file and make sure you are using the correct key.\n');
        console.log('   For sandbox testing, get your keys from:');
        console.log('   https://docs.khalti.com/getting-started/test-credentials/\n');
      } else if (error.response.status === 400) {
        console.log('📋 Request Error:');
        console.log('   The request format might be incorrect.');
        console.log('   Error details:', error.response.data);
        console.log('\n');
      }
    } else if (error.request) {
      console.log('🌐 Network Error:');
      console.log('   Could not reach Khalti API.');
      console.log('   Please check your internet connection.\n');
    } else {
      console.log('❓ Unknown Error:', error.message);
      console.log('\n');
    }

    process.exit(1);
  }
}

testKhaltiAPI();
