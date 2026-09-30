import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signSessionPayload, AUTH_COOKIE } from '@/lib/auth';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const { email, role } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }

    let user = await db.users.getByEmail(email);

    // If logging in via demo role selector, pick corresponding seed user
    if (!user && role) {
      const allUsers = await db.users.list();
      user = allUsers.find((u) => u.role === role) || null;
    }

    if (!user || !user.is_active) {
      await logSecurityEvent({
        eventType: 'AUTH_FAILURE',
        severity: 'HIGH',
        description: `Failed login attempt for unknown or inactive account: ${email}`,
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Browser',
      });
      return NextResponse.json({ error: 'Invalid credentials or inactive account.' }, { status: 401 });
    }

    const sessionToken = signSessionPayload({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions,
    });

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN',
      resourceType: 'AUTH',
      resourceId: user.id,
      metadata: { role: user.role },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'Browser',
    });

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions: user.permissions,
      },
    });

    res.cookies.set({
      name: AUTH_COOKIE.name,
      value: sessionToken,
      ...AUTH_COOKIE.options,
    });

    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal authentication error' }, { status: 500 });
  }
}
