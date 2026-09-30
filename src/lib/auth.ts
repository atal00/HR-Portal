import { cookies } from 'next/headers';
import crypto from 'crypto';
import { SessionUser } from '@/types/auth';
import { PermissionCode, RoleCode } from '@/types/database';
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
 * Server-side getter for authenticated user session from HTTP cookies
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Server-side guard requiring authentication
 */
export async function requireAuthUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED: Authentication session required.');
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
