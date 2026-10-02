import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const UPPERCASE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluded I, O
const LOWERCASE_CHARS = 'abcdefghijkmnopqrstuvwxyz'; // Excluded l
const NUMBER_CHARS = '23456789'; // Excluded 0, 1
const SYMBOL_CHARS = '!@#$%^&*_-+=';

/**
 * Generates an unguessable, cryptographically secure temporary password.
 * Guaranteed to satisfy all enterprise password policy requirements:
 * uppercase, lowercase, numbers, and special symbols.
 */
export function generateSecureTemporaryPassword(length: number = 14): string {
  if (length < 10) length = 14;

  // Ensure at least 2 of each required class
  const passwordChars: string[] = [
    UPPERCASE_CHARS[crypto.randomInt(0, UPPERCASE_CHARS.length)],
    UPPERCASE_CHARS[crypto.randomInt(0, UPPERCASE_CHARS.length)],
    LOWERCASE_CHARS[crypto.randomInt(0, LOWERCASE_CHARS.length)],
    LOWERCASE_CHARS[crypto.randomInt(0, LOWERCASE_CHARS.length)],
    NUMBER_CHARS[crypto.randomInt(0, NUMBER_CHARS.length)],
    NUMBER_CHARS[crypto.randomInt(0, NUMBER_CHARS.length)],
    SYMBOL_CHARS[crypto.randomInt(0, SYMBOL_CHARS.length)],
    SYMBOL_CHARS[crypto.randomInt(0, SYMBOL_CHARS.length)],
  ];

  const allChars = UPPERCASE_CHARS + LOWERCASE_CHARS + NUMBER_CHARS + SYMBOL_CHARS;
  while (passwordChars.length < length) {
    const randomByte = crypto.randomInt(0, allChars.length);
    passwordChars.push(allChars[randomByte]);
  }

  // Cryptographic Durstenfeld shuffle
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join('');
}

/**
 * Hashes a plaintext password using bcrypt with salt rounds = 10
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Validates a plaintext password against a stored bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Validates password complexity policy
 */
export function validatePasswordPolicy(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must include at least one uppercase letter (A-Z).');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must include at least one lowercase letter (a-z).');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must include at least one numeric digit (0-9).');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Password must include at least one special character (!@#$%^&*...).');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
