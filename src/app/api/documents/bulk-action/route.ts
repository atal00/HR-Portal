import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { canApproveDocument, canRevokeDocument, canAccessSalary, hasPermission } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { rateLimiter } from '@/lib/rate-limit';
import { formatSafeApiError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    // Rate limiting: 5 bulk action requests per minute per user/IP
    // Note: In-memory rate limiting operates per Node.js server instance.
    const rateCheck = rateLimiter.check(`bulk_action:${user.id || ip}`, 5, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: `Bulk action rate limit exceeded. Please wait ${rateCheck.resetSeconds} seconds before trying again.` },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.resetSeconds),
          },
        }
      );
    }

    const body = await req.json();
    const { action, documentIds, reason } = body;

    if (!action || !['APPROVE', 'REJECT', 'REVOKE', 'DELETE'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action (APPROVE, REJECT, REVOKE, or DELETE) is required.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'At least one document ID must be specified.' }, { status: 400 });
    }

    if (documentIds.length > 50) {
      return NextResponse.json(
        { error: 'Bulk actions are capped at a maximum of 50 documents per request.' },
        { status: 400 }
      );
    }

    // Deduplicate IDs before processing
    const uniqueDocIds = Array.from(new Set(documentIds));

    // Validate ID format (alphanumeric, hyphen, underscore, 1-64 chars)
    const idFormatRegex = /^[a-zA-Z0-9_-]{1,64}$/;
    for (const docId of uniqueDocIds) {
      if (typeof docId !== 'string' || !idFormatRegex.test(docId.trim())) {
        return NextResponse.json(
          { error: 'Invalid document ID format detected.' },
          { status: 400 }
        );
      }
    }

    const cleanReason = typeof reason === 'string' ? reason.trim() : '';

    if (action === 'REJECT' && cleanReason.length < 5) {
      return NextResponse.json({ error: 'A rejection reason of at least 5 characters is mandatory.' }, { status: 400 });
    }

    if (action === 'REVOKE' && cleanReason.length < 5) {
      return NextResponse.json({ error: 'A revocation reason of at least 5 characters is mandatory.' }, { status: 400 });
    }

    if (action === 'DELETE' && cleanReason.length < 3) {
      return NextResponse.json({ error: 'A deletion reason of at least 3 characters is mandatory.' }, { status: 400 });
    }

    // Server-side RBAC check for bulk delete
    if (action === 'DELETE' && !hasPermission(user, 'document.delete') && user.role !== 'SUPER_ADMIN') {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACTION',
        severity: 'HIGH',
        description: `User ${user.email} (${user.role}) attempted unauthorized bulk deletion without document.delete permission.`,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Forbidden: You do not possess authority to delete official documents.' },
        { status: 403 }
      );
    }

    // Server-side RBAC check for bulk revoke
    if (action === 'REVOKE' && !canRevokeDocument(user)) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACTION',
        severity: 'HIGH',
        description: `User ${user.email} (${user.role}) attempted unauthorized bulk revocation without document.revoke permission.`,
        userId: user.id,
      });
      return NextResponse.json(
        { error: 'Forbidden: You do not possess authority to revoke official documents.' },
        { status: 403 }
      );
    }

    const results: Array<{
      id: string;
      document_number?: string;
      title?: string;
      status?: string;
      outcome: 'succeeded' | 'skipped' | 'failed';
      success: boolean;
      action?: string;
      message?: string;
      error?: string;
    }> = [];

    for (const docId of uniqueDocIds) {
      try {
        const doc = await db.documents.getById(docId);
        if (!doc) {
          results.push({
            id: docId,
            outcome: 'failed',
            success: false,
            error: 'Document not found.',
          });
          continue;
        }

        // Confidential salary slip guard across all actions
        if (doc.document_type === 'SALARY_SLIP') {
          const hasSalaryAccess =
            canAccessSalary(user) ||
            hasPermission(user, 'document.salary.view') ||
            user.role === 'SUPER_ADMIN';

          if (!hasSalaryAccess) {
            await logSecurityEvent({
              eventType: 'CONFIDENTIAL_DATA_BREACH_ATTEMPT',
              severity: 'HIGH',
              description: `User ${user.email} (${user.role}) attempted unauthorized bulk ${action} on confidential SALARY_SLIP ${doc.document_number} without salary permissions.`,
              userId: user.id,
            });
            results.push({
              id: docId,
              document_number: doc.document_number,
              title: doc.title,
              status: doc.status,
              outcome: 'failed',
              success: false,
              error: 'Forbidden: Insufficient privileges to operate on confidential salary documentation.',
            });
            continue;
          }
        }

        // =====================================================================
        // ACTION: APPROVE
        // =====================================================================
        if (action === 'APPROVE') {
          // Lifecycle check: only PENDING_APPROVAL can be approved
          if (doc.status === 'APPROVED') {
            results.push({
              id: docId,
              document_number: doc.document_number,
              title: doc.title,
              status: doc.status,
              outcome: 'skipped',
              success: false,
              message: `Document ${doc.document_number} is already approved.`,
            });
            continue;
          }

          if (doc.status !== 'PENDING_APPROVAL') {
            results.push({
              id: docId,
              document_number: doc.document_number,
              title: doc.title,
              status: doc.status,
              outcome: 'skipped',
              success: false,
              error: `Document is in status "${doc.status}" and cannot be approved (only PENDING_APPROVAL documents are eligible).`,
            });
            continue;
          }

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
              status: doc.status,
              outcome: 'failed',
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
            status: approvedDoc.status,
            outcome: 'succeeded',
            success: true,
            message: `Document ${approvedDoc.document_number} approved successfully.`,
          });
        }

        // =====================================================================
        // ACTION: REJECT
        // =====================================================================
        else if (action === 'REJECT') {
          if (doc.status !== 'PENDING_APPROVAL') {
            results.push({
              id: docId,
              document_number: doc.document_number,
              title: doc.title,
              status: doc.status,
              outcome: 'skipped',
              success: false,
              error: `Document is not pending approval (current status: ${doc.status}).`,
            });
            continue;
          }

          if (!hasPermission(user, 'document.reject') && user.role !== 'SUPER_ADMIN') {
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
              status: doc.status,
              outcome: 'failed',
              success: false,
              error: 'Forbidden: Insufficient authority to reject documents.',
            });
            continue;
          }

          const rejectedDoc = await db.documents.reject(doc.id, user.id, cleanReason, user.full_name);
          await logAuditEvent({
            userId: user.id,
            userEmail: user.email,
            action: 'DOCUMENT_REJECTED',
            resourceType: 'DOCUMENT',
            resourceId: rejectedDoc.document_number,
            metadata: {
              document_type: rejectedDoc.document_type,
              reason: cleanReason,
              rejected_by: user.full_name,
              bulk_execution: true,
            },
          });

          results.push({
            id: docId,
            document_number: rejectedDoc.document_number,
            title: rejectedDoc.title,
            status: rejectedDoc.status,
            outcome: 'succeeded',
            success: true,
            message: `Document ${rejectedDoc.document_number} rejected successfully.`,
          });
        }

        // =====================================================================
        // ACTION: REVOKE
        // =====================================================================
        else if (action === 'REVOKE') {
          // Idempotency: already revoked documents are protected and skipped
          if (doc.status === 'REVOKED') {
            results.push({
              id: docId,
              document_number: doc.document_number,
              title: doc.title,
              status: doc.status,
              outcome: 'skipped',
              success: false,
              message: `Document ${doc.document_number} is already revoked.`,
            });
            continue;
          }

          // Lifecycle rule: Only APPROVED / finalized documents can be revoked
          if (doc.status !== 'APPROVED' && (doc.status as string) !== 'FINAL') {
            results.push({
              id: docId,
              document_number: doc.document_number,
              title: doc.title,
              status: doc.status,
              outcome: 'skipped',
              success: false,
              error: `Document is in status "${doc.status}" and cannot be revoked (only approved documents can be revoked).`,
            });
            continue;
          }

          const revokedDoc = await db.documents.revoke(doc.id, user.id, user.full_name, cleanReason);
          await logAuditEvent({
            userId: user.id,
            userEmail: user.email,
            action: 'DOCUMENT_REVOKED',
            resourceType: 'DOCUMENT',
            resourceId: revokedDoc.document_number,
            reason: cleanReason,
            metadata: {
              document_id: revokedDoc.id,
              document_number: revokedDoc.document_number,
              verification_id: revokedDoc.verification_id,
              document_type: revokedDoc.document_type,
              revocation_reason: cleanReason,
              revoked_by: user.full_name,
              bulk_execution: true,
              timestamp: new Date().toISOString(),
            },
          });

          results.push({
            id: docId,
            document_number: revokedDoc.document_number,
            title: revokedDoc.title,
            status: revokedDoc.status,
            outcome: 'succeeded',
            success: true,
            message: `Document ${revokedDoc.document_number} revoked successfully.`,
          });
        }

        // =====================================================================
        // ACTION: DELETE
        // =====================================================================
        else if (action === 'DELETE') {
          // Protected document retention enforcement:
          // Under statutory compliance and enterprise retention policy,
          // APPROVED, FINAL, and REVOKED documents cannot be deleted and remain untouched.
          if (['APPROVED', 'FINAL', 'REVOKED'].includes(doc.status)) {
            const isRevoked = doc.status === 'REVOKED';
            results.push({
              id: docId,
              document_number: doc.document_number,
              title: doc.title,
              status: doc.status,
              outcome: 'skipped',
              action: isRevoked ? 'ALREADY_REVOKED' : 'PROTECTED_SKIPPED',
              success: false,
              message: isRevoked
                ? `Document ${doc.document_number} is already revoked and retained for compliance.`
                : `Document ${doc.document_number} (${doc.status}) is protected under statutory retention and cannot be deleted.`,
            });
            continue;
          }

          // Pre-approval / working / unapproved draft states:
          // DRAFT, PREVIEW, VALIDATE, GENERATE, PENDING_APPROVAL, REJECTED
          const deleteResult = await db.documents.delete(doc.id, user.id, user.email, cleanReason);

          results.push({
            id: docId,
            document_number: doc.document_number,
            title: doc.title,
            status: 'DELETED',
            outcome: 'succeeded',
            action: deleteResult.action,
            success: true,
            message: `Document ${doc.document_number} permanently deleted from active registry.`,
          });
        }
      } catch (err: any) {
        results.push({
          id: docId,
          outcome: 'failed',
          success: false,
          error: err.message || 'Execution error processing document.',
        });
      }
    }

    const succeededCount = results.filter((r) => r.outcome === 'succeeded').length;
    const skippedCount = results.filter((r) => r.outcome === 'skipped').length;
    const failedCount = results.filter((r) => r.outcome === 'failed').length;

    return NextResponse.json({
      summary: {
        total: results.length,
        succeeded: succeededCount,
        skipped: skippedCount,
        failed: failedCount,
      },
      results,
    });
  } catch (error: any) {
    const { error: safeError, status } = formatSafeApiError(error);
    return NextResponse.json({ error: safeError }, { status });
  }
}

