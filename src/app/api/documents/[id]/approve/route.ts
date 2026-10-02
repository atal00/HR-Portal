import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { canApproveDocument } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();

    const { id } = await params;
    const targetDoc = await db.documents.getById(id);
    if (!targetDoc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    if (!canApproveDocument(user, targetDoc.document_type)) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_APPROVAL_ATTEMPT',
        severity: 'HIGH',
        description: `User ${user.email} (${user.role}) attempted to approve document ${targetDoc.document_number} (${targetDoc.document_type}) without approval authority.`,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Forbidden: Insufficient authority to approve documents.' }, { status: 403 });
    }

    const approvedDoc = await db.documents.approve(id, user.id, user.full_name);

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'DOCUMENT_APPROVED',
      resourceType: 'DOCUMENT',
      resourceId: approvedDoc.document_number,
      metadata: {
        document_type: approvedDoc.document_type,
        verification_id: approvedDoc.verification_id,
        approver: user.full_name,
      },
    });

    return NextResponse.json(approvedDoc);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
