import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { decryptMfaSecret, verifyTotpCode } from '@/lib/mfa';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Browser';

  try {
    const sessionUser = await requireAuthUser({ 
      allowPendingPasswordChange: true,
      allowPendingMfaSetup: true,
    });

    const body = await req.json().catch(() => ({}));
    const rawCode = body.code;

    if (!rawCode || typeof rawCode !== 'string') {
      return NextResponse.json({ error: 'A 6-digit verification code is required.' }, { status: 400 });
    }

    const code = rawCode.trim();
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Verification code must be exactly 6 digits.' }, { status: 400 });
    }

    const userMfa = await db.userMfa.getByUserId(sessionUser.id);
    if (!userMfa || !userMfa.secret_encrypted) {
      return NextResponse.json(
        { error: 'MFA setup has not been initiated. Please start authenticator enrollment.' },
        { status: 400 }
      );
    }

    // Decrypt the server-stored secret using authenticated AES-256-GCM
    const plaintextSecret = decryptMfaSecret(userMfa.secret_encrypted);

    // Verify first TOTP code
    const isValid = verifyTotpCode(code, plaintextSecret);
    if (!isValid) {
      await logSecurityEvent({
        eventType: 'MFA_FAILURE',
        severity: 'MEDIUM',
        description: `MFA setup verification failed for ${sessionUser.email}: invalid OTP code`,
        userId: sessionUser.id,
        ipAddress: ip,
        userAgent,
      });

      return NextResponse.json(
        { error: 'Invalid authenticator code. Please check that the code from your app matches and that your device clock is accurate.' },
        { status: 400 }
      );
    }

    // First code verified! Mark MFA as officially enabled and verified
    await db.userMfa.enableMfa(sessionUser.id);

    await logAuditEvent({
      userId: sessionUser.id,
      userEmail: sessionUser.email,
      action: 'MFA_ENROLLMENT_COMPLETED',
      resourceType: 'AUTH_MFA',
      resourceId: sessionUser.id,
      metadata: { method: 'totp', is_enabled: true },
      ipAddress: ip,
      userAgent,
    });

    // Refresh and issue the final authenticated session cookie with mfa_enabled = true
    const { signSessionPayload, AUTH_COOKIE } = await import('@/lib/auth');
    const newSessionToken = signSessionPayload({
      id: sessionUser.id,
      email: sessionUser.email,
      full_name: sessionUser.full_name,
      role: sessionUser.role,
      permissions: sessionUser.permissions,
      must_change_password: false,
      session_version: sessionUser.session_version,
      mfa_enabled: true,
    });

    const res = NextResponse.json({
      success: true,
      message: 'Authenticator successfully configured.',
      redirectTo: '/dashboard',
    });

    res.cookies.set({
      name: AUTH_COOKIE.name,
      value: newSessionToken,
      ...AUTH_COOKIE.options,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to verify authenticator setup.' },
      { status: err.status || 500 }
    );
  }
}
