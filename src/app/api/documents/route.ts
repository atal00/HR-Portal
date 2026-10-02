import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { DocumentType } from '@/types/database';
import { validateVerificationDomain } from '@/lib/utils';

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

    // Server-side validation: Inactive/Separated employees cannot have new documents generated
    const emp = await db.employees.getById(employee_id);
    if (!emp) {
      return NextResponse.json({ error: 'Associated employee record not found.' }, { status: 404 });
    }

    if (emp.status === 'INACTIVE' || emp.status === 'SEPARATED' || emp.deletion_status === 'DELETED') {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'MEDIUM',
        description: `User ${user.email} attempted to generate ${document_type} for inactive/separated employee ${emp.employee_id} (${emp.full_name}).`,
        userId: user.id,
      });
      return NextResponse.json(
        { error: `Forbidden: Cannot generate new ${document_type} for inactive or separated employee (${emp.employee_id} - ${emp.full_name}). Historical documents remain preserved under audit retention.` },
        { status: 403 }
      );
    }

    // Requirement 17: Validate that the canonical public verification URL is configured before generating official QR
    const isProduction = process.env.NODE_ENV === 'production';
    const validation = validateVerificationDomain(isProduction);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Configuration Error: ${validation.error}. Official document generation halted.` },
        { status: 500 }
      );
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

    // Requirement 21: Audit specific document workflow events
    if (document_type === 'OFFER_LETTER') {
      if (data_snapshot.bondIncluded === true) {
        await logAuditEvent({
          userId: user.id,
          userEmail: user.email,
          action: 'OFFER_BOND_SELECTED' as any,
          resourceType: 'DOCUMENT',
          resourceId: doc.document_number,
          metadata: {
            bondPeriodMonths: data_snapshot.bondPeriodMonths,
            bondPenaltyAmount: data_snapshot.bondPenaltyAmount,
          },
        });
      }
      if (data_snapshot.additionalClauses) {
        await logAuditEvent({
          userId: user.id,
          userEmail: user.email,
          action: 'OFFER_CUSTOM_CLAUSE_UPDATED' as any,
          resourceType: 'DOCUMENT',
          resourceId: doc.document_number,
          metadata: {
            hasCustomClause: true,
          },
        });
      }
      if (data_snapshot.isSalaryRevision) {
        await logAuditEvent({
          userId: user.id,
          userEmail: user.email,
          action: 'OFFER_REVISION_CREATED' as any,
          resourceType: 'DOCUMENT',
          resourceId: doc.document_number,
          metadata: {
            previousCtc: data_snapshot.previousCtc,
            revisedCtc: data_snapshot.revisedCtc,
            revisionEffectiveDate: data_snapshot.revisionEffectiveDate,
          },
        });
      }
    }

    return NextResponse.json(doc, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
