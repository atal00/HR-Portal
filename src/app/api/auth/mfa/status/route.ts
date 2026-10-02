import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const sessionUser = await requireAuthUser({ 
      allowPendingPasswordChange: true,
      allowPendingMfaSetup: true,
    });
    const userMfa = await db.userMfa.getByUserId(sessionUser.id);

    return NextResponse.json({
      isEnabled: Boolean(userMfa && userMfa.is_enabled && userMfa.is_verified),
      isVerified: Boolean(userMfa?.is_verified),
      method: userMfa?.method || 'totp',
      lastUsedAt: userMfa?.last_used_at || null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch MFA status.' },
      { status: err.status || 401 }
    );
  }
}
