import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { canApproveDocument, hasPermission } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const body = await req.json();
    const { action, documentIds, reason } = body;

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ error: 'Valid action (APPROVE or REJECT) is required.' }, { status: 400 });
    }

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'At least one document ID must be specified.' }, { status: 400 });
    }

    if (action === 'REJECT' && (!reason || reason.trim().length < 5)) {
      return NextResponse.json({ error: 'A rejection reason of at least 5 characters is mandatory.' }, { status: 400 });
    }

    const results: Array<{
      id: string;
      document_number?: string;
      title?: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const docId of documentIds) {
      try {
        const doc = await db.documents.getById(docId);
        if (!doc) {
          results.push({ id: docId, success: false, error: 'Document not found.' });
          continue;
        }

        if (doc.status !== 'PENDING_APPROVAL') {
          results.push({
            id: docId,
            document_number: doc.document_number,
            title: doc.title,
            success: false,
            error: `Document is not pending approval (current status: ${doc.status}).`,
          });
          continue;
        }

        if (action === 'APPROVE') {
          // Strictly evaluate server-side permission for this specific document type
          if (!canApproveDocument(user, doc.document_type)) {
            await logSecurityEvent({
              eventType: 'UNAUTHORIZED_APPROVAL_ATTEMPT',
              severity: 'HIGH',
              description: `User ${user.email} (${user.role}) attempted unauthorized bulk approval of document ${doc.document_number} (${doc.document_type}).`,
              userId: user.id,
            });
            results.push({
              id: docId,
              document_number: doc.document_number,
              title: doc.title,
              success: false,
              error: `Forbidden: You do not possess approval authority for ${doc.document_type.replace(/_/g, ' ')}.`,
            });
            continue;
          }

          const approvedDoc = await db.documents.approve(doc.id, user.id, user.full_name);
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
              bulk_execution: true,
            },
          });

          results.push({
            id: docId,
            document_number: approvedDoc.document_number,
            title: approvedDoc.title,
            success: true,
          });
        } else if (action === 'REJECT') {
          if (!hasPermission(user, 'document.reject')) {
            await logSecurityEvent({
              eventType: 'UNAUTHORIZED_ACTION',
              severity: 'MEDIUM',
              description: `User ${user.email} (${user.role}) attempted unauthorized bulk rejection of document ${doc.document_number}.`,
              userId: user.id,
            });
            results.push({
              id: docId,
              document_number: doc.document_number,
              title: doc.title,
              success: false,
              error: 'Forbidden: Insufficient authority to reject documents.',
            });
            continue;
          }

          const rejectedDoc = await db.documents.reject(doc.id, user.id, reason.trim(), user.full_name);
          await logAuditEvent({
            userId: user.id,
            userEmail: user.email,
            action: 'DOCUMENT_REJECTED',
            resourceType: 'DOCUMENT',
            resourceId: rejectedDoc.document_number,
            metadata: {
              document_type: rejectedDoc.document_type,
              reason: reason.trim(),
              rejected_by: user.full_name,
              bulk_execution: true,
            },
          });

          results.push({
            id: docId,
            document_number: rejectedDoc.document_number,
            title: rejectedDoc.title,
            success: true,
          });
        }
      } catch (err: any) {
        results.push({ id: docId, success: false, error: err.message || 'Execution error.' });
      }
    }

    const succeededCount = results.filter((r) => r.success).length;
    const failedCount = results.length - succeededCount;

    return NextResponse.json({
      summary: {
        total: results.length,
        succeeded: succeededCount,
        failed: failedCount,
      },
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
