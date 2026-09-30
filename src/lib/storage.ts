import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DocumentType } from '@/types/database';

const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'documents');

const SUBFOLDERS: Record<DocumentType, string> = {
  OFFER_LETTER: 'offer',
  EXPERIENCE_LETTER: 'experience',
  SALARY_SLIP: 'salary',
  CERTIFICATE: 'certificate',
};

export interface StoredDocumentMetadata {
  filePath: string;
  fileSizeBytes: number;
  checksumSha256: string;
}

export function ensureStorageDirectories() {
  if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  }
  Object.values(SUBFOLDERS).forEach((sub) => {
    const subPath = path.join(STORAGE_ROOT, sub);
    if (!fs.existsSync(subPath)) {
      fs.mkdirSync(subPath, { recursive: true });
    }
  });
}

/**
 * Saves a document artifact to the private storage bucket
 */
export async function saveDocumentFile(
  type: DocumentType,
  documentNumber: string,
  buffer: Buffer
): Promise<StoredDocumentMetadata> {
  ensureStorageDirectories();
  const folder = SUBFOLDERS[type] || 'general';
  const fileName = `${documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  const relativePath = path.join(folder, fileName);
  const absolutePath = path.join(STORAGE_ROOT, relativePath);

  fs.writeFileSync(absolutePath, buffer);

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  return {
    filePath: relativePath.replace(/\\/g, '/'),
    fileSizeBytes: buffer.length,
    checksumSha256: hash,
  };
}

/**
 * Generates an HMAC-signed time-limited download URL
 * Default expiration: 15 minutes (900 seconds)
 */
export function generateSignedDownloadToken(documentId: string, expiresInSeconds: number = 900): string {
  const secret = process.env.SESSION_SECRET || 'varsaka-hr-secret';
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const payload = `${documentId}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ documentId, expiresAt, signature })).toString('base64url');
}

/**
 * Validates a signed download token
 */
export function verifySignedDownloadToken(token: string): { valid: boolean; documentId?: string; error?: string } {
  try {
    const secret = process.env.SESSION_SECRET || 'varsaka-hr-secret';
    const jsonStr = Buffer.from(token, 'base64url').toString('utf-8');
    const { documentId, expiresAt, signature } = JSON.parse(jsonStr);

    if (Date.now() > expiresAt) {
      return { valid: false, error: 'Download link has expired. Please request a new signed link.' };
    }

    const expectedPayload = `${documentId}:${expiresAt}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(expectedPayload).digest('hex');

    if (signature !== expectedSig) {
      return { valid: false, error: 'Invalid or forged download signature.' };
    }

    return { valid: true, documentId };
  } catch {
    return { valid: false, error: 'Malformed signature token.' };
  }
}
