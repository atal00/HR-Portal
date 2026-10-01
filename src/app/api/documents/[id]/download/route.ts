import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { generateSignedDownloadToken, verifySignedDownloadToken } from '@/lib/storage';
import { logAuditEvent, logSecurityEvent } from '@/lib/audit';
import { rateLimiter } from '@/lib/rate-limit';

// Helper to validate download permission based on document type
function checkDocumentDownloadPermission(user: any, doc: any): { allowed: boolean; requiredPermission: string } {
  // Super admin always has bypass
  if (user.role === 'SUPER_ADMIN') {
    return { allowed: true, requiredPermission: 'ALL' };
  }

  switch (doc.document_type) {
    case 'SALARY_SLIP':
      if (hasPermission(user, 'salary.view') || hasPermission(user, 'document.salary.download')) {
        return { allowed: true, requiredPermission: 'salary.view' };
      }
      return { allowed: false, requiredPermission: 'salary.view' };

    case 'OFFER_LETTER':
      if (hasPermission(user, 'document.offer.download')) {
        return { allowed: true, requiredPermission: 'document.offer.download' };
      }
      return { allowed: false, requiredPermission: 'document.offer.download' };

    case 'EXPERIENCE_LETTER':
      if (hasPermission(user, 'document.experience.download')) {
        return { allowed: true, requiredPermission: 'document.experience.download' };
      }
      return { allowed: false, requiredPermission: 'document.experience.download' };

    case 'CERTIFICATE':
      if (hasPermission(user, 'document.certificate.download')) {
        return { allowed: true, requiredPermission: 'document.certificate.download' };
      }
      return { allowed: false, requiredPermission: 'document.certificate.download' };

    default:
      return { allowed: false, requiredPermission: 'UNKNOWN' };
  }
}

// POST: Request signed download URL for document
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    // 1. Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required to obtain signed download token.' }, { status: 401 });
    }

    // Rate Limit: 10 download requests per minute per user/IP
    const rateCheck = rateLimiter.check(`download:${user.id || ip}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { 
          error: `Download rate limit exceeded. Please wait ${rateCheck.resetSeconds} seconds before requesting new downloads.` 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.resetSeconds),
          }
        }
      );
    }

    // 2. Load document
    const doc = await db.documents.getById(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    // 3 & 4. Determine document type and check required permission
    const permCheck = checkDocumentDownloadPermission(user, doc);
    if (!permCheck.allowed) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        description: `User ${user.email} (${user.role}) denied download of ${doc.document_type} ${doc.document_number}. Required permission: ${permCheck.requiredPermission}`,
        userId: user.id,
        ipAddress: ip,
      });
      return NextResponse.json(
        { error: `Forbidden: You do not possess permission to download ${doc.document_type} documents.` },
        { status: 403 }
      );
    }

    // 5. Generate signed URL
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

// GET: Download document via token OR authenticated browser direct request
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';

    // Case 1: If downloading via signed token link
    if (token) {
      const verification = verifySignedDownloadToken(token);
      if (!verification.valid || verification.documentId !== id) {
        await logSecurityEvent({
          eventType: 'EXPIRED_OR_FORGED_DOWNLOAD_TOKEN',
          severity: 'HIGH',
          description: `Download blocked: ${verification.error}`,
          ipAddress: ip,
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

    // Case 2: Authenticated user requesting a new signed download link via GET
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required to obtain signed download token.' }, { status: 401 });
    }

    // Rate Limit check
    const rateCheck = rateLimiter.check(`download:${user.id || ip}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { 
          error: `Download rate limit exceeded. Please wait ${rateCheck.resetSeconds} seconds.` 
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(rateCheck.resetSeconds),
          }
        }
      );
    }

    const doc = await db.documents.getById(id);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found.' }, { status: 404 });
    }

    // Check permission
    const permCheck = checkDocumentDownloadPermission(user, doc);
    if (!permCheck.allowed) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        description: `User ${user.email} (${user.role}) denied download token for ${doc.document_type} ${doc.document_number}`,
        userId: user.id,
        ipAddress: ip,
      });
      return NextResponse.json(
        { error: `Forbidden: You do not possess permission to download ${doc.document_type} documents.` },
        { status: 403 }
      );
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
