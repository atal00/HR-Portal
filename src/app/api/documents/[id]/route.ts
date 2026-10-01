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
    const { id } = await params;

    const doc = await db.documents.getById(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Strict document-type authorization check
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
            { error: 'Forbidden. Missing required permission: salary.view' },
            { status: 403 }
          );
        }
      } else if (doc.document_type === 'OFFER_LETTER' && !hasPermission(user, 'document.offer.view')) {
        return NextResponse.json({ error: 'Forbidden. Missing required permission: document.offer.view' }, { status: 403 });
      } else if (doc.document_type === 'EXPERIENCE_LETTER' && !hasPermission(user, 'document.experience.view')) {
        return NextResponse.json({ error: 'Forbidden. Missing required permission: document.experience.view' }, { status: 403 });
      } else if (doc.document_type === 'RELIEVING_LETTER' && !hasPermission(user, 'document.relieving.view')) {
        return NextResponse.json({ error: 'Forbidden. Missing required permission: document.relieving.view' }, { status: 403 });
      } else if (doc.document_type === 'CERTIFICATE' && !hasPermission(user, 'document.certificate.view')) {
        return NextResponse.json({ error: 'Forbidden. Missing required permission: document.certificate.view' }, { status: 403 });
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
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
