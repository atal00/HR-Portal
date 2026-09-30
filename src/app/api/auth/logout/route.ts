import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, getCurrentUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (user) {
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
  return res;
}
