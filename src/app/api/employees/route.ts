import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { z } from 'zod';

const createEmployeeSchema = z.object({
  employee_id: z.string().min(2, 'Employee ID is required'),
  full_name: z.string().min(2, 'Full Name is required'),
  email: z.string().email('Valid work email is required'),
  phone: z.string().min(8, 'Phone number is required'),
  address: z.string().min(5, 'Full address is required'),
  department_id: z.string().min(1, 'Department is required'),
  designation: z.string().min(2, 'Designation is required'),
  joining_date: z.string().min(4, 'Joining date is required'),
  employment_type: z.enum(['FULL_TIME', 'INTERNSHIP', 'CONTRACT']),
  work_location: z.string().min(2, 'Work location is required'),
  reporting_manager: z.string().optional(),
  status: z.enum(['ACTIVE', 'INTERN', 'ON_NOTICE', 'SEPARATED', 'INACTIVE']),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    if (!hasPermission(user, 'employee.view')) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'MEDIUM',
        description: `User ${user.email} attempted to list employees without permission.`,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to view employees.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const departmentId = searchParams.get('departmentId') || undefined;

    const list = await db.employees.list({ search, status, departmentId });
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    if (!hasPermission(user, 'employee.create')) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        description: `User ${user.email} attempted to create employee without employee.create permission.`,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions to create employee.' }, { status: 403 });
    }

    const body = await req.json();
    const validated = createEmployeeSchema.parse(body);

    const newEmp = await db.employees.create({
      ...validated,
      created_by: user.id,
    });

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'EMPLOYEE_CREATED',
      resourceType: 'EMPLOYEE',
      resourceId: newEmp.employee_id,
      metadata: { name: newEmp.full_name, designation: newEmp.designation },
    });

    return NextResponse.json(newEmp, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
