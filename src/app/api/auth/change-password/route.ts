import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser, signSessionPayload, AUTH_COOKIE } from '@/lib/auth';
import { db } from '@/lib/db';
import { validatePasswordPolicy } from '@/lib/password';

export async function POST(req: NextRequest) {
  try {
    // allow pending password change users to call this endpoint
    const sessionUser = await requireAuthUser({ allowPendingPasswordChange: true });

    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json({ error: 'Current temporary password is required.' }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json({ error: 'New password is required.' }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: 'New password and confirmation password do not match.' }, { status: 400 });
    }

    const policy = validatePasswordPolicy(newPassword);
    if (!policy.valid) {
      return NextResponse.json({ error: policy.errors.join(' ') }, { status: 400 });
    }

    await db.users.changePassword(sessionUser.id, currentPassword, newPassword);

    // Refresh session cookie with must_change_password = false and new session_version
    const newSessionVersion = await db.userCredentials.getSessionVersion(sessionUser.id);
    const refreshedUser = await db.users.getById(sessionUser.id);

    const newSessionToken = signSessionPayload({
      id: sessionUser.id,
      email: sessionUser.email,
      full_name: refreshedUser?.full_name || sessionUser.full_name,
      role: refreshedUser?.role || sessionUser.role,
      permissions: refreshedUser?.permissions || sessionUser.permissions,
      must_change_password: false,
      session_version: newSessionVersion || 1,
    });

    const res = NextResponse.json({
      success: true,
      message: 'Password changed successfully. You can now access the portal.',
      user: {
        id: sessionUser.id,
        email: sessionUser.email,
        full_name: refreshedUser?.full_name || sessionUser.full_name,
        role: refreshedUser?.role || sessionUser.role,
        permissions: refreshedUser?.permissions || sessionUser.permissions,
        must_change_password: false,
      },
    });

    res.cookies.set({
      name: AUTH_COOKIE.name,
      value: newSessionToken,
      ...AUTH_COOKIE.options,
    });

    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to change password.' },
      { status: error.status || 400 }
    );
  }
}
