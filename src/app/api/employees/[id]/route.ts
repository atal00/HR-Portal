import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    if (!hasPermission(user, 'employee.view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const employee = await db.employees.getById(id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'EMPLOYEE_VIEWED',
      resourceType: 'EMPLOYEE',
      resourceId: employee.employee_id,
    });

    return NextResponse.json(employee);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    if (!hasPermission(user, 'employee.update')) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        description: `User ${user.email} attempted to update employee without permission.`,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to update employee.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const updated = await db.employees.update(id, body);

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'EMPLOYEE_UPDATED',
      resourceType: 'EMPLOYEE',
      resourceId: updated.employee_id,
      metadata: { updated_fields: Object.keys(body) },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
