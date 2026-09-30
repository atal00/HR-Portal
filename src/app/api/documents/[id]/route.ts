import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuthUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

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

    await logAuditEvent({
      userId: user.id,
      userEmail: user.email,
      action: 'DOCUMENT_VIEWED',
      resourceType: 'DOCUMENT',
      resourceId: doc.document_number,
    });

    return NextResponse.json(doc);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
