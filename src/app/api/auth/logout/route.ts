import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, LAST_ACTIVITY_COOKIE, getCurrentUser } from '@/lib/auth';
import { MFA_CHALLENGE_COOKIE } from '@/lib/mfa';
import { logAuditEvent } from '@/lib/audit';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user) {
    // Invalidate server-side session token
    await db.userCredentials.incrementSessionVersion(user.id);

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGOUT',
      resourceType: 'AUTH',
      resourceId: user.id,
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'Browser',
    });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: AUTH_COOKIE.name,
    value: '',
    ...AUTH_COOKIE.options,
    maxAge: 0,
  });
  res.cookies.set({
    name: LAST_ACTIVITY_COOKIE.name,
    value: '',
    ...LAST_ACTIVITY_COOKIE.options,
    maxAge: 0,
  });
  res.cookies.set({
    name: MFA_CHALLENGE_COOKIE.name,
    value: '',
    ...MFA_CHALLENGE_COOKIE.options,
    maxAge: 0,
  });
  return res;
}
