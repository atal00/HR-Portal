import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { logAuditEvent } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuthUser();
    const { id } = await params;
    const { newDataSnapshot, reason } = await req.json();

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: 'A justification is required for generating a new document version.' }, { status: 400 });
    }

    const newVersionDoc = await db.documents.createNewVersion(
      id,
      newDataSnapshot,
      reason,
      user.id,
      user.full_name
    );

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'DOCUMENT_NEW_VERSION_CREATED',
      resourceType: 'DOCUMENT',
      resourceId: newVersionDoc.document_number,
      metadata: {
        parent_document_id: id,
        new_version_number: newVersionDoc.version_number,
        change_reason: reason,
      },
    });

    return NextResponse.json(newVersionDoc, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
