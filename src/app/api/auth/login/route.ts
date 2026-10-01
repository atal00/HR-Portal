import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signSessionPayload, AUTH_COOKIE } from '@/lib/auth';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { rateLimiter } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    const rateLimitKey = `login_fail:${ip}`;

    // Check if IP is currently locked out (max 5 failed attempts in 5 minutes)
    const lockout = rateLimiter.isBlocked(rateLimitKey, 5, 5 * 60 * 1000);
    if (lockout.blocked) {
      await logSecurityEvent({
        eventType: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        description: `Brute force lockout triggered on login from IP ${ip}`,
        ipAddress: ip,
      });
      return NextResponse.json(
        { error: `Too many failed login attempts. Account locked. Please try again in ${lockout.lockoutSeconds} seconds.` },
        { 
          status: 429,
          headers: {
            'Retry-After': String(lockout.lockoutSeconds),
          }
        }
      );
    }

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
      const failStatus = rateLimiter.recordFailure(rateLimitKey, 5, 5 * 60 * 1000);
      await logSecurityEvent({
        eventType: 'AUTH_FAILURE',
        severity: failStatus.isLocked ? 'HIGH' : 'MEDIUM',
        description: `Failed login attempt for unknown or inactive account: ${email}. Remaining attempts: ${failStatus.remainingAttempts}`,
        ipAddress: ip,
        userAgent: req.headers.get('user-agent') || 'Browser',
      });

      if (failStatus.isLocked) {
        return NextResponse.json(
          { error: `Too many failed login attempts. Account locked. Please try again in ${failStatus.lockoutSeconds} seconds.` },
          { 
            status: 429,
            headers: {
              'Retry-After': String(failStatus.lockoutSeconds),
            }
          }
        );
      }

      return NextResponse.json(
        { error: 'Invalid credentials or inactive account.', remainingAttempts: failStatus.remainingAttempts },
        { status: 401 }
      );
    }

    // Login successful - reset failed attempts
    rateLimiter.reset(rateLimitKey);

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
