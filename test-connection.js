/**
 * Simple connection test script
 * Run this to verify the backend is accessible
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/health',
  method: 'GET',
};

console.log('Testing connection to backend...');
console.log(`URL: http://${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
  console.log(`\n✓ Connection successful!`);
  console.log(`Status Code: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse:');
    console.log(JSON.parse(data));
  });
});

req.on('error', (error) => {
  console.error(`\n✗ Connection failed!`);
  console.error(`Error: ${error.message}`);
});

req.end();
