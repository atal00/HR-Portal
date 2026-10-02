import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { PermissionCode } from '@/types/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionUser = await requireAuthUser();
    const { id } = await params;

    if (sessionUser.role !== 'SUPER_ADMIN' && sessionUser.id !== id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
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

    if (sessionUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Administrator can grant/revoke user permissions.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { permission_code, is_granted } = body;

    if (!permission_code) {
      return NextResponse.json({ error: 'permission_code is required.' }, { status: 400 });
    }
    if (typeof is_granted !== 'boolean') {
      return NextResponse.json({ error: 'is_granted boolean is required.' }, { status: 400 });
    }

    const updatedPermissions = await db.users.setPermissionOverride(
      id,
      permission_code as PermissionCode,
      is_granted,
      sessionUser.id
    );

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

    if (sessionUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Administrator can reset user permissions.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const permission_code = searchParams.get('permission_code') as PermissionCode;

    if (!permission_code) {
      return NextResponse.json({ error: 'permission_code query parameter is required.' }, { status: 400 });
    }

    const updatedPermissions = await db.users.resetPermissionOverride(
      id,
      permission_code,
      sessionUser.id
    );

    return NextResponse.json({ success: true, permissions: updatedPermissions });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
