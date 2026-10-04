import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { logSecurityEvent } from '@/lib/audit';
import { z } from 'zod';

const createEmployeeSchema = z.object({
  employee_id: z.string().optional(),
  full_name: z.string().min(2, 'Full Name is required'),
  email: z.string().email('Valid work email is required'),
  phone: z.string().min(8, 'Phone number is required'),
  address: z.string().min(5, 'Full address is required'),
  department_id: z.string().min(1, 'Department is required'),
  custom_department: z.string().optional(),
  designation: z.string().min(2, 'Designation is required'),
  joining_date: z.string().min(4, 'Joining date is required'),
  employment_type: z.enum(['FULL_TIME', 'INTERNSHIP', 'CONTRACT']),
  work_location: z.string().min(2, 'Work location is required'),
  reporting_manager: z.string().optional(),
  status: z.enum(['ACTIVE', 'INTERN', 'ON_NOTICE', 'SEPARATED', 'INACTIVE']).default('ACTIVE'),

  // Section A - Personal Information
  father_name: z.string().optional(),
  mother_name: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  personal_email: z.string().email().optional().or(z.literal('')),
  alternate_phone: z.string().optional(),
  permanent_address: z.string().optional(),
  current_address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pin_code: z.string().optional(),

  // Section B - Identity / Statutory Information
  pan_number: z.string().optional(),
  aadhaar_number: z.string().optional(),
  passport_number: z.string().optional(),
  uan: z.string().optional(),
  pf_number: z.string().optional(),
  esic_number: z.string().optional(),

  // Section C - Employment Information
  probation_period: z.string().optional(),
  confirmation_date: z.string().optional(),
  notice_period: z.string().optional(),
  date_of_separation: z.string().optional(),
  separation_reason: z.string().optional(),

  // Section D - Bank Information
  bank_name: z.string().optional(),
  bank_account_holder_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_ifsc: z.string().optional(),
  salary_structure: z.string().optional(),

  // Optional Salary Payload
  salary: z.object({
    annual_ctc: z.number().optional(),
    monthly_gross: z.number().optional(),
    basic: z.number().optional(),
    hra: z.number().optional(),
    special_allowance: z.number().optional(),
    conveyance: z.number().optional(),
    communication_allowance: z.number().optional(),
    travel_allowance: z.number().optional(),
    food_allowance: z.number().optional(),
    other_allowances: z.number().optional(),
    employee_pf: z.number().optional(),
    employer_pf: z.number().optional(),
    professional_tax: z.number().optional(),
    gratuity: z.number().optional(),
    tds: z.number().optional(),
    esic: z.number().optional(),
    other_deductions: z.number().optional(),
    variable_pay: z.number().optional(),
    net_salary: z.number().optional(),
    effective_date: z.string().optional(),
  }).optional(),


  // Section E - Document / KYC References
  kyc_documents: z.record(z.string(), z.string()).optional(),
}).refine((data) => {
  if (data.department_id === 'other') {
    const trimmed = (data.custom_department || '').trim();
    return trimmed.length >= 2 && trimmed.length <= 100 && trimmed.toLowerCase() !== 'other';
  }
  return true;
}, {
  message: 'Valid custom department name is required (2-100 characters, cannot be "Other").',
  path: ['custom_department'],
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
    const activeOnly = searchParams.get('activeOnly') === 'true';

    let list = await db.employees.list({ search, status, departmentId });
    if (activeOnly) {
      list = list.filter((e) => e.status !== 'INACTIVE' && e.status !== 'SEPARATED' && (e as any).deletion_status !== 'DELETED');
    }
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

    // Auto-generate sequential employee ID if not explicitly provided or marked AUTO
    let targetEmpId = body.employee_id;
    if (!targetEmpId || targetEmpId === 'AUTO-GENERATED' || targetEmpId.startsWith('AUTO')) {
      targetEmpId = await db.employees.generateNextEmployeeId();
    } else {
      targetEmpId = targetEmpId.trim();
      if (!/^[A-Z0-9 -]{3,30}$/i.test(targetEmpId)) {
        return NextResponse.json({ error: 'Employee ID must be 3-30 alphanumeric characters (hyphens and spaces allowed).' }, { status: 400 });
      }
    }

    const validated = createEmployeeSchema.parse({
      ...body,
      employee_id: targetEmpId,
    });

    const { salary: salaryData, ...employeeData } = validated;

    const newEmp = await db.employees.create(
      {
        ...employeeData,
        employee_id: targetEmpId,
        created_by: user.id,
      },
      user.id,
      user.email
    );

    // If salary information is supplied and user is authorized, upsert salary
    if (salaryData && (salaryData.annual_ctc !== undefined || salaryData.basic !== undefined || salaryData.monthly_gross !== undefined)) {
      const canManageSalary =
        hasPermission(user, 'salary.update') ||
        hasPermission(user, 'employee.create') ||
        user.role === 'SUPER_ADMIN' ||
        user.role === 'HR_ADMIN' ||
        user.role === 'PAYROLL_ADMIN';

      if (canManageSalary) {
        await db.salary.upsert({
          employee_id: newEmp.id,
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
          effective_date: salaryData.effective_date || newEmp.joining_date || new Date().toISOString().split('T')[0],
        }, user.id, user.email);
      }
    }

    return NextResponse.json(newEmp, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
