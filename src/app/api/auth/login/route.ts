import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signSessionPayload, AUTH_COOKIE } from '@/lib/auth';
import { signMfaChallenge, verifyMfaChallenge, MFA_CHALLENGE_COOKIE } from '@/lib/mfa';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { rateLimiter } from '@/lib/rate-limit';
import { verifyPassword } from '@/lib/password';

const GENERIC_AUTH_ERROR = 'Invalid credentials or inactive account.';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Browser';
  const rateLimitKey = `login_fail:${ip}`;

  try {
    // 1. Check IP rate limit (max 5 failed attempts in 5 minutes)
    const lockout = rateLimiter.isBlocked(rateLimitKey, 5, 5 * 60 * 1000);
    if (lockout.blocked) {
      await logSecurityEvent({
        eventType: 'RATE_LIMIT_EXCEEDED',
        severity: 'HIGH',
        description: `Brute force lockout triggered on login from IP ${ip}`,
        ipAddress: ip,
        userAgent,
      });
      return NextResponse.json(
        { error: `Too many failed login attempts. Account locked. Please try again in ${lockout.lockoutSeconds} seconds.` },
        { 
          status: 429,
          headers: { 'Retry-After': String(lockout.lockoutSeconds) }
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawEmail = body.email;
    const rawPassword = body.password;

    // Step 1: Normalize email
    if (!rawEmail || typeof rawEmail !== 'string') {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }
    if (!rawPassword || typeof rawPassword !== 'string') {
      return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }

    const email = rawEmail.trim().toLowerCase();

    // Step 2: Find user in public.users
    const user = await db.users.getByEmail(email);
    if (!user) {
      const failStatus = rateLimiter.recordFailure(rateLimitKey, 5, 5 * 60 * 1000);
      await logSecurityEvent({
        eventType: 'AUTH_FAILURE',
        severity: failStatus.isLocked ? 'HIGH' : 'MEDIUM',
        description: `LOGIN_FAILURE: USER_NOT_FOUND for ${email}. Remaining IP attempts: ${failStatus.remainingAttempts}`,
        ipAddress: ip,
        userAgent,
        metadata: { reason_category: 'USER_NOT_FOUND', target_email: email },
      });

      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    // Step 3: Check user.is_active === true
    if (!user.is_active) {
      const failStatus = rateLimiter.recordFailure(rateLimitKey, 5, 5 * 60 * 1000);
      await logSecurityEvent({
        eventType: 'AUTH_FAILURE',
        severity: failStatus.isLocked ? 'HIGH' : 'MEDIUM',
        description: `LOGIN_FAILURE: ACCOUNT_INACTIVE for user ${user.id} (${email})`,
        userId: user.id,
        ipAddress: ip,
        userAgent,
        metadata: { reason_category: 'ACCOUNT_INACTIVE', user_id: user.id, target_email: email },
      });

      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    // Step 4: Load public.user_credentials for that user
    const cred = await db.userCredentials.getByUserId(user.id);
    if (!cred || !cred.password_hash) {
      const failStatus = rateLimiter.recordFailure(rateLimitKey, 5, 5 * 60 * 1000);
      await logSecurityEvent({
        eventType: 'AUTH_FAILURE',
        severity: failStatus.isLocked ? 'HIGH' : 'MEDIUM',
        description: `LOGIN_FAILURE: CREDENTIAL_NOT_FOUND for user ${user.id} (${email})`,
        userId: user.id,
        ipAddress: ip,
        userAgent,
        metadata: { reason_category: 'CREDENTIAL_NOT_FOUND', user_id: user.id, target_email: email },
      });

      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    // Check account lockout status in user_credentials
    if (cred.locked_until) {
      const lockExpiresAt = new Date(cred.locked_until).getTime();
      if (Date.now() < lockExpiresAt) {
        const remainingSeconds = Math.ceil((lockExpiresAt - Date.now()) / 1000);
        await logSecurityEvent({
          eventType: 'AUTH_FAILURE',
          severity: 'HIGH',
          description: `LOGIN_FAILURE: ACCOUNT_LOCKED for user ${user.id} (${email})`,
          userId: user.id,
          ipAddress: ip,
          userAgent,
          metadata: { reason_category: 'ACCOUNT_LOCKED', user_id: user.id, remaining_seconds: remainingSeconds },
        });

        return NextResponse.json(
          { error: `Too many failed login attempts. Account locked. Please try again in ${remainingSeconds} seconds.` },
          { 
            status: 423,
            headers: { 'Retry-After': String(remainingSeconds) }
          }
        );
      } else {
        // Lockout expired - reset failed attempts
        await db.userCredentials.resetFailedAttempts(user.id);
      }
    }

    // Verify temporary password expiry if must_change_password
    if (cred.must_change_password && cred.temp_password_expires_at) {
      const expiresAtMs = new Date(cred.temp_password_expires_at).getTime();
      if (Date.now() > expiresAtMs) {
        await logSecurityEvent({
          eventType: 'AUTH_FAILURE',
          severity: 'MEDIUM',
          description: `LOGIN_FAILURE: TEMP_PASSWORD_EXPIRED for user ${user.id} (${email})`,
          userId: user.id,
          ipAddress: ip,
          userAgent,
          metadata: { reason_category: 'TEMP_PASSWORD_EXPIRED', user_id: user.id },
        });
        return NextResponse.json(
          { error: 'Temporary password has expired. Please contact an administrator for a password reset.' },
          { status: 401 }
        );
      }
    }

    // Step 5: Verify submitted password against stored password HASH
    let isPasswordValid = await verifyPassword(rawPassword, cred.password_hash);

    // Fallback: If hash check failed, verify against Supabase Auth (auth.users)
    // for users linked to a Supabase Auth identity (e.g. Primary Admin)
    if (!isPasswordValid && (process.env.STORAGE_MODE === 'supabase' || process.env.NODE_ENV === 'production') && user.auth_user_id) {
      try {
        const { getSupabaseClient } = await import('@/lib/supabase');
        const supabase = getSupabaseClient();
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
          email,
          password: rawPassword,
        });

        if (!authErr && authData.user && authData.user.id === user.auth_user_id) {
          isPasswordValid = true;
          // Synchronize authoritative user_credentials with this verified password hash
          const { hashPassword } = await import('@/lib/password');
          const newHash = await hashPassword(rawPassword);
          await db.userCredentials.updatePassword(user.id, newHash);
        }
      } catch {
        // Proceed to failure handling
      }
    }

    if (!isPasswordValid) {
      rateLimiter.recordFailure(rateLimitKey, 5, 5 * 60 * 1000);
      const userLockStatus = await db.userCredentials.recordFailedAttempt(user.id, 5, 15);

      await logSecurityEvent({
        eventType: 'AUTH_FAILURE',
        severity: userLockStatus.isLocked ? 'HIGH' : 'MEDIUM',
        description: `LOGIN_FAILURE: INVALID_PASSWORD for account: ${email}. User remaining attempts: ${userLockStatus.remainingAttempts}`,
        userId: user.id,
        ipAddress: ip,
        userAgent,
        metadata: { 
          reason_category: 'INVALID_PASSWORD', 
          user_id: user.id, 
          remaining_attempts: userLockStatus.remainingAttempts,
          is_locked: userLockStatus.isLocked 
        },
      });

      if (userLockStatus.isLocked) {
        return NextResponse.json(
          { error: `Too many failed login attempts. Account locked. Please try again in ${userLockStatus.lockoutSeconds} seconds.` },
          { 
            status: 423,
            headers: { 'Retry-After': String(userLockStatus.lockoutSeconds) }
          }
        );
      }

      return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
    }

    // Step 6: Load and verify role from database
    if (!user.role) {
      await logSecurityEvent({
        eventType: 'AUTH_FAILURE',
        severity: 'HIGH',
        description: `LOGIN_FAILURE: ROLE_NOT_ASSIGNED for user ${user.id} (${email})`,
        userId: user.id,
        ipAddress: ip,
        userAgent,
        metadata: { reason_category: 'ROLE_NOT_ASSIGNED', user_id: user.id },
      });
      return NextResponse.json({ error: 'Account has no assigned authorization role.' }, { status: 403 });
    }

    // Step 7: Resolve permissions server-side (user.permissions already resolved by db.users.getByEmail)
    // Step 8: Reset password-level failed attempts on password success
    rateLimiter.reset(rateLimitKey);
    await db.userCredentials.resetFailedAttempts(user.id);

    // Step 8.5: Authoritative MFA State Check (Fail-Closed)
    let userMfa = null;
    try {
      userMfa = await db.userMfa.getByUserId(user.id);
    } catch (mfaDbErr: any) {
      await logSecurityEvent({
        eventType: 'MFA_FAILURE',
        severity: 'CRITICAL',
        description: `MFA database lookup failed during login for ${email}: ${mfaDbErr.message}`,
        userId: user.id,
        ipAddress: ip,
        userAgent,
        metadata: { reason_category: 'MFA_DATABASE_UNAVAILABLE' },
      });

      return NextResponse.json(
        { error: 'Authentication service temporarily unavailable. Please try again later.' },
        { status: 503 }
      );
    }

    if (userMfa && userMfa.is_enabled && userMfa.is_verified) {
      // Check if MFA factor is locked
      if (userMfa.locked_until) {
        const lockExpiresAt = new Date(userMfa.locked_until).getTime();
        if (Date.now() < lockExpiresAt) {
          const remainingSeconds = Math.ceil((lockExpiresAt - Date.now()) / 1000);
          await logSecurityEvent({
            eventType: 'MFA_LOCKED',
            severity: 'HIGH',
            description: `LOGIN_CHALLENGE_BLOCKED: MFA locked for user ${user.id} (${email})`,
            userId: user.id,
            ipAddress: ip,
            userAgent,
            metadata: { reason_category: 'MFA_LOCKED', user_id: user.id, remaining_seconds: remainingSeconds },
          });

          return NextResponse.json(
            { error: `Too many failed authenticator attempts. MFA locked. Please try again in ${remainingSeconds} seconds.` },
            {
              status: 423,
              headers: { 'Retry-After': String(remainingSeconds) },
            }
          );
        } else {
          // Lockout expired, reset failed attempts
          await db.userMfa.resetFailedAttempts(user.id);
        }
      }

      // Generate short-lived (5 min) signed MFA challenge token
      const challengeToken = signMfaChallenge({ userId: user.id, email: user.email });
      const challengeInfo = verifyMfaChallenge(challengeToken);
      if (challengeInfo?.nonce) {
        await db.userMfa.setChallengeNonce(user.id, challengeInfo.nonce);
      }

      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        action: 'MFA_LOGIN_CHALLENGE',
        resourceType: 'AUTH_MFA',
        resourceId: user.id,
        metadata: { method: 'totp' },
        ipAddress: ip,
        userAgent,
      });

      const res = NextResponse.json({
        requiresMfa: true,
        challengeId: challengeToken,
        email: user.email,
      });

      res.cookies.set({
        name: MFA_CHALLENGE_COOKIE.name,
        value: challengeToken,
        ...MFA_CHALLENGE_COOKIE.options,
      });

      return res;
    }

    // Step 8.6: Routing determination based on mandatory security policy
    // Branch 1: Temporary password requires immediate password change
    if (cred.must_change_password) {
      const sessionToken = signSessionPayload({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions: user.permissions,
        must_change_password: true,
        session_version: cred.session_version,
      });

      await logAuditEvent({
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN_TEMP_PASSWORD',
        resourceType: 'AUTH',
        resourceId: user.id,
        metadata: { role: user.role, must_change_password: true },
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
          must_change_password: true,
          mfa_enabled: false,
        },
        must_change_password: true,
        mfa_enabled: false,
        redirectTo: '/change-password',
      });

      res.cookies.set({
        name: AUTH_COOKIE.name,
        value: sessionToken,
        ...AUTH_COOKIE.options,
      });

      return res;
    }

    // Branch 2: MFA is NOT configured -> MANDATORY MFA ENROLLMENT
    // User must be forced to /mfa-setup. Normal dashboard access is strictly blocked.
    const sessionToken = signSessionPayload({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions,
      must_change_password: false,
      session_version: cred.session_version,
    });

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'MFA_ENROLLMENT_REQUIRED',
      resourceType: 'AUTH_MFA',
      resourceId: user.id,
      metadata: { role: user.role, mfa_enrolled: false },
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
        must_change_password: false,
        mfa_enabled: false,
      },
      must_change_password: false,
      mfa_enabled: false,
      redirectTo: '/mfa-setup',
    });

    res.cookies.set({
      name: AUTH_COOKIE.name,
      value: sessionToken,
      ...AUTH_COOKIE.options,
    });

    return res;
  } catch (error: any) {
    try {
      await logSecurityEvent({
        eventType: 'AUTH_FAILURE',
        severity: 'CRITICAL',
        description: `LOGIN_FAILURE: AUTHENTICATION_ERROR: ${error.message || 'Unknown internal error'}`,
        ipAddress: ip,
        userAgent,
        metadata: { reason_category: 'AUTHENTICATION_ERROR', error: error.message },
      });
    } catch (logErr) {
      console.error('Failed to log security event in login error handler:', logErr);
    }
    return NextResponse.json(
      { error: error?.message ? `Authentication error: ${error.message}` : 'Internal authentication error.' },
      { status: 500 }
    );
  }
}
