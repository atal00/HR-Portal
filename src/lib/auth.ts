import { cookies } from 'next/headers';
import crypto from 'crypto';
import { cache } from 'react';
import { SessionUser } from '@/types/auth';
import { PermissionCode } from '@/types/database';
import { hasPermission } from './rbac';

import { INACTIVITY_TIMEOUT_MS, LAST_ACTIVITY_COOKIE_NAME } from './inactivity-constants';
export { INACTIVITY_TIMEOUT_MS, LAST_ACTIVITY_COOKIE_NAME };

const SESSION_COOKIE_NAME = 'varsaka_session';

/**
 * Retrieves the cryptographic secret for session signing and verification.
 * In production (NODE_ENV === 'production' or STORAGE_MODE === 'supabase'),
 * strictly requires a valid SESSION_SECRET from the environment.
 * Silent fallback to static defaults in production is strictly prohibited.
 */
export function getSessionSecret(): string {
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.STORAGE_MODE === 'supabase' ||
    process.env.NEXT_PUBLIC_APP_URL?.includes('varsaka.com') === true;
  const secret = process.env.SESSION_SECRET;

  if (isProd) {
    if (!secret || typeof secret !== 'string' || secret.trim().length < 32 || secret.includes('placeholder')) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: SESSION_SECRET is not configured or insufficient in production. A minimum 32-character secret is required.'
      );
    }
    return secret.trim();
  }

  // Development / Test fallback only
  return (secret && secret.trim()) || 'varsaka-hr-enterprise-secure-session-secret-key-2026-xyz';
}

export function signSessionPayload(user: SessionUser, maxAgeSeconds: number = 86400): string {
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  const data = JSON.stringify({ user, expiresAt });
  const base64Data = Buffer.from(data).toString('base64url');
  const secret = getSessionSecret();
  const signature = crypto.createHmac('sha256', secret).update(base64Data).digest('base64url');
  return `${base64Data}.${signature}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const [base64Data, signature] = token.split('.');
    if (!base64Data || !signature) return null;

    const secret = getSessionSecret();
    const expectedSignature = crypto.createHmac('sha256', secret).update(base64Data).digest('base64url');
    if (signature !== expectedSignature) return null;

    const parsed = JSON.parse(Buffer.from(base64Data, 'base64url').toString('utf-8'));
    if (Date.now() > parsed.expiresAt) return null;

    return parsed.user || null;
  } catch {
    return null;
  }
}

/**
 * Server-side getter for authenticated user session from HTTP cookies.
 * Validates session signature, user active status, session_version,
 * verifies 20-minute inactivity timeout, and derives authoritative role
 * and permissions from the database.
 * Wrapped in React.cache() for request-scoped deduplication across Server Components.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    // Check server-side 20-minute inactivity expiration
    const lastActivityCookie = cookieStore.get(LAST_ACTIVITY_COOKIE_NAME)?.value;
    if (lastActivityCookie) {
      const lastActivityTime = parseInt(lastActivityCookie, 10);
      if (!isNaN(lastActivityTime) && Date.now() - lastActivityTime > INACTIVITY_TIMEOUT_MS) {
        return null;
      }
    }

    const sessionUser = verifySessionToken(token);
    if (!sessionUser || !sessionUser.id) return null;

    // Dynamic import to prevent circular dependency with db.ts
    const { db } = await import('@/lib/db');

    // Run user lookup and MFA status check concurrently in parallel
    const [dbUser, userMfa] = await Promise.all([
      db.users.getById(sessionUser.id),
      db.userMfa.getByUserId(sessionUser.id),
    ]);

    if (!dbUser || !dbUser.is_active) {
      return null;
    }

    // Authoritative session_version is already loaded onto dbUser by db.users.getById
    const currentVersion = dbUser.session_version ?? null;
    if (currentVersion !== null) {
      if (!sessionUser.session_version || sessionUser.session_version !== currentVersion) {
        return null;
      }
    }

    // Authoritative MFA status check
    const isMfaEnabled = Boolean(userMfa && userMfa.is_enabled && userMfa.is_verified);

    // Authoritative server-side role and permissions
    return {
      id: dbUser.id,
      email: dbUser.email,
      full_name: dbUser.full_name,
      role: dbUser.role,
      permissions: dbUser.permissions,
      department: dbUser.department,
      must_change_password: dbUser.must_change_password ?? false,
      session_version: currentVersion ?? sessionUser.session_version,
      mfa_enabled: isMfaEnabled,
    };
  } catch {
    return null;
  }
});

export class AuthError extends Error {
  status: number;
  constructor(message: string = 'UNAUTHORIZED: Authentication session required.', status: number = 401) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

/**
 * Server-side guard requiring authentication
 */
export async function requireAuthUser(options: { 
  allowPendingPasswordChange?: boolean;
  allowPendingMfaSetup?: boolean;
} = {}): Promise<SessionUser> {
  // Test-only mock authentication hook: strictly honored ONLY when process.env.NODE_ENV === 'test'.
  // In production (or any non-test environment), this mock hook MUST NEVER influence authentication.
  if (process.env.NODE_ENV === 'test' && (global as any).__mockAuthUser) {
    return (global as any).__mockAuthUser;
  }
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError('UNAUTHORIZED: Authentication session required.', 401);
  }
  if (user.must_change_password && !options.allowPendingPasswordChange) {
    throw new AuthError('PASSWORD_CHANGE_REQUIRED: Mandatory password change required before accessing portal.', 403);
  }
  if (!user.mfa_enabled && !options.allowPendingMfaSetup) {
    throw new AuthError('MFA_ENROLLMENT_REQUIRED: Mandatory MFA enrollment required before accessing portal.', 403);
  }
  return user;
}

/**
 * Server-side guard requiring a specific permission
 */
export async function requireUserPermission(permission: PermissionCode): Promise<SessionUser> {
  const user = await requireAuthUser();
  if (!hasPermission(user, permission)) {
    throw new Error(`FORBIDDEN: Missing required permission '${permission}'.`);
  }
  return user;
}

export const AUTH_COOKIE = {
  name: SESSION_COOKIE_NAME,
  options: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 86400, // 24 hours
  },
};

export const LAST_ACTIVITY_COOKIE = {
  name: LAST_ACTIVITY_COOKIE_NAME,
  options: {
    httpOnly: false, // Client JavaScript needs access to update activity on user interaction
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 86400,
  },
};
