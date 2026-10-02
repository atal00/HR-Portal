import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  generateMfaSecret,
  generateMfaUri,
  generateRecoveryCodes,
  encryptMfaSecret,
} from '@/lib/mfa';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Browser';

  try {
    // Requires an authenticated user (including during first-time login MFA setup transition)
    const sessionUser = await requireAuthUser({ 
      allowPendingPasswordChange: true,
      allowPendingMfaSetup: true,
    });

    // Generate fresh cryptographic TOTP secret and recovery codes
    const secret = generateMfaSecret();
    const qrUri = generateMfaUri(sessionUser.email, secret);
    const { codes, hashes } = generateRecoveryCodes(8);

    // Encrypt secret with authenticated AES-256-GCM before DB persistence
    const encryptedSecret = encryptMfaSecret(secret);

    // Save pending MFA record (not enabled until user verifies first valid code)
    await db.userMfa.createOrUpdatePending({
      userId: sessionUser.id,
      encryptedSecret,
      recoveryCodesHashes: hashes,
    });

    await logAuditEvent({
      userId: sessionUser.id,
      userEmail: sessionUser.email,
      action: 'MFA_ENROLLMENT_STARTED',
      resourceType: 'AUTH_MFA',
      resourceId: sessionUser.id,
      metadata: { method: 'totp', recovery_codes_count: codes.length },
      ipAddress: ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      qrUri,
      manualKey: secret,
      recoveryCodes: codes,
      accountLabel: sessionUser.email,
      issuer: 'Varsaka HR',
    });
  } catch (err: any) {
    await logSecurityEvent({
      eventType: 'AUTH_FAILURE',
      severity: 'MEDIUM',
      description: `MFA setup initialization failed: ${err.message}`,
      ipAddress: ip,
      userAgent,
      metadata: { error: err.message },
    });

    return NextResponse.json(
      { error: err.message || 'Failed to initialize MFA setup.' },
      { status: err.status || 500 }
    );
  }
}
