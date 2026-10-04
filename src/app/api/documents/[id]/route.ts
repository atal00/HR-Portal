import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { formatSafeApiError } from '@/lib/errors';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    const { id } = await params;

    const doc = await db.documents.getById(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Strict document-type authorization check
    // P5 remediation: return 404 to avoid revealing resource existence/type to unauthorized callers
    if (user.role !== 'SUPER_ADMIN') {
      if (doc.document_type === 'SALARY_SLIP') {
        const canView = hasPermission(user, 'salary.view') || hasPermission(user, 'document.salary.view');
        if (!canView) {
          await logSecurityEvent({
            eventType: 'UNAUTHORIZED_ACCESS',
            severity: 'HIGH',
            description: `User ${user.email} (${user.role}) denied direct access to SALARY_SLIP document ${doc.document_number}`,
            userId: user.id,
          });
          return NextResponse.json(
            { error: 'Document not found' },
            { status: 404 }
          );
        }
      } else if (doc.document_type === 'OFFER_LETTER' && !hasPermission(user, 'document.offer.view')) {
        await logSecurityEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'HIGH',
          description: `User ${user.email} (${user.role}) denied direct access to OFFER_LETTER document ${doc.document_number}`,
          userId: user.id,
        });
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      } else if (doc.document_type === 'EXPERIENCE_LETTER' && !hasPermission(user, 'document.experience.view')) {
        await logSecurityEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'HIGH',
          description: `User ${user.email} (${user.role}) denied direct access to EXPERIENCE_LETTER document ${doc.document_number}`,
          userId: user.id,
        });
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      } else if (doc.document_type === 'RELIEVING_LETTER' && !hasPermission(user, 'document.relieving.view')) {
        await logSecurityEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'HIGH',
          description: `User ${user.email} (${user.role}) denied direct access to RELIEVING_LETTER document ${doc.document_number}`,
          userId: user.id,
        });
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      } else if (doc.document_type === 'CERTIFICATE' && !hasPermission(user, 'document.certificate.view')) {
        await logSecurityEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'HIGH',
          description: `User ${user.email} (${user.role}) denied direct access to CERTIFICATE document ${doc.document_number}`,
          userId: user.id,
        });
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
    }

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'DOCUMENT_VIEWED',
      resourceType: 'DOCUMENT',
      resourceId: doc.document_number,
    });

    return NextResponse.json(doc);
  } catch (error: any) {
    const { error: safeError, status } = formatSafeApiError(error);
    return NextResponse.json({ error: safeError }, { status });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    const { id } = await params;

    // RBAC: Must have document.delete permission or SUPER_ADMIN
    const canDelete = hasPermission(user, 'document.delete') || user.role === 'SUPER_ADMIN';
    if (!canDelete) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        description: `User ${user.email} (${user.role}) denied document deletion permission for document ID ${id}`,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Forbidden. Missing required permission: document.delete' },
        { status: 403 }
      );
    }

    const doc = await db.documents.getById(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Statutory retention rule: REVOKED documents cannot be physically deleted
    if (doc.status === 'REVOKED') {
      return NextResponse.json(
        {
          error: 'REVOKED documents are retained for compliance and cannot be physically deleted.',
          action: 'ALREADY_REVOKED',
          document: doc,
        },
        { status: 400 }
      );
    }

    // Confidential salary document protection:
    // Non-super-admin users deleting salary slips must also hold salary authorization
    if (doc.document_type === 'SALARY_SLIP' && user.role !== 'SUPER_ADMIN') {
      const canAccessSalary = hasPermission(user, 'salary.view') || hasPermission(user, 'document.salary.view');
      if (!canAccessSalary) {
        await logSecurityEvent({
          eventType: 'UNAUTHORIZED_ACCESS',
          severity: 'HIGH',
          description: `User ${user.email} (${user.role}) attempted to delete confidential SALARY_SLIP document ${doc.document_number} without salary permissions`,
          userId: user.id,
        });
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }
    }

    const body = await req.json().catch(() => ({}));
    const reason = body?.reason;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json(
        { error: 'A mandatory deletion reason is required.' },
        { status: 400 }
      );
    }

    const result = await db.documents.delete(
      doc.id,
      user.id,
      user.email,
      reason.trim()
    );

    return NextResponse.json(
      {
        success: true,
        action: result.action,
        message: result.action === 'REVOKED'
          ? 'Document has been formally revoked and archived in compliance with enterprise audit retention.'
          : 'Document has been successfully deleted from the registry.',
        document: result.document,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    const { error: safeError, status } = formatSafeApiError(error);
    return NextResponse.json(
      { error: safeError },
      { status }
    );
  }
}

