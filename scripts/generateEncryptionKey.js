#!/usr/bin/env node

/**
 * Generate Encryption Master Key
 * 
 * Generates a secure AES-256 encryption master key for encrypting payment gateway credentials.
 * The generated key should be stored securely in environment variables.
 * 
 * Usage:
 *   node scripts/generateEncryptionKey.js
 */

const crypto = require('crypto');

console.log('\n=== Encryption Master Key Generator ===\n');
console.log('Generating a secure 256-bit (32-byte) encryption key...\n');

// Generate 32 random bytes (256 bits) for AES-256
const masterKey = crypto.randomBytes(32);

// Encode as base64 for easy storage in environment variables
const base64Key = masterKey.toString('base64');

console.log('Generated Encryption Master Key:');
console.log('--------------------------------');
console.log(base64Key);
console.log('--------------------------------\n');

console.log('IMPORTANT SECURITY INSTRUCTIONS:');
console.log('1. Copy the key above and add it to your .env file:');
console.log('   ENCRYPTION_MASTER_KEY=' + base64Key);
console.log('');
console.log('2. NEVER commit this key to version control');
console.log('3. Store this key securely (use a password manager)');
console.log('4. In production, use a Key Management Service (KMS):');
console.log('   - AWS KMS');
console.log('   - Azure Key Vault');
console.log('   - HashiCorp Vault');
console.log('   - Google Cloud KMS');
console.log('');
console.log('5. If this key is lost, you will NOT be able to decrypt');
console.log('   existing encrypted credentials');
console.log('');
console.log('6. Rotate this key periodically (every 90 days recommended)');
console.log('');
console.log('7. Keep a secure backup of this key in case of emergency');
console.log('');
console.log('=====================================\n');
