/**
 * Manual Test Script for Authentication Endpoints
 * 
 * This script tests the authentication endpoints by making actual HTTP requests
 * to the running server. Run the server first with `npm run dev`, then run this
 * script in a separate terminal with `npx ts-node src/test-auth.ts`
 * 
 * Requirements tested: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000';
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'password123';

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

/**
 * Helper function to make HTTP requests
 */
function makeRequest(
  method: string,
  path: string,
  data?: any
): Promise<{ statusCode: number; body: any }> {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedBody = JSON.parse(body);
          resolve({ statusCode: res.statusCode || 0, body: parsedBody });
        } catch (error) {
          resolve({ statusCode: res.statusCode || 0, body: { raw: body } });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

/**
 * Test 1: Successful registration with valid email and password
 * Requirements: 1.1, 1.5
 */
async function testSuccessfulRegistration(): Promise<void> {
  try {
    const response = await makeRequest('POST', '/api/auth/register', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (response.statusCode === 201 && 
        response.body.success === true &&
        response.body.data.user &&
        response.body.data.token &&
        !response.body.data.user.password) {
      results.push({
        name: 'Successful registration',
        passed: true,
        message: 'User registered successfully with JWT token',
      });
    } else {
      results.push({
        name: 'Successful registration',
        passed: false,
        message: `Expected 201 with user and token, got ${response.statusCode}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'Successful registration',
      passed: false,
      message: `Error: ${error}`,
    });
  }
}

/**
 * Test 2: Registration with duplicate email returns 409
 * Requirements: 1.2
 */
async function testDuplicateEmailRegistration(): Promise<void> {
  try {
    const response = await makeRequest('POST', '/api/auth/register', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (response.statusCode === 409) {
      results.push({
        name: 'Duplicate email registration',
        passed: true,
        message: 'Correctly returned 409 conflict error',
      });
    } else {
      results.push({
        name: 'Duplicate email registration',
        passed: false,
        message: `Expected 409, got ${response.statusCode}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'Duplicate email registration',
      passed: false,
      message: `Error: ${error}`,
    });
  }
}

/**
 * Test 3: Registration with invalid email format returns 400
 * Requirements: 1.3
 */
async function testInvalidEmailFormat(): Promise<void> {
  try {
    const response = await makeRequest('POST', '/api/auth/register', {
      email: 'invalid-email',
      password: TEST_PASSWORD,
    });

    if (response.statusCode === 400) {
      results.push({
        name: 'Invalid email format',
        passed: true,
        message: 'Correctly returned 400 validation error',
      });
    } else {
      results.push({
        name: 'Invalid email format',
        passed: false,
        message: `Expected 400, got ${response.statusCode}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'Invalid email format',
      passed: false,
      message: `Error: ${error}`,
    });
  }
}

/**
 * Test 4: Registration with short password returns 400
 * Requirements: 1.4
 */
async function testShortPassword(): Promise<void> {
  try {
    const response = await makeRequest('POST', '/api/auth/register', {
      email: `new-${Date.now()}@example.com`,
      password: '12345', // Less than 6 characters
    });

    if (response.statusCode === 400) {
      results.push({
        name: 'Short password validation',
        passed: true,
        message: 'Correctly returned 400 validation error',
      });
    } else {
      results.push({
        name: 'Short password validation',
        passed: false,
        message: `Expected 400, got ${response.statusCode}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'Short password validation',
      passed: false,
      message: `Error: ${error}`,
    });
  }
}

/**
 * Test 5: Registration with missing fields returns 400
 * Requirements: 1.3, 1.4
 */
async function testMissingFields(): Promise<void> {
  try {
    const response = await makeRequest('POST', '/api/auth/register', {
      email: `missing-${Date.now()}@example.com`,
      // Missing password
    });

    if (response.statusCode === 400) {
      results.push({
        name: 'Missing fields validation',
        passed: true,
        message: 'Correctly returned 400 validation error',
      });
    } else {
      results.push({
        name: 'Missing fields validation',
        passed: false,
        message: `Expected 400, got ${response.statusCode}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'Missing fields validation',
      passed: false,
      message: `Error: ${error}`,
    });
  }
}

/**
 * Test 6: Successful login with valid credentials
 * Requirements: 2.1, 2.4, 2.5
 */
async function testSuccessfulLogin(): Promise<void> {
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (response.statusCode === 200 && 
        response.body.success === true &&
        response.body.data.user &&
        response.body.data.token &&
        !response.body.data.user.password) {
      results.push({
        name: 'Successful login',
        passed: true,
        message: 'User logged in successfully with JWT token',
      });
    } else {
      results.push({
        name: 'Successful login',
        passed: false,
        message: `Expected 200 with user and token, got ${response.statusCode}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'Successful login',
      passed: false,
      message: `Error: ${error}`,
    });
  }
}

/**
 * Test 7: Login with invalid email returns 401
 * Requirements: 2.2
 */
async function testInvalidEmail(): Promise<void> {
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      email: 'nonexistent@example.com',
      password: TEST_PASSWORD,
    });

    if (response.statusCode === 401) {
      results.push({
        name: 'Invalid email login',
        passed: true,
        message: 'Correctly returned 401 authentication error',
      });
    } else {
      results.push({
        name: 'Invalid email login',
        passed: false,
        message: `Expected 401, got ${response.statusCode}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'Invalid email login',
      passed: false,
      message: `Error: ${error}`,
    });
  }
}

/**
 * Test 8: Login with invalid password returns 401
 * Requirements: 2.2
 */
async function testInvalidPassword(): Promise<void> {
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      email: TEST_EMAIL,
      password: 'wrongpassword',
    });

    if (response.statusCode === 401) {
      results.push({
        name: 'Invalid password login',
        passed: true,
        message: 'Correctly returned 401 authentication error',
      });
    } else {
      results.push({
        name: 'Invalid password login',
        passed: false,
        message: `Expected 401, got ${response.statusCode}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'Invalid password login',
      passed: false,
      message: `Error: ${error}`,
    });
  }
}

/**
 * Test 9: Login with missing fields returns 400
 * Requirements: 2.3
 */
async function testLoginMissingFields(): Promise<void> {
  try {
    const response = await makeRequest('POST', '/api/auth/login', {
      email: TEST_EMAIL,
      // Missing password
    });

    if (response.statusCode === 400) {
      results.push({
        name: 'Login missing fields',
        passed: true,
        message: 'Correctly returned 400 validation error',
      });
    } else {
      results.push({
        name: 'Login missing fields',
        passed: false,
        message: `Expected 400, got ${response.statusCode}`,
      });
    }
  } catch (error) {
    results.push({
      name: 'Login missing fields',
      passed: false,
      message: `Error: ${error}`,
    });
  }
}

/**
 * Print test results
 */
function printResults(): void {
  console.log('\n' + '='.repeat(60));
  console.log('Authentication Endpoints Test Results');
  console.log('='.repeat(60) + '\n');

  let passed = 0;
  let failed = 0;

  results.forEach((result, index) => {
    const status = result.passed ? '✓ PASS' : '✗ FAIL';
    const color = result.passed ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';
    
    console.log(`${color}${status}${reset} Test ${index + 1}: ${result.name}`);
    console.log(`     ${result.message}\n`);
    
    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  });

  console.log('='.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('='.repeat(60) + '\n');

  if (failed > 0) {
    process.exit(1);
  }
}

/**
 * Run all tests
 */
async function runTests(): Promise<void> {
  console.log('\nStarting authentication endpoint tests...');
  console.log('Make sure the server is running on http://localhost:5000\n');

  // Wait a moment to ensure server is ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Registration tests
  await testSuccessfulRegistration();
  await testDuplicateEmailRegistration();
  await testInvalidEmailFormat();
  await testShortPassword();
  await testMissingFields();

  // Login tests
  await testSuccessfulLogin();
  await testInvalidEmail();
  await testInvalidPassword();
  await testLoginMissingFields();

  // Print results
  printResults();
}

// Run the tests
runTests().catch((error) => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
