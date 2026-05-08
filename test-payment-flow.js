/**
 * Quick Test Script for Khalti Payment Flow
 * 
 * This script helps you test the complete payment flow in development
 * Run: node test-payment-flow.js
 */

const axios = require('axios');
const readline = require('readline');

const API_BASE_URL = 'http://localhost:5000/api';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function testPaymentFlow() {
  console.log('\n🚀 Khalti Payment Flow Test\n');
  console.log('=' .repeat(50));
  
  try {
    // Step 1: Get auth token
    console.log('\n📝 Step 1: Authentication');
    const email = await question('Enter your email: ');
    const password = await question('Enter your password: ');
    
    console.log('\n🔐 Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });
    
    if (!loginResponse.data.success) {
      console.error('❌ Login failed:', loginResponse.data.error);
      rl.close();
      return;
    }
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login successful!');
    console.log(`Token: ${token.substring(0, 20)}...`);
    
    // Step 2: Get booking ID
    console.log('\n📋 Step 2: Booking Information');
    const bookingId = await question('Enter booking ID (or press Enter to list your bookings): ');
    
    if (!bookingId) {
      console.log('\n📚 Fetching your bookings...');
      const bookingsResponse = await axios.get(`${API_BASE_URL}/bookings/my-bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (bookingsResponse.data.success && bookingsResponse.data.data.bookings.length > 0) {
        console.log('\nYour bookings:');
        bookingsResponse.data.data.bookings.forEach((booking, index) => {
          console.log(`${index + 1}. ${booking.bookingId} - Status: ${booking.status} - Payment: ${booking.paymentStatus}`);
        });
        
        const selectedBookingId = await question('\nEnter booking ID from the list above: ');
        if (!selectedBookingId) {
          console.log('❌ No booking ID provided');
          rl.close();
          return;
        }
        
        return testPaymentFlow(); // Restart with booking ID
      } else {
        console.log('❌ No bookings found. Please create a booking first.');
        rl.close();
        return;
      }
    }
    
    // Step 3: Initiate payment
    console.log('\n💳 Step 3: Initiating Payment');
    console.log('Payment Method: Khalti');
    
    const initiateResponse = await axios.post(
      `${API_BASE_URL}/payments/initiate`,
      {
        bookingId: bookingId,
        paymentMethod: 'khalti',
        returnUrl: 'http://localhost:3000/payment/verify'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    
    if (!initiateResponse.data.success) {
      console.error('❌ Payment initiation failed:', initiateResponse.data.error);
      if (initiateResponse.data.suggestedAction) {
        console.log(`💡 Suggested Action: ${initiateResponse.data.suggestedAction}`);
      }
      rl.close();
      return;
    }
    
    const paymentData = initiateResponse.data.data;
    console.log('✅ Payment initiated successfully!');
    console.log(`\nTransaction ID: ${paymentData.transactionId}`);
    console.log(`Amount: NPR ${paymentData.amount}`);
    console.log(`Expires At: ${new Date(paymentData.expiresAt).toLocaleString()}`);
    console.log(`\n🔗 Payment URL: ${paymentData.paymentUrl}`);
    
    console.log('\n' + '='.repeat(50));
    console.log('📱 NEXT STEPS:');
    console.log('='.repeat(50));
    console.log('1. Open the payment URL in your browser');
    console.log('2. Use these test credentials on Khalti:');
    console.log('   Mobile: 9800000000 to 9800000010');
    console.log('   MPIN: 1111');
    console.log('   OTP: 987654');
    console.log('3. Complete the payment');
    console.log('4. After redirect, note the "pidx" from URL');
    console.log('5. Run verification (next step)');
    console.log('='.repeat(50));
    
    // Step 4: Ask if user wants to verify now
    const verifyNow = await question('\nDo you want to verify payment now? (y/n): ');
    
    if (verifyNow.toLowerCase() === 'y') {
      const pidx = await question('Enter pidx from Khalti redirect URL: ');
      
      if (!pidx) {
        console.log('❌ No pidx provided');
        rl.close();
        return;
      }
      
      console.log('\n✅ Step 4: Verifying Payment');
      const verifyResponse = await axios.post(
        `${API_BASE_URL}/payments/verify`,
        {
          transactionId: paymentData.transactionId,
          gatewayData: {
            pidx: pidx,
            status: 'Completed'
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      if (verifyResponse.data.success) {
        console.log('✅ Payment verified successfully!');
        console.log(`\nBooking ID: ${verifyResponse.data.data.bookingId}`);
        console.log(`Payment Status: ${verifyResponse.data.data.paymentStatus}`);
        
        if (verifyResponse.data.data.receiptUrl) {
          console.log(`\n📄 Receipt: ${API_BASE_URL}${verifyResponse.data.data.receiptUrl}`);
        }
      } else {
        console.error('❌ Payment verification failed:', verifyResponse.data.error);
        if (verifyResponse.data.suggestedAction) {
          console.log(`💡 Suggested Action: ${verifyResponse.data.suggestedAction}`);
        }
      }
    }
    
    console.log('\n✨ Test completed!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    if (error.response?.data?.suggestedAction) {
      console.log(`💡 Suggested Action: ${error.response.data.suggestedAction}`);
    }
  } finally {
    rl.close();
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${API_BASE_URL.replace('/api', '')}/health`);
    return true;
  } catch (error) {
    return false;
  }
}

// Main execution
(async () => {
  console.log('🔍 Checking if server is running...');
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.error('\n❌ Server is not running!');
    console.log('Please start the server first:');
    console.log('  cd backend');
    console.log('  npm run dev');
    process.exit(1);
  }
  
  console.log('✅ Server is running!\n');
  await testPaymentFlow();
})();
