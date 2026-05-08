import crypto from 'crypto';

/**
 * Credential Encryption Utility
 * 
 * Provides AES-256 encryption for sensitive payment gateway credentials.
 * Implements PCI DSS requirement for encrypting API credentials at rest.
 * 
 * Requirements: 4.4, 17.4
 */

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;

/**
 * Encrypted Data Structure
 */
export interface EncryptedData {
  encrypted: string; // Base64 encoded encrypted data
  iv: string; // Base64 encoded initialization vector
  authTag: string; // Base64 encoded authentication tag
  salt: string; // Base64 encoded salt (for key derivation)
}

/**
 * Get or generate encryption master key from environment
 * 
 * In production, this should be stored in a secure key management service (KMS)
 * like AWS KMS, Azure Key Vault, or HashiCorp Vault.
 * 
 * @returns Master encryption key
 */
function getMasterKey(): Buffer {
  const masterKeyEnv = process.env.ENCRYPTION_MASTER_KEY;
  
  if (!masterKeyEnv) {
    // In development, generate a temporary key
    // WARNING: This should NEVER be used in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_MASTER_KEY must be set in production environment');
    }
    
    console.warn('[Security] WARNING: Using temporary encryption key. Set ENCRYPTION_MASTER_KEY in production!');
    return crypto.randomBytes(KEY_LENGTH);
  }
  
  // Decode base64 master key
  const masterKey = Buffer.from(masterKeyEnv, 'base64');
  
  if (masterKey.length !== KEY_LENGTH) {
    throw new Error(`Invalid ENCRYPTION_MASTER_KEY length. Expected ${KEY_LENGTH} bytes, got ${masterKey.length}`);
  }
  
  return masterKey;
}

/**
 * Derive encryption key from master key using PBKDF2
 * 
 * @param masterKey - Master encryption key
 * @param salt - Salt for key derivation
 * @returns Derived encryption key
 */
function deriveKey(masterKey: Buffer, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt sensitive credential data using AES-256-GCM
 * 
 * @param plaintext - Plain text credential to encrypt
 * @returns Encrypted data with IV, auth tag, and salt
 * 
 * Requirements: 4.4, 17.4
 */
export function encryptCredential(plaintext: string): EncryptedData {
  try {
    // Get master key
    const masterKey = getMasterKey();
    
    // Generate random salt for key derivation
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Derive encryption key from master key
    const key = deriveKey(masterKey, salt);
    
    // Generate random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      salt: salt.toString('base64'),
    };
  } catch (error: any) {
    console.error('[Encryption] Failed to encrypt credential:', error.message);
    throw new Error('Failed to encrypt credential');
  }
}

/**
 * Decrypt credential data using AES-256-GCM
 * 
 * @param encryptedData - Encrypted data with IV, auth tag, and salt
 * @returns Decrypted plain text credential
 * 
 * Requirements: 4.4, 17.4
 */
export function decryptCredential(encryptedData: EncryptedData): string {
  try {
    // Get master key
    const masterKey = getMasterKey();
    
    // Decode base64 values
    const salt = Buffer.from(encryptedData.salt, 'base64');
    const iv = Buffer.from(encryptedData.iv, 'base64');
    const authTag = Buffer.from(encryptedData.authTag, 'base64');
    
    // Derive encryption key from master key
    const key = deriveKey(masterKey, salt);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt data
    let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    console.error('[Encryption] Failed to decrypt credential:', error.message);
    throw new Error('Failed to decrypt credential - data may be corrupted or key is invalid');
  }
}

/**
 * Generate a new master encryption key
 * 
 * This should be run once during initial setup and the key should be stored securely.
 * 
 * @returns Base64 encoded master key
 */
export function generateMasterKey(): string {
  const masterKey = crypto.randomBytes(KEY_LENGTH);
  return masterKey.toString('base64');
}

/**
 * Validate that encryption is properly configured
 * 
 * @returns True if encryption is properly configured
 */
export function validateEncryptionConfig(): boolean {
  try {
    // Test encryption/decryption
    const testData = 'test_credential_12345';
    const encrypted = encryptCredential(testData);
    const decrypted = decryptCredential(encrypted);
    
    if (decrypted !== testData) {
      console.error('[Encryption] Validation failed: decrypted data does not match original');
      return false;
    }
    
    console.log('[Encryption] ✓ Encryption configuration validated successfully');
    return true;
  } catch (error: any) {
    console.error('[Encryption] Validation failed:', error.message);
    return false;
  }
}

/**
 * Mask sensitive credential for logging
 * 
 * Shows only first 4 and last 4 characters, masks the rest
 * 
 * @param credential - Credential to mask
 * @returns Masked credential
 */
export function maskCredential(credential: string): string {
  if (!credential || credential.length <= 8) {
    return '****';
  }
  
  const first4 = credential.substring(0, 4);
  const last4 = credential.substring(credential.length - 4);
  const masked = '*'.repeat(Math.min(credential.length - 8, 20));
  
  return `${first4}${masked}${last4}`;
}
