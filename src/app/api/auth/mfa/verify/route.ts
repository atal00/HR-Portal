import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  verifyMfaChallenge,
  decryptMfaSecret,
  verifyTotpCode,
  isChallengeNonceConsumed,
  markChallengeNonceConsumed,
  MFA_CHALLENGE_COOKIE,
} from '@/lib/mfa';
import { signSessionPayload, AUTH_COOKIE, LAST_ACTIVITY_COOKIE } from '@/lib/auth';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { loginTokenBucket } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Browser';

  try {
    const body = await req.json().catch(() => ({}));
    const rawCode = body.code;
    const challengeFromCookie = req.cookies.get(MFA_CHALLENGE_COOKIE.name)?.value;
    const challengeToken = body.challengeId || challengeFromCookie;

    if (!challengeToken) {
      return NextResponse.json(
        { error: 'MFA challenge session missing or expired. Please sign in again.' },
        { status: 401 }
      );
    }

    // 1. Verify challenge token signature, type, and 5-minute expiry
    const challenge = verifyMfaChallenge(challengeToken);
    if (!challenge) {
      await logSecurityEvent({
        eventType: 'MFA_FAILURE',
        severity: 'MEDIUM',
        description: `Expired or invalid MFA challenge token used from IP ${ip}`,
        ipAddress: ip,
        userAgent,
      });

      return NextResponse.json(
        { error: 'MFA challenge expired or invalid. Please sign in again.' },
        { status: 401 }
      );
    }

    // 1b. Check if challenge nonce has already been consumed (In-Memory Fast Defense)
    if (isChallengeNonceConsumed(challenge.nonce)) {
      await logSecurityEvent({
        eventType: 'MFA_FAILURE',
        severity: 'HIGH',
        description: `Replay of already consumed MFA challenge token detected for ${challenge.email} from IP ${ip}`,
        ipAddress: ip,
        userAgent,
        metadata: { reason_category: 'MFA_CHALLENGE_REPLAYED' },
      });

      return NextResponse.json(
        { error: 'MFA challenge has already been used. Please sign in again.' },
        { status: 401 }
      );
    }

    const { userId } = challenge;

    // 2. Fetch authoritative user from database
    const user = await db.users.getById(userId);
    if (!user || !user.is_active) {
      return NextResponse.json(
        { error: 'User account is inactive or not found.' },
        { status: 401 }
      );
    }

    // 3. Fetch user MFA configuration
    const userMfa = await db.userMfa.getByUserId(userId);
    if (!userMfa || !userMfa.is_enabled || !userMfa.is_verified || !userMfa.secret_encrypted) {
      return NextResponse.json(
        { error: 'MFA is not enabled for this account.' },
        { status: 400 }
      );
    }

    // 3b. Verify challenge nonce against database-persisted nonce (Cross-Instance Replay Defense)
    if (userMfa.current_challenge_nonce !== undefined && userMfa.current_challenge_nonce !== null) {
      if (userMfa.current_challenge_nonce !== challenge.nonce) {
        await logSecurityEvent({
          eventType: 'MFA_FAILURE',
          severity: 'HIGH',
          description: `MFA challenge token invalidated or superseded for ${user.email} from IP ${ip}`,
          userId: user.id,
          ipAddress: ip,
          userAgent,
          metadata: { reason_category: 'MFA_CHALLENGE_INVALIDATED' },
        });

        return NextResponse.json(
          { error: 'MFA challenge is no longer valid. Please sign in again.' },
          { status: 401 }
        );
      }
    } else if (userMfa.current_challenge_nonce === null) {
      // Explicitly null means challenge has already been consumed or reset
      await logSecurityEvent({
        eventType: 'MFA_FAILURE',
        severity: 'HIGH',
        description: `MFA challenge token already consumed (db nonce null) for ${user.email} from IP ${ip}`,
        userId: user.id,
        ipAddress: ip,
        userAgent,
        metadata: { reason_category: 'MFA_CHALLENGE_ALREADY_CONSUMED' },
      });

      return NextResponse.json(
        { error: 'MFA challenge has already been used. Please sign in again.' },
        { status: 401 }
      );
    }

    // 4. Check MFA-level lockout
    if (userMfa.locked_until) {
      const lockExpiresAt = new Date(userMfa.locked_until).getTime();
      if (Date.now() < lockExpiresAt) {
        const remainingSeconds = Math.ceil((lockExpiresAt - Date.now()) / 1000);
        await logSecurityEvent({
          eventType: 'MFA_LOCKED',
          severity: 'HIGH',
          description: `MFA verification attempt on locked account: ${user.email}`,
          userId: user.id,
          ipAddress: ip,
          userAgent,
          metadata: { remaining_seconds: remainingSeconds },
        });

        return NextResponse.json(
          { error: `Too many failed authenticator attempts. MFA locked. Please try again in ${remainingSeconds} seconds.` },
          {
            status: 423,
            headers: { 'Retry-After': String(remainingSeconds) },
          }
        );
      } else {
        await db.userMfa.resetFailedAttempts(user.id);
      }
    }

    // 5. Validate input OTP format
    if (!rawCode || typeof rawCode !== 'string') {
      return NextResponse.json({ error: 'A 6-digit authenticator code is required.' }, { status: 400 });
    }

    const code = rawCode.trim();
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Authenticator code must be 6 digits.' }, { status: 400 });
    }

    // 6. Decrypt secret and verify RFC 6238 TOTP code
    const plaintextSecret = decryptMfaSecret(userMfa.secret_encrypted);
    const isTotpValid = verifyTotpCode(code, plaintextSecret);

    if (!isTotpValid) {
      loginTokenBucket.consume(`login:account:${user.email.toLowerCase()}`);
      loginTokenBucket.consume(`login:ip:${ip}`);
      const lockStatus = await db.userMfa.recordFailedAttempt(user.id, 5, 15);

      await logSecurityEvent({
        eventType: lockStatus.isLocked ? 'MFA_LOCKED' : 'MFA_FAILURE',
        severity: lockStatus.isLocked ? 'HIGH' : 'MEDIUM',
        description: `MFA verification failed for ${user.email}. Remaining attempts: ${lockStatus.remainingAttempts}`,
        userId: user.id,
        ipAddress: ip,
        userAgent,
        metadata: {
          remaining_attempts: lockStatus.remainingAttempts,
          is_locked: lockStatus.isLocked,
        },
      });

      if (lockStatus.isLocked) {
        return NextResponse.json(
          { error: `Too many failed authenticator attempts. Account locked for ${lockStatus.lockoutSeconds} seconds.` },
          {
            status: 423,
            headers: { 'Retry-After': String(lockStatus.lockoutSeconds) },
          }
        );
      }

      return NextResponse.json(
        { error: 'Invalid authenticator code. Please check the code in your authenticator app and try again.' },
        { status: 401 }
      );
    }

    // 7. TOTP Valid! Reset MFA failed attempts and login token buckets
    await db.userMfa.resetFailedAttempts(user.id);
    loginTokenBucket.reset(`login:account:${user.email.toLowerCase()}`);
    loginTokenBucket.reset(`login:ip:${ip}`);

    // 7b. ATOMIC CHALLENGE CONSUMPTION (Prevents Concurrent Request Race)
    // Guarantees only ONE concurrent request can consume the nonce and create a varsaka_session
    const consumed = await db.userMfa.consumeChallengeNonce(user.id, challenge.nonce);
    if (!consumed) {
      await logSecurityEvent({
        eventType: 'MFA_FAILURE',
        severity: 'HIGH',
        description: `MFA challenge token already consumed (concurrent race blocked) for ${user.email} from IP ${ip}`,
        userId: user.id,
        ipAddress: ip,
        userAgent,
        metadata: { reason_category: 'MFA_CHALLENGE_ALREADY_CONSUMED' },
      });

      return NextResponse.json(
        { error: 'MFA challenge has already been used. Please sign in again.' },
        { status: 401 }
      );
    }
    markChallengeNonceConsumed(challenge.nonce, challenge.expiresAt);

    // 8. Fetch authoritative credentials state for session version and password change flag
    const cred = await db.userCredentials.getByUserId(user.id);

    // 9. Issue final authoritative varsaka_session cookie
    const sessionToken = signSessionPayload({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions,
      must_change_password: cred?.must_change_password ?? false,
      session_version: cred?.session_version ?? 1,
      mfa_enabled: true,
    });

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'MFA_SUCCESS',
      resourceType: 'AUTH_MFA',
      resourceId: user.id,
      metadata: { method: 'totp' },
      ipAddress: ip,
      userAgent,
    });

    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions: user.permissions,
        must_change_password: cred?.must_change_password ?? false,
        mfa_enabled: true,
      },
      must_change_password: cred?.must_change_password ?? false,
      redirectTo: cred?.must_change_password ? '/change-password' : '/dashboard',
    });

    // Set authoritative session cookie
    res.cookies.set({
      name: AUTH_COOKIE.name,
      value: sessionToken,
      ...AUTH_COOKIE.options,
    });

    // Set initial activity timestamp cookie
    res.cookies.set({
      name: LAST_ACTIVITY_COOKIE.name,
      value: Date.now().toString(),
      ...LAST_ACTIVITY_COOKIE.options,
    });

    // Clear challenge cookie
    res.cookies.set({
      name: MFA_CHALLENGE_COOKIE.name,
      value: '',
      ...MFA_CHALLENGE_COOKIE.options,
      maxAge: 0,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'MFA verification failed due to internal error.' },
      { status: 500 }
    );
  }
}
