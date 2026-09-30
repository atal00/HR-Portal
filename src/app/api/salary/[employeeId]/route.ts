import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { canAccessSalary, canModifySalary } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await requireAuthUser();
    
    // Strict server-side RBAC check for sensitive compensation data
    if (!canAccessSalary(user)) {
      await logSecurityEvent({
        eventType: 'CONFIDENTIAL_DATA_BREACH_ATTEMPT',
        severity: 'HIGH',
        description: `User ${user.email} (${user.role}) attempted to view confidential salary data without salary.view permission.`,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Forbidden: You do not possess clearance to inspect confidential salary records.' }, { status: 403 });
    }

    const { employeeId } = await params;
    const salary = await db.salary.getByEmployeeId(employeeId);

    if (!salary) {
      return NextResponse.json({ error: 'Salary record not found for this employee.' }, { status: 404 });
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'SALARY_VIEWED',
      resourceType: 'SALARY',
      resourceId: employeeId,
      metadata: { target_employee: employeeId },
    });

    return NextResponse.json(salary);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await requireAuthUser();
    
    // Strict server-side RBAC check for modifying compensation
    if (!canModifySalary(user)) {
      await logSecurityEvent({
        eventType: 'CONFIDENTIAL_DATA_TAMPER_ATTEMPT',
        severity: 'CRITICAL',
        description: `User ${user.email} (${user.role}) attempted to modify salary data without salary.update permission.`,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to modify compensation records.' }, { status: 403 });
    }

    const { employeeId } = await params;
    const body = await req.json();

    const updated = await db.salary.upsert({
      ...body,
      employee_id: employeeId,
    });

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'SALARY_UPDATED',
      resourceType: 'SALARY',
      resourceId: employeeId,
      metadata: { annual_ctc: updated.annual_ctc, net_salary: updated.net_salary },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
