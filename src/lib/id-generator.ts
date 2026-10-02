import crypto from 'crypto';
import { DocumentType } from '@/types/database';

export function getDocumentPrefix(type: DocumentType): string {
  switch (type) {
    case 'OFFER_LETTER':
      return 'VAR-OFF';
    case 'EXPERIENCE_LETTER':
      return 'VAR-EXP';
    case 'RELIEVING_LETTER':
      return 'VAR-REL';
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
 * Example: VVR-CERT-7B9A2E, VVR-REL-7B9A2E
 */
export function generateVerificationId(type: DocumentType): string {
  let typeShort = 'DOC';
  switch (type) {
    case 'OFFER_LETTER':
      typeShort = 'OFF';
      break;
    case 'EXPERIENCE_LETTER':
      typeShort = 'EXP';
      break;
    case 'RELIEVING_LETTER':
      typeShort = 'REL';
      break;
    case 'SALARY_SLIP':
      typeShort = 'SAL';
      break;
    case 'CERTIFICATE':
      typeShort = 'CERT';
      break;
  }
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `VVR-${typeShort}-${randomHex}`;
}

/**
 * Formats a sequential employee ID: EMP-VL-1001, EMP-VL-1002, etc.
 */
export function formatEmployeeId(sequence: number): string {
  return `EMP-VL-${sequence}`;
}

/**
 * Parses sequential number from an employee ID if formatted as EMP-VL-XXXX
 */
export function parseEmployeeIdSequence(id: string): number | null {
  const match = id.match(/^EMP-VL-(\d+)$/i);
  return match ? parseInt(match[1], 10) : null;
}

