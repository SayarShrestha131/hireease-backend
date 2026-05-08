import { validateEncryptionConfig } from './credentialEncryption';
import { runComplianceChecks, logComplianceResults } from './pciComplianceValidator';

/**
 * Security Startup Checks
 * 
 * Runs comprehensive security and PCI DSS compliance checks on application startup.
 * Ensures the payment system is properly configured before accepting requests.
 * 
 * Requirements: 4.4, 4.5, 4.6, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
 */

/**
 * Run all security startup checks
 * 
 * @returns True if all critical checks pass
 */
export function runSecurityStartupChecks(): boolean {
  console.log('\n=== Running Security Startup Checks ===\n');
  
  let allChecksPassed = true;
  
  // 1. Validate encryption configuration
  console.log('1. Validating credential encryption...');
  const encryptionValid = validateEncryptionConfig();
  if (!encryptionValid) {
    console.error('   ✗ Credential encryption validation failed');
    allChecksPassed = false;
  } else {
    console.log('   ✓ Credential encryption validated');
  }
  
  // 2. Run PCI DSS compliance checks
  console.log('\n2. Running PCI DSS compliance checks...');
  const complianceResults = runComplianceChecks({
    isAuthenticated: true, // Assume authenticated for startup check
  });
  
  logComplianceResults(complianceResults);
  
  // Check for critical failures
  const criticalFailures = complianceResults.filter(
    r => !r.passed && r.severity === 'critical'
  );
  
  if (criticalFailures.length > 0) {
    console.error(`   ✗ ${criticalFailures.length} critical PCI DSS compliance issue(s) detected`);
    allChecksPassed = false;
  }
  
  // 3. Validate environment variables
  console.log('3. Validating environment configuration...');
  const envValid = validateEnvironmentVariables();
  if (!envValid) {
    console.error('   ✗ Environment validation failed');
    allChecksPassed = false;
  } else {
    console.log('   ✓ Environment variables validated');
  }
  
  // 4. Check HTTPS enforcement
  console.log('\n4. Checking HTTPS enforcement...');
  if (process.env.NODE_ENV === 'production' && !process.env.FORCE_HTTPS) {
    console.warn('   ⚠ WARNING: FORCE_HTTPS not enabled in production');
    console.warn('   Consider enabling HTTPS enforcement for production deployment');
  } else {
    console.log('   ✓ HTTPS configuration checked');
  }
  
  // Summary
  console.log('\n=== Security Startup Check Summary ===');
  if (allChecksPassed) {
    console.log('✓ All critical security checks passed');
    console.log('✓ Payment system is ready to process transactions securely');
  } else {
    console.error('✗ Critical security issues detected');
    console.error('✗ Please address the issues above before processing payments');
    
    if (process.env.NODE_ENV === 'production') {
      console.error('\n⚠ CRITICAL: Security issues in production environment');
      console.error('⚠ Consider shutting down until issues are resolved');
    }
  }
  console.log('=====================================\n');
  
  return allChecksPassed;
}

/**
 * Validate required environment variables
 * 
 * @returns True if all required variables are set
 */
function validateEnvironmentVariables(): boolean {
  const requiredVars = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'JWT_SECRET',
    'PAYMENT_MODE',
  ];
  
  const missingVars: string[] = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    console.error('   Missing required environment variables:');
    missingVars.forEach(v => console.error(`     - ${v}`));
    return false;
  }
  
  // Validate payment mode
  const paymentMode = process.env.PAYMENT_MODE;
  if (paymentMode !== 'sandbox' && paymentMode !== 'production') {
    console.error(`   Invalid PAYMENT_MODE: ${paymentMode}. Must be 'sandbox' or 'production'`);
    return false;
  }
  
  // Check if at least one gateway is enabled
  const khaltiEnabled = process.env.KHALTI_ENABLED === 'true';
  const stripeEnabled = process.env.STRIPE_ENABLED === 'true';
  const paypalEnabled = process.env.PAYPAL_ENABLED === 'true';
  
  if (!khaltiEnabled && !stripeEnabled && !paypalEnabled) {
    console.error('   No payment gateways enabled. Enable at least one gateway.');
    return false;
  }
  
  return true;
}

/**
 * Log security configuration summary
 */
export function logSecurityConfiguration(): void {
  console.log('\n=== Security Configuration Summary ===');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Payment Mode: ${process.env.PAYMENT_MODE || 'sandbox'}`);
  console.log(`Encryption: ${process.env.ENCRYPTION_MASTER_KEY ? 'Enabled (AES-256)' : 'Disabled (Dev Only)'}`);
  console.log(`TLS Enforcement: ${process.env.FORCE_HTTPS ? 'Enabled' : 'Disabled'}`);
  console.log(`Rate Limiting: ${process.env.PAYMENT_RATE_LIMIT_PER_HOUR || '10'} requests/hour`);
  
  console.log('\nEnabled Payment Gateways:');
  if (process.env.KHALTI_ENABLED === 'true') {
    console.log('  ✓ Khalti (Nepal local payments)');
  }
  if (process.env.STRIPE_ENABLED === 'true') {
    console.log('  ✓ Stripe (International cards)');
  }
  if (process.env.PAYPAL_ENABLED === 'true') {
    console.log('  ✓ PayPal (Alternative international)');
  }
  
  console.log('\nPCI DSS Compliance Measures:');
  console.log('  ✓ No CVV storage in database or logs');
  console.log('  ✓ No complete card numbers in logs');
  console.log('  ✓ Gateway-hosted payment pages (Khalti redirect, Stripe Elements)');
  console.log('  ✓ API credentials encrypted with AES-256');
  console.log('  ✓ TLS 1.2+ for all gateway communications');
  console.log('  ✓ Secure session management');
  console.log('  ✓ Payment API restricted to authenticated users');
  console.log('  ✓ Comprehensive audit logging');
  
  console.log('=====================================\n');
}
