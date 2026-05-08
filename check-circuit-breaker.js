/**
 * Check Circuit Breaker Status
 */

require('dotenv').config();

async function checkCircuitBreaker() {
  try {
    console.log('🔍 Checking Circuit Breaker Status\n');

    const circuitBreakerService = require('./dist/services/circuitBreakerService').default;

    // Check all gateways
    const gateways = ['esewa', 'khalti', 'stripe', 'paypal'];

    console.log('=== Circuit Breaker Status ===\n');

    for (const gateway of gateways) {
      const isAvailable = circuitBreakerService.isAvailable(gateway);
      const status = circuitBreakerService.getStatus(gateway);

      console.log(`${gateway.toUpperCase()}:`);
      console.log(`  Available: ${isAvailable ? '✅ YES' : '❌ NO'}`);
      console.log(`  State: ${status.state}`);
      console.log(`  Failure Count: ${status.failureCount}`);
      console.log(`  Last Failure: ${status.lastFailureTime || 'Never'}`);
      console.log(`  Next Retry: ${status.nextRetryTime || 'N/A'}`);
      console.log('');
    }

    console.log('=== Availability Summary ===');
    const availabilityStatus = circuitBreakerService.getAvailabilityStatus();
    console.log(JSON.stringify(availabilityStatus, null, 2));

    console.log('\n💡 To reset circuit breaker for eSewa:');
    console.log('   circuitBreakerService.reset("esewa")');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkCircuitBreaker();
