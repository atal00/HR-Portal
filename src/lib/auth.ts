import { cookies } from 'next/headers';
import crypto from 'crypto';
import { SessionUser } from '@/types/auth';
import { PermissionCode } from '@/types/database';
import { hasPermission } from './rbac';

const SESSION_COOKIE_NAME = 'varsaka_session';
const SECRET = process.env.SESSION_SECRET || 'varsaka-hr-enterprise-secure-session-secret-key-2026-xyz';

export function signSessionPayload(user: SessionUser, maxAgeSeconds: number = 86400): string {
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  const data = JSON.stringify({ user, expiresAt });
  const base64Data = Buffer.from(data).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(base64Data).digest('base64url');
  return `${base64Data}.${signature}`;
}

export function verifySessionToken(token: string): SessionUser | null {
  try {
    const [base64Data, signature] = token.split('.');
    if (!base64Data || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', SECRET).update(base64Data).digest('base64url');
    if (signature !== expectedSignature) return null;

    const parsed = JSON.parse(Buffer.from(base64Data, 'base64url').toString('utf-8'));
    if (Date.now() > parsed.expiresAt) return null;

    return parsed.user;
  } catch {
    return null;
  }
}

/**
 * Server-side getter for authenticated user session from HTTP cookies.
 * Validates session signature, user active status, session_version,
 * and derives authoritative role and permissions from the database.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const sessionUser = verifySessionToken(token);
    if (!sessionUser || !sessionUser.id) return null;

    // Dynamic import to prevent circular dependency with db.ts
    const { db } = await import('@/lib/db');
    const dbUser = await db.users.getById(sessionUser.id);
    if (!dbUser || !dbUser.is_active) {
      return null;
    }

    // Validate authoritative session_version
    const currentVersion = await db.userCredentials.getSessionVersion(sessionUser.id);
    if (currentVersion !== null) {
      if (!sessionUser.session_version || sessionUser.session_version !== currentVersion) {
        return null;
      }
    }

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
    };
  } catch {
    return null;
  }
}

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
export async function requireAuthUser(options: { allowPendingPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AuthError('UNAUTHORIZED: Authentication session required.', 401);
  }
  if (user.must_change_password && !options.allowPendingPasswordChange) {
    throw new AuthError('PASSWORD_CHANGE_REQUIRED: Mandatory password change required before accessing portal.', 403);
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
