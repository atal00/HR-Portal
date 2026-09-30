import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { canRevokeDocument } from '@/lib/rbac';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();

    // Only Super Admin and HR Admin can revoke
    if (!canRevokeDocument(user)) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_REVOCATION_ATTEMPT',
        severity: 'CRITICAL',
        description: `User ${user.email} (${user.role}) attempted to revoke document without revocation privileges.`,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to revoke official documents.' }, { status: 403 });
    }

    const { id } = await params;
    const { reason, confirmation } = await req.json();

    if (!confirmation) {
      return NextResponse.json({ error: 'Revocation confirmation is strictly required.' }, { status: 400 });
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: 'A valid business justification is required for document revocation.' }, { status: 400 });
    }

    const revokedDoc = await db.documents.revoke(id, user.id, user.full_name, reason);

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'DOCUMENT_REVOKED',
      resourceType: 'DOCUMENT',
      resourceId: revokedDoc.document_number,
      metadata: {
        verification_id: revokedDoc.verification_id,
        reason: reason,
        revoked_by: user.full_name,
      },
    });

    return NextResponse.json(revokedDoc);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
