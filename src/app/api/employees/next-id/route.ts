import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    if (!hasPermission(user, 'employee.create')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions.' }, { status: 403 });
    }

    const nextId = await db.employees.generateNextEmployeeId();
    return NextResponse.json({ success: true, nextId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to generate ID.' }, { status: 500 });
  }
}
