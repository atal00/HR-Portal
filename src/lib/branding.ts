import fs from 'fs';
import path from 'path';
import { db } from './db';
import { getSupabaseAdminClient } from './supabase';
import { logAuditEvent } from './audit';

export const ASSETS_BUCKET = 'hr-assets';

export interface SignatoryBranding {
  id: string;
  name: string;
  title: string;
  department: string;
  company: string;
  signature_url: string;
  storage_path?: string;
  version: number;
  is_active: boolean;
  effective_from: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface StampBranding {
  id: string;
  stamp_url: string;
  storage_path?: string;
  version: number;
  is_active: boolean;
  effective_from: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface DocumentBrandingSettings {
  signatory: SignatoryBranding;
  stamp: StampBranding;
  history?: {
    signatures: SignatoryBranding[];
    stamps: StampBranding[];
  };
}

const DEFAULT_BRANDING: DocumentBrandingSettings = {
  signatory: {
    id: 'sig-default',
    name: 'Authorized Signatory',
    title: 'Authorized Signatory',
    department: 'HR Department',
    company: 'Varsaka Labs',
    signature_url: '/brand/sign.jpeg',
    version: 1,
    is_active: true,
    effective_from: '2026-01-01',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  stamp: {
    id: 'stamp-default',
    stamp_url: '/brand/varsaka-seal.png',
    version: 1,
    is_active: true,
    effective_from: '2026-01-01',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
  history: {
    signatures: [],
    stamps: [],
  },
};

export async function getBrandingSettings(): Promise<DocumentBrandingSettings> {
  try {
    const raw = await db.systemSettings.get('document_branding');
    if (!raw) return DEFAULT_BRANDING;
    return {
      signatory: { ...DEFAULT_BRANDING.signatory, ...(raw.signatory || {}) },
      stamp: { ...DEFAULT_BRANDING.stamp, ...(raw.stamp || {}) },
      history: {
        signatures: raw.history?.signatures || [],
        stamps: raw.history?.stamps || [],
      },
    };
  } catch (error) {
    console.error('Failed to load branding settings, using defaults:', error);
    return DEFAULT_BRANDING;
  }
}

export async function saveBrandingSettings(
  settings: Partial<DocumentBrandingSettings>,
  user: { id: string; email?: string } | string
): Promise<DocumentBrandingSettings> {
  const current = await getBrandingSettings();
  const merged: DocumentBrandingSettings = {
    signatory: { ...current.signatory, ...(settings.signatory || {}) },
    stamp: { ...current.stamp, ...(settings.stamp || {}) },
    history: {
      signatures: settings.history?.signatures || current.history?.signatures || [],
      stamps: settings.history?.stamps || current.history?.stamps || [],
    },
  };

  await db.systemSettings.set(
    'document_branding',
    merged,
    'Official Document Branding, Authorized Signatory, and Corporate Seal Configuration'
  );

  const userId = typeof user === 'string' ? user : user.id;
  const userEmail = typeof user === 'string' ? 'admin@in.varsaka.com' : (user.email || 'admin@in.varsaka.com');

  try {
    await logAuditEvent({
      userId,
      userEmail,
      action: 'SETTINGS_UPDATED',
      resourceType: 'SYSTEM_SETTINGS',
      resourceId: 'document_branding',
      metadata: {
        signatory_name: merged.signatory.name,
        signatory_version: merged.signatory.version,
        signatory_active: merged.signatory.is_active,
        stamp_version: merged.stamp.version,
        stamp_active: merged.stamp.is_active,
      },
    });
  } catch (err) {
    console.error('Audit log error for branding settings update:', err);
  }

  return merged;
}

/**
 * Validate image buffer to ensure it is not corrupt and is a valid PNG/JPEG/WEBP image
 */
export function validateImageBuffer(buffer: Buffer, mimeType: string): { valid: boolean; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { valid: false, error: 'Empty file payload.' };
  }

  const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  const lowerMime = mimeType.toLowerCase();
  if (!allowedMimes.includes(lowerMime)) {
    return { valid: false, error: `Unsupported image format (${mimeType}). Supported: PNG, JPG, WEBP.` };
  }

  // Check magic bytes
  const isPng = buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = buffer.length > 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';

  if (!isPng && !isJpeg && !isWebp) {
    return { valid: false, error: 'Corrupted image file: File header magic bytes do not match declared image type.' };
  }

  if (lowerMime === 'image/png' && !isPng) {
    return { valid: false, error: 'File contents do not match PNG image format.' };
  }
  if ((lowerMime === 'image/jpeg' || lowerMime === 'image/jpg') && !isJpeg) {
    return { valid: false, error: 'File contents do not match JPEG image format.' };
  }
  if (lowerMime === 'image/webp' && !isWebp) {
    return { valid: false, error: 'File contents do not match WebP image format.' };
  }

  return { valid: true };
}

/**
 * Saves uploaded asset privately to Supabase Storage or local secure disk
 */
export async function uploadPrivateAsset(
  type: 'signatures' | 'stamps',
  buffer: Buffer,
  mimeType: string,
  version: number
): Promise<{ storagePath: string; assetUrl: string }> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const timestamp = Date.now();
  const filename = `${type === 'signatures' ? 'sig' : 'stamp'}_v${version}_${timestamp}.${ext}`;
  const storagePath = `${type}/${filename}`;

  if (process.env.STORAGE_MODE === 'supabase') {
    const supabase = getSupabaseAdminClient();

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some(b => b.name === ASSETS_BUCKET)) {
      await supabase.storage.createBucket(ASSETS_BUCKET, {
        public: false,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
        fileSizeLimit: 5242880,
      });
    }

    const { error } = await supabase.storage
      .from(ASSETS_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload to Supabase private assets: ${error.message}`);
    }

    // Serve via internal authenticated endpoint to never expose secret keys
    const assetUrl = `/api/settings/branding/asset?path=${encodeURIComponent(storagePath)}`;
    return { storagePath, assetUrl };
  }

  // Local filesystem fallback
  const localDir = path.join(process.cwd(), 'storage', 'assets', type);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  const filePath = path.join(localDir, filename);
  fs.writeFileSync(filePath, buffer);

  const assetUrl = `/api/settings/branding/asset?path=${encodeURIComponent(storagePath)}`;
  return { storagePath, assetUrl };
}
