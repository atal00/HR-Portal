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

    if (body.department_id === 'other') {
      const trimmed = (body.custom_department || '').trim();
      if (!trimmed || trimmed.length < 2 || trimmed.length > 100 || trimmed.toLowerCase() !== 'other') {
        return NextResponse.json(
          { error: 'Valid custom department name is required (2-100 characters, cannot be "Other").' },
          { status: 400 }
        );
      }
    }

    const { salary: salaryData, ...employeeData } = body;

    const updated = await db.employees.update(id, employeeData, user.id, user.email);

    // If salary information is supplied and user has permission, upsert salary
    if (salaryData && (
      hasPermission(user, 'salary.update') ||
      hasPermission(user, 'employee.update') ||
      user.role === 'SUPER_ADMIN' ||
      user.role === 'HR_ADMIN' ||
      user.role === 'PAYROLL_ADMIN'
    )) {
      await db.salary.upsert({
        employee_id: updated.id,
        annual_ctc: Number(salaryData.annual_ctc) || 0,
        monthly_gross: Number(salaryData.monthly_gross) || 0,
        basic: Number(salaryData.basic) || 0,
        hra: Number(salaryData.hra) || 0,
        special_allowance: Number(salaryData.special_allowance) || 0,
        conveyance: Number(salaryData.conveyance) || 0,
        communication_allowance: Number(salaryData.communication_allowance) || 0,
        travel_allowance: Number(salaryData.travel_allowance) || 0,
        food_allowance: Number(salaryData.food_allowance) || 0,
        other_allowances: Number(salaryData.other_allowances) || 0,
        employee_pf: Number(salaryData.employee_pf) || 0,
        employer_pf: Number(salaryData.employer_pf) || 0,
        professional_tax: Number(salaryData.professional_tax) || 0,
        gratuity: Number(salaryData.gratuity) || 0,
        tds: Number(salaryData.tds) || 0,
        esic: Number(salaryData.esic) || 0,
        other_deductions: Number(salaryData.other_deductions) || 0,
        variable_pay: Number(salaryData.variable_pay) || 0,
        net_salary: Number(salaryData.net_salary) || 0,
        effective_date: salaryData.effective_date || new Date().toISOString().split('T')[0],
      }, user.id, user.email);
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();

    // Permanent purge is strictly restricted to SUPER_ADMIN
    if (user.role !== 'SUPER_ADMIN') {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'CRITICAL',
        description: `User ${user.email} attempted unauthorized permanent purge of employee.`,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Forbidden: Only Super Administrator can permanently purge records.' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if (body?.confirmation !== 'DELETE') {
      return NextResponse.json(
        { error: 'Explicit confirmation required. You must type "DELETE" to confirm permanent purge.' },
        { status: 400 }
      );
    }

    const employee = await db.employees.getById(id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee record not found.' }, { status: 404 });
    }

    if (employee.is_system_protected) {
      return NextResponse.json(
        { error: 'CRITICAL SECURITY VIOLATION: System-protected employee records cannot be purged.' },
        { status: 403 }
      );
    }

    // Verify dependencies and prerequisites before triggering destructive purge
    const dependencies = await db.employees.getDeletionDependencies(id);
    if (!dependencies.canPurge) {
      const status = dependencies.tasksTableAvailable === false ? 503 : 400;
      return NextResponse.json(
        {
          error: dependencies.blockingReason || 'Employee cannot be purged due to dependency or retention constraints.',
          canPurge: false,
          tasksTableAvailable: dependencies.tasksTableAvailable,
          retainedDocumentsCount: dependencies.retainedDocumentsCount,
        },
        { status }
      );
    }

    const result = await db.employees.permanentPurge(id, user.id, user.email);

    await logSecurityEvent({
      eventType: 'SUSPICIOUS_ACTIVITY',
      severity: 'HIGH',
      description: `Super Admin ${user.email} permanently purged employee record ${employee.employee_id} (${employee.full_name}).`,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      message: `Employee ${employee.employee_id} was permanently purged.`,
      purgedId: result.purgedId,
    });
  } catch (error: any) {
    const msg = error.message || 'Failed to purge employee record.';
    let status = 400;
    if (msg.includes('Forbidden') || msg.includes('SECURITY VIOLATION')) {
      status = 403;
    } else if (msg.includes('temporarily unavailable') || msg.toLowerCase().includes('tasks')) {
      status = 503;
    } else if (msg.includes('not found')) {
      status = 404;
    }
    return NextResponse.json({
      error: msg,
      canPurge: false,
      tasksTableAvailable: msg.toLowerCase().includes('tasks') ? false : undefined,
    }, { status });
  }
}
