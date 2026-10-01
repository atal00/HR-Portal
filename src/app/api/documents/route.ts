import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { DocumentType } from '@/types/database';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;
    const employeeId = searchParams.get('employeeId') || undefined;
    const search = searchParams.get('search') || undefined;

    // Permission check for salary documents
    const canViewSalary = hasPermission(user, 'salary.view') || hasPermission(user, 'document.salary.view') || user.role === 'SUPER_ADMIN';

    // If specifically requesting SALARY_SLIP type and lacks permission -> 403 Forbidden
    if (type === 'SALARY_SLIP' && !canViewSalary) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        description: `User ${user.email} (${user.role}) denied listing SALARY_SLIP documents`,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Forbidden. Missing required permission: salary.view' }, { status: 403 });
    }

    const list = await db.documents.list({ type, status, employeeId, search });

    // Non-payroll users must NOT receive SALARY_SLIP records at all
    const filteredList = canViewSalary ? list : list.filter((d) => d.document_type !== 'SALARY_SLIP');

    return NextResponse.json(filteredList);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();

    const { document_type, employee_id, title, data_snapshot } = body;

    if (!document_type || !employee_id || !title || !data_snapshot) {
      return NextResponse.json({ error: 'Missing required document fields.' }, { status: 400 });
    }

    // Server-side RBAC permission check for document type
    const requiredPermission = `document.${(document_type as string).toLowerCase().split('_')[0]}.create` as any;
    if (!hasPermission(user, requiredPermission)) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        description: `User ${user.email} attempted to generate ${document_type} without permission.`,
        userId: user.id,
      });
      return NextResponse.json({ error: `Forbidden: You do not possess permission to generate ${document_type}.` }, { status: 403 });
    }

    const doc = await db.documents.create({
      document_type,
      employee_id,
      title,
      data_snapshot,
      created_by: user.id,
      created_by_name: user.full_name,
      status: 'PENDING_APPROVAL',
    });

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'DOCUMENT_CREATED',
      resourceType: 'DOCUMENT',
      resourceId: doc.document_number,
      metadata: {
        document_type: doc.document_type,
        verification_id: doc.verification_id,
        employee_id: doc.employee_id,
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
