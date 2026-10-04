import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { hasPermission, PERMISSION_DESCRIPTIONS } from '@/lib/rbac';
import { PermissionCode } from '@/types/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuthUser();
    const { id } = await params;

    const canView =
      sessionUser.role === 'SUPER_ADMIN' ||
      hasPermission(sessionUser, 'permission.assign') ||
      sessionUser.id === id;

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to view user permissions.' }, { status: 403 });
    }

    const targetUser = await db.users.getById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found.' }, { status: 404 });
    }

    const permissions = await db.users.getPermissions(id);
    return NextResponse.json({ success: true, permissions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuthUser();
    const { id } = await params;

    const canManage =
      sessionUser.role === 'SUPER_ADMIN' ||
      hasPermission(sessionUser, 'permission.assign');

    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient administrative privileges to modify permission overrides.' },
        { status: 403 }
      );
    }

    // Critical Requirement: Block self-escalation / self-modification
    if (sessionUser.id === id) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot modify your own permission overrides.' },
        { status: 403 }
      );
    }

    const targetUser = await db.users.getById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found.' }, { status: 404 });
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Administrator permissions are immutable and cannot be overridden.' },
        { status: 403 }
      );
    }

    if (targetUser.deletion_status === 'DELETED') {
      return NextResponse.json(
        { error: 'Cannot modify permissions for an archived/deleted user.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { permission_code, is_granted, reason } = body;

    if (!permission_code || !(permission_code in PERMISSION_DESCRIPTIONS)) {
      return NextResponse.json({ error: 'Valid permission_code is required.' }, { status: 400 });
    }
    if (typeof is_granted !== 'boolean') {
      return NextResponse.json({ error: 'is_granted boolean is required.' }, { status: 400 });
    }

    await db.users.setPermissionOverride(
      id,
      permission_code as PermissionCode,
      is_granted,
      sessionUser.id,
      sessionUser.email,
      reason
    );

    const updatedPermissions = await db.users.getPermissions(id);
    return NextResponse.json({ success: true, permissions: updatedPermissions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuthUser();
    const { id } = await params;

    const canManage =
      sessionUser.role === 'SUPER_ADMIN' ||
      hasPermission(sessionUser, 'permission.assign');

    if (!canManage) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient administrative privileges to reset permission overrides.' },
        { status: 403 }
      );
    }

    // Critical Requirement: Block self-modification
    if (sessionUser.id === id) {
      return NextResponse.json(
        { error: 'Forbidden: You cannot modify your own permission overrides.' },
        { status: 403 }
      );
    }

    const targetUser = await db.users.getById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found.' }, { status: 404 });
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Super Administrator permissions cannot be modified.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const permission_code = searchParams.get('permission_code') as PermissionCode;

    if (!permission_code || !(permission_code in PERMISSION_DESCRIPTIONS)) {
      return NextResponse.json({ error: 'Valid permission_code query parameter is required.' }, { status: 400 });
    }

    await db.users.resetPermissionOverride(
      id,
      permission_code,
      sessionUser.id,
      sessionUser.email
    );

    const updatedPermissions = await db.users.getPermissions(id);
    return NextResponse.json({ success: true, permissions: updatedPermissions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
