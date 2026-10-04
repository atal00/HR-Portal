import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  verifyMfaChallenge,
  hashRecoveryCode,
  isChallengeNonceConsumed,
  markChallengeNonceConsumed,
  MFA_CHALLENGE_COOKIE,
} from '@/lib/mfa';
import { signSessionPayload, AUTH_COOKIE, LAST_ACTIVITY_COOKIE } from '@/lib/auth';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Browser';

  try {
    const body = await req.json().catch(() => ({}));
    const rawRecoveryCode = body.recoveryCode;
    const challengeFromCookie = req.cookies.get(MFA_CHALLENGE_COOKIE.name)?.value;
    const challengeToken = body.challengeId || challengeFromCookie;

    if (!challengeToken) {
      return NextResponse.json(
        { error: 'MFA challenge session missing or expired. Please sign in again.' },
        { status: 401 }
      );
    }

    // 1. Verify challenge token
    const challenge = verifyMfaChallenge(challengeToken);
    if (!challenge) {
      await logSecurityEvent({
        eventType: 'MFA_FAILURE',
        severity: 'MEDIUM',
        description: `Expired or invalid MFA challenge token used for recovery code from IP ${ip}`,
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

    // 2. Fetch authoritative user
    const user = await db.users.getById(userId);
    if (!user || !user.is_active) {
      return NextResponse.json(
        { error: 'User account is inactive or not found.' },
        { status: 401 }
      );
    }

    // 3. Fetch user MFA record
    const userMfa = await db.userMfa.getByUserId(userId);
    if (!userMfa || !userMfa.is_enabled || !userMfa.is_verified) {
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

    // 4. Check lockout
    if (userMfa.locked_until) {
      const lockExpiresAt = new Date(userMfa.locked_until).getTime();
      if (Date.now() < lockExpiresAt) {
        const remainingSeconds = Math.ceil((lockExpiresAt - Date.now()) / 1000);
        return NextResponse.json(
          { error: `Account locked due to too many failed attempts. Try again in ${remainingSeconds} seconds.` },
          {
            status: 423,
            headers: { 'Retry-After': String(remainingSeconds) },
          }
        );
      } else {
        await db.userMfa.resetFailedAttempts(user.id);
      }
    }

    // 5. Validate recovery code input
    if (!rawRecoveryCode || typeof rawRecoveryCode !== 'string') {
      return NextResponse.json(
        { error: 'A valid recovery code is required.' },
        { status: 400 }
      );
    }

    // Hash submitted recovery code
    const submittedHash = hashRecoveryCode(rawRecoveryCode);

    // 6. Atomically check and consume recovery code hash
    const codeConsumed = await db.userMfa.consumeRecoveryCode(user.id, submittedHash);

    if (!codeConsumed) {
      const lockStatus = await db.userMfa.recordFailedAttempt(user.id, 5, 15);

      await logSecurityEvent({
        eventType: lockStatus.isLocked ? 'MFA_LOCKED' : 'MFA_FAILURE',
        severity: lockStatus.isLocked ? 'HIGH' : 'MEDIUM',
        description: `Invalid or used recovery code attempt for ${user.email}. Remaining: ${lockStatus.remainingAttempts}`,
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
          { error: `Too many failed attempts. Account locked for ${lockStatus.lockoutSeconds} seconds.` },
          {
            status: 423,
            headers: { 'Retry-After': String(lockStatus.lockoutSeconds) },
          }
        );
      }

      return NextResponse.json(
        { error: 'Invalid or previously used recovery code.' },
        { status: 401 }
      );
    }

    // 7. Success! Single-use recovery code consumed
    // 7b. ATOMIC CHALLENGE CONSUMPTION (Prevents Concurrent Request Race)
    // Guarantees only ONE concurrent request can consume the nonce and create a varsaka_session
    const nonceConsumed = await db.userMfa.consumeChallengeNonce(user.id, challenge.nonce);
    if (!nonceConsumed) {
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

    const cred = await db.userCredentials.getByUserId(user.id);

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
      action: 'MFA_RECOVERY_CODE_USED',
      resourceType: 'AUTH_MFA',
      resourceId: user.id,
      metadata: { method: 'recovery_code' },
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

    res.cookies.set({
      name: AUTH_COOKIE.name,
      value: sessionToken,
      ...AUTH_COOKIE.options,
    });

    res.cookies.set({
      name: LAST_ACTIVITY_COOKIE.name,
      value: Date.now().toString(),
      ...LAST_ACTIVITY_COOKIE.options,
    });

    res.cookies.set({
      name: MFA_CHALLENGE_COOKIE.name,
      value: '',
      ...MFA_CHALLENGE_COOKIE.options,
      maxAge: 0,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Recovery code verification failed.' },
      { status: 500 }
    );
  }
}
