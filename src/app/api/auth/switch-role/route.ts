import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signSessionPayload, AUTH_COOKIE } from '@/lib/auth';
import { RoleCode } from '@/types/database';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const { role } = await req.json();
    if (!role) {
      return NextResponse.json({ error: 'Target role is required.' }, { status: 400 });
    }

    const allUsers = await db.users.list();
    const targetUser = allUsers.find((u) => u.role === role);

    if (!targetUser) {
      return NextResponse.json({ error: `User with role ${role} not found.` }, { status: 404 });
    }

    const sessionToken = signSessionPayload({
      id: targetUser.id,
      email: targetUser.email,
      full_name: targetUser.full_name,
      role: targetUser.role,
      permissions: targetUser.permissions,
    });

    await logAuditEvent({
      userId: targetUser.id,
      userEmail: targetUser.email,
      action: 'ROLE_SWITCHED_SANDBOX',
      resourceType: 'RBAC',
      resourceId: targetUser.id,
      metadata: { target_role: role },
    });

    const res = NextResponse.json({ success: true, user: targetUser });
    res.cookies.set({
      name: AUTH_COOKIE.name,
      value: sessionToken,
      ...AUTH_COOKIE.options,
    });

    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
