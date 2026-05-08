const axios = require('axios');

async function testLogin() {
  try {
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'test@example.com',
      password: 'Test123!@#'
    });
    
    console.log('✓ Login successful');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('✗ Login failed');
    console.log('Status:', error.response?.status);
    console.log('Error:', JSON.stringify(error.response?.data, null, 2));
  }
}

testLogin();
