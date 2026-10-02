import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { RoleCode } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    
    // Only privileged users (SUPER_ADMIN or HR_ADMIN) can list system users
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'HR_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges.' }, { status: 403 });
    }

    const users = await db.users.list();
    return NextResponse.json(
      { success: true, users },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await requireAuthUser();

    // ONLY SUPER_ADMIN is permitted to create/invite system users
    if (sessionUser.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only Super Administrator can create or invite system users.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { full_name, email, department, role, is_active } = body;

    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid corporate email address is required.' }, { status: 400 });
    }

    const validRoles: RoleCode[] = ['SUPER_ADMIN', 'HR_ADMIN', 'DOCUMENT_ADMIN', 'PAYROLL_ADMIN', 'VIEWER'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: `Valid role is required (${validRoles.join(', ')}).` }, { status: 400 });
    }

    const createdUser = await db.users.create(
      {
        full_name: full_name.trim(),
        email: email.trim().toLowerCase(),
        department: department?.trim() || 'General',
        role,
        is_active: is_active !== false,
      },
      sessionUser.id,
      sessionUser.email
    );

    return NextResponse.json({ success: true, user: createdUser }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
