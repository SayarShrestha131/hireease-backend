import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

/**
 * File Storage Security Service
 * Provides validation and security functions for file storage operations
 */

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedPath?: string;
}

export interface FileIntegrityResult {
  isValid: boolean;
  checksum?: string;
  error?: string;
}

/**
 * Validates filename to prevent path traversal attacks
 * @param filename - The filename to validate
 * @returns Validation result with sanitized filename
 */
export const validateFilename = (filename: string): FileValidationResult => {
  if (!filename || typeof filename !== 'string') {
    return {
      isValid: false,
      error: 'Filename is required and must be a string'
    };
  }

  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return {
      isValid: false,
      error: 'Invalid filename: path traversal detected'
    };
  }

  // Check for null bytes (security vulnerability)
  if (filename.includes('\0')) {
    return {
      isValid: false,
      error: 'Invalid filename: null byte detected'
    };
  }

  // Check filename length (prevent extremely long filenames)
  if (filename.length > 255) {
    return {
      isValid: false,
      error: 'Filename too long (max 255 characters)'
    };
  }

  // Check for valid characters (alphanumeric, underscore, dash, dot)
  const validFilenameRegex = /^[a-zA-Z0-9._-]+$/;
  if (!validFilenameRegex.test(filename)) {
    return {
      isValid: false,
      error: 'Invalid filename: contains illegal characters'
    };
  }

  return {
    isValid: true,
    sanitizedPath: filename
  };
};

/**
 * Validates that a resolved file path is within the allowed directory
 * @param filePath - The file path to validate
 * @param allowedDirectory - The directory that should contain the file
 * @returns Validation result
 */
export const validatePathWithinDirectory = (
  filePath: string, 
  allowedDirectory: string
): FileValidationResult => {
  try {
    const resolvedPath = path.resolve(filePath);
    const resolvedAllowedDir = path.resolve(allowedDirectory);

    if (!resolvedPath.startsWith(resolvedAllowedDir)) {
      return {
        isValid: false,
        error: 'File path is outside allowed directory'
      };
    }

    return {
      isValid: true,
      sanitizedPath: resolvedPath
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid file path format'
    };
  }
};

/**
 * Generates a secure unique filename with user ID association
 * @param userId - The user ID to associate with the file
 * @param originalFilename - The original filename for extension extraction
 * @returns Secure filename with format: {userId}_{timestamp}_{uuid}.{ext}
 */
export const generateSecureFilename = (userId: string, originalFilename: string): string => {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID();
  const ext = path.extname(originalFilename);
  
  // Sanitize user ID (remove any non-alphanumeric characters)
  const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, '');
  
  return `${sanitizedUserId}_${timestamp}_${uuid}${ext}`;
};

/**
 * Extracts user ID from a secure filename
 * @param filename - The filename to parse
 * @returns User ID if found, null otherwise
 */
export const extractUserIdFromFilename = (filename: string): string | null => {
  // Expected format: {userId}_{timestamp}_{uuid}.{ext}
  const parts = filename.split('_');
  if (parts.length >= 3) {
    return parts[0];
  }
  return null;
};

/**
 * Calculates file integrity checksum
 * @param filePath - Path to the file
 * @returns File integrity result with checksum
 */
export const calculateFileChecksum = async (filePath: string): Promise<FileIntegrityResult> => {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        isValid: false,
        error: 'File does not exist'
      };
    }

    const fileBuffer = fs.readFileSync(filePath);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    return {
      isValid: true,
      checksum
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to calculate checksum: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Validates file exists and is accessible
 * @param filePath - Path to the file
 * @returns Validation result
 */
export const validateFileExists = (filePath: string): FileValidationResult => {
  try {
    if (!fs.existsSync(filePath)) {
      return {
        isValid: false,
        error: 'File does not exist'
      };
    }

    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return {
        isValid: false,
        error: 'Path is not a file'
      };
    }

    return {
      isValid: true,
      sanitizedPath: filePath
    };
  } catch (error) {
    return {
      isValid: false,
      error: `File access error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Comprehensive file security validation
 * @param filename - The filename to validate
 * @param baseDirectory - The base directory for file storage
 * @returns Complete validation result
 */
export const validateFileAccess = (
  filename: string, 
  baseDirectory: string
): FileValidationResult => {
  // Step 1: Validate filename format
  const filenameValidation = validateFilename(filename);
  if (!filenameValidation.isValid) {
    return filenameValidation;
  }

  // Step 2: Construct file path
  const filePath = path.join(baseDirectory, filename);

  // Step 3: Validate path is within allowed directory
  const pathValidation = validatePathWithinDirectory(filePath, baseDirectory);
  if (!pathValidation.isValid) {
    return pathValidation;
  }

  // Step 4: Validate file exists
  const fileValidation = validateFileExists(filePath);
  if (!fileValidation.isValid) {
    return fileValidation;
  }

  return {
    isValid: true,
    sanitizedPath: pathValidation.sanitizedPath
  };
};

/**
 * Validates that a user can access a specific file (based on filename user ID)
 * @param filename - The filename to check
 * @param userId - The user ID requesting access
 * @returns True if user can access the file
 */
export const validateUserFileAccess = (filename: string, userId: string): boolean => {
  const fileUserId = extractUserIdFromFilename(filename);
  return fileUserId === userId;
};