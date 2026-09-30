import crypto from 'crypto';
import { DocumentType } from '@/types/database';

export function getDocumentPrefix(type: DocumentType): string {
  switch (type) {
    case 'OFFER_LETTER':
      return 'VAR-OFF';
    case 'EXPERIENCE_LETTER':
      return 'VAR-EXP';
    case 'SALARY_SLIP':
      return 'VAR-SAL';
    case 'CERTIFICATE':
      return 'VAR-CERT';
    default:
      return 'VAR-DOC';
  }
}

/**
 * Formats a document number according to Varsaka specification
 */
export function formatDocumentNumber(type: DocumentType, sequence: number, date: Date = new Date()): string {
  const prefix = getDocumentPrefix(type);
  const year = date.getFullYear();
  const seqStr = String(sequence).padStart(6, '0');

  if (type === 'SALARY_SLIP') {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${prefix}-${year}-${month}-${seqStr}`;
  }

  return `${prefix}-${year}-${seqStr}`;
}

/**
 * Generates an unguessable, cryptographically secure Verification ID
 * Example: VVR-CERT-7B9A2E
 */
export function generateVerificationId(type: DocumentType): string {
  const typeShort = type.substring(0, 4);
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `VVR-${typeShort}-${randomHex}`;
}
