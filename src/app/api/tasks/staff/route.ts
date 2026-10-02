import { NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { ROLE_LABELS } from '@/lib/rbac';

export async function GET() {
  try {
    await requireAuthUser();
    const users = await db.users.list();
    const staff = users
      .filter((u) => u.is_active)
      .map((u) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        role: u.role,
        role_label: ROLE_LABELS[u.role]?.name || u.role,
      }));

    return NextResponse.json({ success: true, staff });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    );
  }
}
