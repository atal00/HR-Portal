import crypto from 'crypto';
import { generateSecret, generateURI, verifySync } from 'otplib';

// ==============================================================================
// VARSAKA HR PORTAL — TOTP AUTHENTICATOR MFA SERVICE
// Standard: RFC 6238 TOTP (SHA-1, 6 digits, 30s period, Issuer: 'Varsaka HR')
// Storage Security: Authenticated AES-256-GCM application-level encryption
// ==============================================================================

const MFA_ISSUER = 'Varsaka HR';
const SESSION_SECRET = process.env.SESSION_SECRET || 'varsaka-hr-enterprise-secure-session-secret-key-2026-xyz';
const MIN_MFA_KEY_LENGTH = 32;

export const MFA_CHALLENGE_COOKIE = {
  name: 'varsaka_mfa_challenge',
  options: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 300, // 5 minutes
  },
};

/**
 * Derives a cryptographically secure 256-bit (32-byte) key for AES-256-GCM.
 * In production (NODE_ENV=production), strictly requires a dedicated MFA_ENCRYPTION_KEY
 * with at least 32 characters entropy. Silent fallback to SESSION_SECRET in production is prohibited.
 */
function getDerivedEncryptionKey(): Buffer {
  const isProd = process.env.NODE_ENV === 'production';
  const mfaKey = process.env.MFA_ENCRYPTION_KEY;

  if (isProd) {
    if (!mfaKey || typeof mfaKey !== 'string' || mfaKey.trim().length < MIN_MFA_KEY_LENGTH) {
      throw new Error(
        'FATAL PRODUCTION SECURITY ERROR: MFA_ENCRYPTION_KEY is required in production and must be at least 32 characters long. Silent fallback to SESSION_SECRET is strictly prohibited.'
      );
    }
    return crypto
      .createHash('sha256')
      .update(`${mfaKey.trim()}:varsaka_mfa_authenticated_encryption_v1`)
      .digest();
  }

  // Development / Test fallback only
  const fallbackKey = mfaKey || process.env.SESSION_SECRET;
  if (!fallbackKey || fallbackKey.trim().length === 0) {
    throw new Error('MFA key derivation error: neither MFA_ENCRYPTION_KEY nor SESSION_SECRET is configured.');
  }

  return crypto
    .createHash('sha256')
    .update(`${fallbackKey.trim()}:varsaka_mfa_authenticated_encryption_v1`)
    .digest();
}

/**
 * Encrypts a TOTP secret using authenticated AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptMfaSecret(plaintextSecret: string): string {
  if (!plaintextSecret) {
    throw new Error('MFA encryption error: secret cannot be empty.');
  }

  const key = getDerivedEncryptionKey();
  const iv = crypto.randomBytes(12); // Recommended 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintextSecret, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag(); // 16 bytes authentication tag

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

/**
 * Decrypts a TOTP secret using authenticated AES-256-GCM.
 * Verifies authenticity before returning the plaintext.
 */
export function decryptMfaSecret(encryptedPayload: string): string {
  if (!encryptedPayload) {
    throw new Error('MFA decryption error: encrypted payload cannot be empty.');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('MFA decryption error: malformed encrypted payload format.');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getDerivedEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch (err: any) {
    throw new Error('MFA decryption failed: authentication tag verification failed.', { cause: err });
  }
}

/**
 * Generates an RFC 4648 Base32 random TOTP secret (160-bit entropy).
 */
export function generateMfaSecret(): string {
  return generateSecret();
}

/**
 * Generates standard interoperable RFC 6238 otpauth URI.
 */
export function generateMfaUri(email: string, secret: string): string {
  return generateURI({
    issuer: MFA_ISSUER,
    label: email,
    secret,
  });
}

/**
 * Verifies a 6-digit TOTP code against the plaintext secret.
 * Enforces window: 1 (+/- 30 seconds clock drift compensation).
 */
export function verifyTotpCode(token: string, secret: string): boolean {
  if (!token || !secret) return false;
  const cleanToken = token.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;

  try {
    const result = verifySync({
      token: cleanToken,
      secret,
      epochTolerance: 30,
    });
    return Boolean(result && result.valid);
  } catch {
    return false;
  }
}

/**
 * Normalizes and hashes a single-use recovery code.
 * Strips whitespace, dashes, and forces uppercase.
 */
export function hashRecoveryCode(rawCode: string): string {
  const normalized = rawCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const key = getDerivedEncryptionKey();
  return crypto.createHmac('sha256', key).update(normalized).digest('hex');
}

/**
 * Generates a set of cryptographically random single-use recovery codes.
 * Returns both the user-facing formatted codes and the stored HMAC hashes.
 */
export function generateRecoveryCodes(count: number = 8): {
  codes: string[];
  hashes: string[];
} {
  const codes: string[] = [];
  const hashes: string[] = [];

  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
    codes.push(formatted);
    hashes.push(hashRecoveryCode(formatted));
  }

  return { codes, hashes };
}

// Server-side cache of consumed challenge nonces to prevent replay
const consumedChallengeNonces = new Map<string, number>();

/**
 * Checks if a challenge nonce has already been consumed.
 */
export function isChallengeNonceConsumed(nonce: string): boolean {
  if (!nonce) return true;
  const expiry = consumedChallengeNonces.get(nonce);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    consumedChallengeNonces.delete(nonce);
    return false;
  }
  return true;
}

/**
 * Marks a challenge nonce as consumed until its expiry (+ 60s safety buffer).
 */
export function markChallengeNonceConsumed(nonce: string, expiresAt?: number): void {
  if (!nonce) return;
  const expiry = expiresAt && expiresAt > Date.now() ? expiresAt + 60 * 1000 : Date.now() + 360 * 1000;
  consumedChallengeNonces.set(nonce, expiry);

  // Periodic eviction if cache grows beyond 2000 entries
  if (consumedChallengeNonces.size > 2000) {
    const now = Date.now();
    for (const [key, exp] of consumedChallengeNonces.entries()) {
      if (now > exp) consumedChallengeNonces.delete(key);
    }
  }
}

/**
 * Signs a short-lived, single-use MFA challenge token (HMAC-SHA256).
 * Bound to the user ID and email, expires in 5 minutes.
 */
export function signMfaChallenge(payload: { userId: string; email: string; nonce?: string }): string {
  const expiresAt = Date.now() + 300 * 1000; // 5 minutes
  const nonce = payload.nonce || crypto.randomBytes(16).toString('hex');
  const data = JSON.stringify({
    userId: payload.userId,
    email: payload.email,
    nonce,
    type: 'mfa_challenge',
    expiresAt,
  });

  const base64Data = Buffer.from(data).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(base64Data)
    .digest('base64url');

  return `${base64Data}.${signature}`;
}

/**
 * Verifies and decodes an MFA challenge token.
 * Returns the bound userId, email, nonce, and expiresAt if valid and unexpired; otherwise null.
 */
export function verifyMfaChallenge(token: string): {
  userId: string;
  email: string;
  nonce: string;
  expiresAt: number;
} | null {
  try {
    if (!token) return null;
    const [base64Data, signature] = token.split('.');
    if (!base64Data || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(base64Data)
      .digest('base64url');

    if (signature !== expectedSignature) return null;

    const parsed = JSON.parse(Buffer.from(base64Data, 'base64url').toString('utf8'));
    if (parsed.type !== 'mfa_challenge') return null;
    if (Date.now() > parsed.expiresAt) return null;
    if (!parsed.userId || !parsed.email || !parsed.nonce) return null;

    return {
      userId: parsed.userId,
      email: parsed.email,
      nonce: parsed.nonce,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}
