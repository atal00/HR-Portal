import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { canApproveDocument } from '@/lib/rbac';
import { logAuditEvent } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();

    if (!canApproveDocument(user)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient authority to review documents.' }, { status: 403 });
    }

    const { id } = await params;
    const { reason } = await req.json();

    const rejectedDoc = await db.documents.reject(id, user.id, user.full_name, reason || 'Rejected by reviewer');

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'DOCUMENT_REJECTED',
      resourceType: 'DOCUMENT',
      resourceId: rejectedDoc.document_number,
      metadata: { reason },
    });

    return NextResponse.json(rejectedDoc);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
