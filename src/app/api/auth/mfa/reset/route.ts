import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { hasPermission } from '@/lib/rbac';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  const userAgent = req.headers.get('user-agent') || 'Browser';

  try {
    // 1. Must be authenticated
    const adminUser = await requireAuthUser();

    // 2. Must possess administrative user update permissions or SUPER_ADMIN role
    const isAuthorized =
      adminUser.role === 'SUPER_ADMIN' ||
      adminUser.role === 'HR_ADMIN' ||
      hasPermission(adminUser, 'user.update');

    if (!isAuthorized) {
      await logSecurityEvent({
        eventType: 'AUTH_FAILURE',
        severity: 'HIGH',
        description: `Unauthorized attempt to reset MFA by user ${adminUser.email}`,
        userId: adminUser.id,
        ipAddress: ip,
        userAgent,
      });

      return NextResponse.json(
        { error: 'FORBIDDEN: You do not possess authorization to reset user MFA.' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const targetUserId = body.userId;
    const reason = body.reason || 'Administrative MFA reset requested';

    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json({ error: 'Target user ID is required.' }, { status: 400 });
    }

    // 3. Confirm target user exists
    const targetUser = await db.users.getById(targetUserId);
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found.' }, { status: 404 });
    }

    // 4. Invalidate existing TOTP secret and recovery codes
    await db.userMfa.resetMfa(targetUserId);

    // 5. Invalidate existing sessions by incrementing session_version
    const newSessionVersion = await db.userCredentials.incrementSessionVersion(targetUserId);

    // 6. Audit logging
    await logAuditEvent({
      userId: adminUser.id,
      userEmail: adminUser.email,
      action: 'MFA_RESET',
      resourceType: 'USER_MFA',
      resourceId: targetUserId,
      metadata: {
        target_user_email: targetUser.email,
        target_user_id: targetUserId,
        reason,
        new_session_version: newSessionVersion,
      },
      ipAddress: ip,
      userAgent,
    });

    await logSecurityEvent({
      eventType: 'MFA_RESET',
      severity: 'HIGH',
      description: `MFA reset for user ${targetUser.email} by administrator ${adminUser.email}. Reason: ${reason}`,
      userId: targetUserId,
      ipAddress: ip,
      userAgent,
      metadata: {
        reset_by_admin_id: adminUser.id,
        reset_by_admin_email: adminUser.email,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: `MFA successfully reset for ${targetUser.email}. All prior sessions have been invalidated and re-enrollment will be required.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to reset MFA.' },
      { status: err.status || 500 }
    );
  }
}
