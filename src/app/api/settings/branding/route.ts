import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { logSecurityEvent } from '@/lib/audit';
import {
  getBrandingSettings,
  saveBrandingSettings,
  validateImageBuffer,
  uploadPrivateAsset,
} from '@/lib/branding';

export async function GET() {
  try {
    await requireAuthUser();
    const settings = await getBrandingSettings();
    return NextResponse.json(settings);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthUser();

    // Check permissions
    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'system.settings' as any)) {
      await logSecurityEvent({
        eventType: 'UNAUTHORIZED_ACCESS',
        severity: 'HIGH',
        description: `User ${user.email} attempted to update branding settings without authority.`,
        userId: user.id,
      });
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to update document branding.' }, { status: 403 });
    }

    const contentType = req.headers.get('content-type') || '';
    const current = await getBrandingSettings();

    // 1. Multipart Form Data: Upload Signature or Stamp Image
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const target = (formData.get('target') as string) || 'signature'; // 'signature' | 'stamp'

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
      }

      // Size limit: 2MB for signature, 3MB for stamp
      const maxSize = target === 'signature' ? 2 * 1024 * 1024 : 3 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json({
          error: `File size exceeds maximum allowed (${target === 'signature' ? '2MB' : '3MB'}).`
        }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Validate image format and integrity
      const validation = validateImageBuffer(buffer, file.type);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      if (target === 'signature') {
        const nextVersion = current.signatory.version + 1;
        const uploadResult = await uploadPrivateAsset('signatures', buffer, file.type, nextVersion);

        // Archive current
        const oldSignatures = current.history?.signatures || [];
        oldSignatures.unshift({ ...current.signatory });

        current.signatory = {
          ...current.signatory,
          signature_url: uploadResult.assetUrl,
          storage_path: uploadResult.storagePath,
          version: nextVersion,
          updated_at: new Date().toISOString(),
        };
        current.history = { ...current.history, signatures: oldSignatures, stamps: current.history?.stamps || [] };
      } else if (target === 'stamp') {
        const nextVersion = current.stamp.version + 1;
        const uploadResult = await uploadPrivateAsset('stamps', buffer, file.type, nextVersion);

        // Archive current
        const oldStamps = current.history?.stamps || [];
        oldStamps.unshift({ ...current.stamp });

        current.stamp = {
          ...current.stamp,
          stamp_url: uploadResult.assetUrl,
          storage_path: uploadResult.storagePath,
          version: nextVersion,
          updated_at: new Date().toISOString(),
        };
        current.history = { ...current.history, stamps: oldStamps, signatures: current.history?.signatures || [] };
      }

      await saveBrandingSettings(current, user);
      return NextResponse.json(current);
    }

    // 2. JSON Payload: Update metadata & active statuses
    const body = await req.json();

    if (body.signatory) {
      current.signatory = {
        ...current.signatory,
        name: body.signatory.name !== undefined ? body.signatory.name.trim() : current.signatory.name,
        title: body.signatory.title !== undefined ? body.signatory.title.trim() : current.signatory.title,
        department: body.signatory.department !== undefined ? body.signatory.department.trim() : current.signatory.department,
        company: body.signatory.company !== undefined ? body.signatory.company.trim() : current.signatory.company,
        is_active: body.signatory.is_active !== undefined ? Boolean(body.signatory.is_active) : current.signatory.is_active,
        effective_from: body.signatory.effective_from || current.signatory.effective_from,
        updated_at: new Date().toISOString(),
      };
    }

    if (body.stamp) {
      current.stamp = {
        ...current.stamp,
        is_active: body.stamp.is_active !== undefined ? Boolean(body.stamp.is_active) : current.stamp.is_active,
        effective_from: body.stamp.effective_from || current.stamp.effective_from,
        updated_at: new Date().toISOString(),
      };
    }

    await saveBrandingSettings(current, user);
    return NextResponse.json(current);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
