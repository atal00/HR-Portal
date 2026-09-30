import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { generateSignedDownloadToken, verifySignedDownloadToken } from '@/lib/storage';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    // Case 1: If downloading via signed token link
    if (token) {
      const verification = verifySignedDownloadToken(token);
      if (!verification.valid || verification.documentId !== id) {
        await logSecurityEvent({
          eventType: 'EXPIRED_OR_FORGED_DOWNLOAD_TOKEN',
          severity: 'HIGH',
          description: `Download blocked: ${verification.error}`,
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        });
        return NextResponse.json({ error: verification.error }, { status: 401 });
      }

      const doc = await db.documents.getById(id);
      if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

      await logAuditEvent({
        action: 'DOCUMENT_DOWNLOADED',
        resourceType: 'DOCUMENT',
        resourceId: doc.document_number,
        metadata: { via_signed_token: true },
      });

      return NextResponse.json({
        success: true,
        document_number: doc.document_number,
        title: doc.title,
        status: doc.status,
        data_snapshot: doc.data_snapshot,
      });
    }

    // Case 2: Authenticated user requesting a new signed download link
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required to obtain signed download token.' }, { status: 401 });
    }

    const doc = await db.documents.getById(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    const signedToken = generateSignedDownloadToken(doc.id, 900); // 15 minutes
    const signedUrl = `/api/documents/${doc.id}/download?token=${signedToken}`;

    return NextResponse.json({
      success: true,
      signedUrl,
      expiresInSeconds: 900,
      documentNumber: doc.document_number,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
