import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { logSecurityEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get('x-break-glass-key') || body.recovery_key;

    const configuredSecret = process.env.BREAK_GLASS_RECOVERY_KEY;
    if (!configuredSecret) {
      return NextResponse.json(
        { error: 'Emergency break-glass recovery is not configured on this server.' },
        { status: 503 }
      );
    }

    if (!authHeader || typeof authHeader !== 'string') {
      await logSecurityEvent({
        eventType: 'BREAK_GLASS_KEY_MISSING',
        severity: 'HIGH',
        description: 'Break-glass recovery request received without recovery key.',
        metadata: { ip: req.headers.get('x-forwarded-for') || 'unknown' },
      });
      return NextResponse.json(
        { error: 'Unauthorized: Invalid recovery key.' },
        { status: 401 }
      );
    }

    // Timing-safe comparison to prevent side-channel timing attacks
    const keyBuf = Buffer.from(authHeader);
    const secretBuf = Buffer.from(configuredSecret);
    const isValid = keyBuf.length === secretBuf.length && crypto.timingSafeEqual(keyBuf, secretBuf);

    if (!isValid) {
      await logSecurityEvent({
        eventType: 'BREAK_GLASS_INVALID_KEY',
        severity: 'CRITICAL',
        description: 'Unauthorized attempt to activate break-glass recovery with invalid key.',
        metadata: { ip: req.headers.get('x-forwarded-for') || 'unknown' },
      });
      return NextResponse.json(
        { error: 'Unauthorized: Invalid recovery key.' },
        { status: 401 }
      );
    }

    const { operator, reason } = body;
    if (!operator || typeof operator !== 'string' || !operator.trim()) {
      return NextResponse.json(
        { error: 'Operator identification is required for emergency break-glass recovery.' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'A detailed emergency reason (minimum 10 characters) is required.' },
        { status: 400 }
      );
    }

    const recoveredAdmin = await db.users.breakGlassRecover(operator.trim(), reason.trim());

    return NextResponse.json({
      success: true,
      message: 'Super Administrator account successfully verified and recovered.',
      user: {
        email: recoveredAdmin.email,
        full_name: recoveredAdmin.full_name,
        role: recoveredAdmin.role,
        is_active: recoveredAdmin.is_active,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
