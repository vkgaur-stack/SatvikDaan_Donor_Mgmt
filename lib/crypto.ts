// utils/crypto.ts - Encryption/Decryption utilities for PII

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCODING = 'hex';

/**
 * Encrypt sensitive data (PII fields)
 * Note: In production, use robust key management (AWS KMS, HashiCorp Vault, etc.)
 * @param text - Plain text to encrypt
 * @returns Encrypted string in format: iv:encrypted
 */
export function encryptField(text: string): string {
  if (!text) return '';

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY not configured in environment');
  }

  // Ensure key is exactly 32 bytes (256 bits)
  const key = Buffer.from(encryptionKey, 'base64').slice(0, 32);

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', ENCODING);
  encrypted += cipher.final(ENCODING);

  // Return as: iv:encrypted
  return `${iv.toString(ENCODING)}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 * @param encryptedText - Encrypted string in format: iv:encrypted
 * @returns Decrypted plain text
 */
export function decryptField(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return '';

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY not configured in environment');
  }

  try {
    const key = Buffer.from(encryptionKey, 'base64').slice(0, 32);
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], ENCODING);
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, ENCODING, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

/**
 * Hash a value (for biometric data, fingerprints)
 * @param value - Value to hash
 * @returns SHA256 hash
 */
export function hashField(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Verify Razorpay webhook signature
 * @param body - Request body string
 * @param signature - Signature from header
 * @returns True if signature is valid
 */
export function verifyRazorpaySignature(
  body: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error('RAZORPAY_KEY_SECRET not configured');
  }

  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return hash === signature;
}

/**
 * Generate a random token (for OTP, reset tokens, etc.)
 * @param length - Length of token
 * @returns Random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash password using PBKDF2
 * @param password - Plain password
 * @returns Hashed password
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');

  return `${salt}:${hash}`;
}

/**
 * Verify password against hash
 * @param password - Plain password to verify
 * @param hash - Stored hash
 * @returns True if password matches
 */
export function verifyPassword(password: string, hash: string): boolean {
  const parts = hash.split(':');
  const salt = parts[0];

  const computedHash = crypto
    .pbkdf2Sync(password, salt, 1000, 64, 'sha512')
    .toString('hex');

  return computedHash === parts[1];
}
