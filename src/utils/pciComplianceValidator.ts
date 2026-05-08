import https from 'https';

/**
 * PCI DSS Compliance Validator
 * 
 * Validates that the payment system adheres to PCI DSS requirements.
 * Provides runtime checks and validation for security compliance.
 * 
 * Requirements: 4.5, 4.6, 17.1, 17.2, 17.3, 17.5, 17.6, 17.7
 */

/**
 * Compliance Check Result
 */
export interface ComplianceCheckResult {
  passed: boolean;
  requirement: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

/**
 * Validate that no CVV/CVC codes are present in data
 * 
 * @param data - Data object to validate
 * @returns True if no CVV codes found
 * 
 * Requirements: 17.1
 */
export function validateNoCVVStorage(data: any): ComplianceCheckResult {
  const cvvFields = ['cvv', 'cvc', 'cvv2', 'cvc2', 'card_cvv', 'card_cvc', 'security_code'];
  
  const checkObject = (obj: any, path: string = ''): string | null => {
    if (typeof obj !== 'object' || obj === null) return null;
    
    for (const key in obj) {
      const lowerKey = key.toLowerCase();
      
      // Check if key matches CVV field names
      if (cvvFields.some(field => lowerKey.includes(field))) {
        return `${path}.${key}`;
      }
      
      // Recursively check nested objects
      if (typeof obj[key] === 'object') {
        const found = checkObject(obj[key], `${path}.${key}`);
        if (found) return found;
      }
    }
    
    return null;
  };
  
  const cvvField = checkObject(data);
  
  if (cvvField) {
    return {
      passed: false,
      requirement: '17.1 - No CVV Storage',
      message: `CRITICAL: CVV/CVC code found in data at path: ${cvvField}. This violates PCI DSS requirements.`,
      severity: 'critical',
    };
  }
  
  return {
    passed: true,
    requirement: '17.1 - No CVV Storage',
    message: 'No CVV/CVC codes found in data',
    severity: 'info',
  };
}

/**
 * Validate that no complete card numbers are present in data
 * 
 * Checks for patterns that look like credit card numbers (13-19 digits)
 * 
 * @param data - Data object or string to validate
 * @returns True if no complete card numbers found
 * 
 * Requirements: 4.5, 17.2
 */
export function validateNoCompleteCardNumbers(data: any): ComplianceCheckResult {
  // Regex pattern for credit card numbers (13-19 digits, with optional spaces/dashes)
  const cardNumberPattern = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4,7}\b/g;
  
  const checkValue = (value: any, path: string = ''): string | null => {
    if (typeof value === 'string') {
      // Remove common separators
      const cleaned = value.replace(/[\s-]/g, '');
      
      // Check if it looks like a card number (13-19 digits)
      if (/^\d{13,19}$/.test(cleaned)) {
        return path || 'root';
      }
      
      // Check for card number patterns in the string
      if (cardNumberPattern.test(value)) {
        return path || 'root';
      }
    } else if (typeof value === 'object' && value !== null) {
      for (const key in value) {
        const found = checkValue(value[key], path ? `${path}.${key}` : key);
        if (found) return found;
      }
    }
    
    return null;
  };
  
  const cardNumberPath = checkValue(data);
  
  if (cardNumberPath) {
    return {
      passed: false,
      requirement: '17.2 - No Complete Card Numbers',
      message: `CRITICAL: Potential complete card number found at path: ${cardNumberPath}. This violates PCI DSS requirements.`,
      severity: 'critical',
    };
  }
  
  return {
    passed: true,
    requirement: '17.2 - No Complete Card Numbers',
    message: 'No complete card numbers found in data',
    severity: 'info',
  };
}

/**
 * Validate that gateway-hosted payment pages are being used
 * 
 * Checks that payment methods use redirect URLs or client secrets (not direct card input)
 * 
 * @param paymentMethod - Payment method being used
 * @param paymentData - Payment initiation data
 * @returns Compliance check result
 * 
 * Requirements: 17.3
 */
export function validateGatewayHostedPages(
  paymentMethod: string,
  paymentData: any
): ComplianceCheckResult {
  // Khalti and PayPal should have payment URLs (redirect)
  if ((paymentMethod === 'khalti' || paymentMethod === 'paypal') && !paymentData.paymentUrl) {
    return {
      passed: false,
      requirement: '17.3 - Gateway-Hosted Payment Pages',
      message: `${paymentMethod} payment should use gateway-hosted redirect URL`,
      severity: 'critical',
    };
  }
  
  // Stripe should have client secret (for Stripe Elements)
  if (paymentMethod === 'stripe' && !paymentData.clientSecret) {
    return {
      passed: false,
      requirement: '17.3 - Gateway-Hosted Payment Pages',
      message: 'Stripe payment should use client secret for Stripe Elements',
      severity: 'critical',
    };
  }
  
  return {
    passed: true,
    requirement: '17.3 - Gateway-Hosted Payment Pages',
    message: `Payment method ${paymentMethod} uses gateway-hosted payment page`,
    severity: 'info',
  };
}

/**
 * Validate TLS version for HTTPS connections
 * 
 * Ensures TLS 1.2 or higher is being used
 * 
 * @returns Compliance check result
 * 
 * Requirements: 4.6, 17.5
 */
export function validateTLSVersion(): ComplianceCheckResult {
  // Check Node.js TLS configuration
  const minVersion = https.globalAgent.options.minVersion;
  const maxVersion = https.globalAgent.options.maxVersion;
  
  // TLS 1.2 is represented as 'TLSv1.2' in Node.js
  const supportedVersions = ['TLSv1.2', 'TLSv1.3'];
  
  // If minVersion is not set, Node.js defaults to TLS 1.2+
  if (!minVersion || supportedVersions.includes(minVersion)) {
    return {
      passed: true,
      requirement: '17.5 - TLS 1.2+ Enforcement',
      message: `TLS configuration valid. Min version: ${minVersion || 'TLSv1.2 (default)'}`,
      severity: 'info',
    };
  }
  
  return {
    passed: false,
    requirement: '17.5 - TLS 1.2+ Enforcement',
    message: `TLS version ${minVersion} is below required TLS 1.2. Update Node.js TLS configuration.`,
    severity: 'critical',
  };
}

/**
 * Validate that API credentials are encrypted
 * 
 * Checks if encryption master key is configured
 * 
 * @returns Compliance check result
 * 
 * Requirements: 17.4
 */
export function validateCredentialEncryption(): ComplianceCheckResult {
  const masterKey = process.env.ENCRYPTION_MASTER_KEY;
  
  if (!masterKey) {
    if (process.env.NODE_ENV === 'production') {
      return {
        passed: false,
        requirement: '17.4 - Credential Encryption',
        message: 'CRITICAL: ENCRYPTION_MASTER_KEY not set in production environment',
        severity: 'critical',
      };
    }
    
    return {
      passed: true,
      requirement: '17.4 - Credential Encryption',
      message: 'WARNING: ENCRYPTION_MASTER_KEY not set (development mode)',
      severity: 'warning',
    };
  }
  
  // Validate key length (should be 32 bytes base64 encoded = 44 characters)
  const keyBuffer = Buffer.from(masterKey, 'base64');
  if (keyBuffer.length !== 32) {
    return {
      passed: false,
      requirement: '17.4 - Credential Encryption',
      message: `Invalid ENCRYPTION_MASTER_KEY length. Expected 32 bytes, got ${keyBuffer.length}`,
      severity: 'critical',
    };
  }
  
  return {
    passed: true,
    requirement: '17.4 - Credential Encryption',
    message: 'Credential encryption properly configured with AES-256',
    severity: 'info',
  };
}

/**
 * Validate that authentication is required for payment APIs
 * 
 * @param isAuthenticated - Whether the request is authenticated
 * @returns Compliance check result
 * 
 * Requirements: 17.7
 */
export function validateAuthenticationRequired(isAuthenticated: boolean): ComplianceCheckResult {
  if (!isAuthenticated) {
    return {
      passed: false,
      requirement: '17.7 - Authentication Required',
      message: 'Payment API access requires authentication',
      severity: 'critical',
    };
  }
  
  return {
    passed: true,
    requirement: '17.7 - Authentication Required',
    message: 'Request is properly authenticated',
    severity: 'info',
  };
}

/**
 * Run all PCI DSS compliance checks
 * 
 * @param context - Context data for validation
 * @returns Array of compliance check results
 */
export function runComplianceChecks(context: {
  data?: any;
  paymentMethod?: string;
  paymentData?: any;
  isAuthenticated?: boolean;
}): ComplianceCheckResult[] {
  const results: ComplianceCheckResult[] = [];
  
  // Check for CVV storage
  if (context.data) {
    results.push(validateNoCVVStorage(context.data));
    results.push(validateNoCompleteCardNumbers(context.data));
  }
  
  // Check gateway-hosted pages
  if (context.paymentMethod && context.paymentData) {
    results.push(validateGatewayHostedPages(context.paymentMethod, context.paymentData));
  }
  
  // Check TLS version
  results.push(validateTLSVersion());
  
  // Check credential encryption
  results.push(validateCredentialEncryption());
  
  // Check authentication
  if (context.isAuthenticated !== undefined) {
    results.push(validateAuthenticationRequired(context.isAuthenticated));
  }
  
  return results;
}

/**
 * Log compliance check results
 * 
 * @param results - Compliance check results
 */
export function logComplianceResults(results: ComplianceCheckResult[]): void {
  console.log('\n=== PCI DSS Compliance Check Results ===');
  
  let criticalCount = 0;
  let warningCount = 0;
  let passedCount = 0;
  
  results.forEach(result => {
    const icon = result.passed ? '✓' : '✗';
    const severityLabel = result.severity.toUpperCase();
    
    console.log(`${icon} [${severityLabel}] ${result.requirement}`);
    console.log(`  ${result.message}`);
    
    if (!result.passed && result.severity === 'critical') {
      criticalCount++;
    } else if (result.severity === 'warning') {
      warningCount++;
    } else if (result.passed) {
      passedCount++;
    }
  });
  
  console.log('\n=== Summary ===');
  console.log(`Passed: ${passedCount}`);
  console.log(`Warnings: ${warningCount}`);
  console.log(`Critical Issues: ${criticalCount}`);
  console.log('=====================================\n');
  
  if (criticalCount > 0) {
    console.error('CRITICAL: PCI DSS compliance violations detected. Please address immediately.');
  }
}

/**
 * Sanitize log message to remove sensitive data
 * 
 * @param message - Log message
 * @returns Sanitized message
 * 
 * Requirements: 17.2
 */
export function sanitizeLogMessage(message: string): string {
  // Remove potential card numbers (replace with masked version)
  let sanitized = message.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4,7}\b/g, '****-****-****-****');
  
  // Remove potential CVV codes (3-4 digits after keywords)
  sanitized = sanitized.replace(/\b(cvv|cvc|security_code)[\s:=]+\d{3,4}\b/gi, '$1: ***');
  
  return sanitized;
}
