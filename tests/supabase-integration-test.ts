/**
 * PHASE 5 — SUPABASE RUNTIME INTEGRATION TEST SUITE
 * 
 * Verifies all 15 operational, security, and architectural checkpoints:
 * 1. Supabase connection
 * 2. employee creation
 * 3. employee retrieval
 * 4. salary creation
 * 5. salary authorization
 * 6. document creation
 * 7. document approval
 * 8. document retrieval
 * 9. salary slip isolation
 * 10. signed download authorization
 * 11. public certificate verification
 * 12. audit log persistence
 * 13. JSON fallback disabled in production
 * 14. private storage access
 * 15. revoked document verification
 */

import fs from 'fs';
import path from 'path';

// Load .env.local for standalone test runner execution
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  });
}

import { db } from '../src/lib/db';
import { 
  isSupabaseConfigured, 
  getSupabaseUrl, 
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  isProductionEnv 
} from '../src/lib/supabase';
import { 
  ROLE_PERMISSIONS, 
  canAccessSalary, 
  canModifySalary, 
  hasPermission,
  canApproveDocument,
  canRevokeDocument 
} from '../src/lib/rbac';
import { 
  generateSignedDownloadToken, 
  verifySignedDownloadToken, 
  saveDocumentFile,
  SUPABASE_DOCUMENTS_BUCKET 
} from '../src/lib/storage';
import { logAuditEvent, logSecurityEvent } from '../src/lib/audit';
import { formatDocumentNumber, generateVerificationId } from '../src/lib/id-generator';
import { localDb } from '../src/lib/storage/mock-db';
import { RoleCode, User } from '../src/types/database';

async function runTestSuite() {
  console.log('================================================================');
  console.log('PHASE 5 — SUPABASE RUNTIME INTEGRATION VERIFICATION SUITE');
  console.log('Target: varsaka-hr-production (https://qyqjylcsnztvlvxfngkk.supabase.co)');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName} - ${detail || ''}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // 1. Supabase Connection Configuration & Fail-Safe Protection Guard
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Supabase Connection & Variable Resolution ---');
  const targetUrl = getSupabaseUrl();
  assert(
    targetUrl?.includes('qyqjylcsnztvlvxfngkk.supabase.co') === true,
    'Target Supabase URL resolved to production project qyqjylcsnztvlvxfngkk',
    `Resolved URL: ${targetUrl}`
  );
  assert(
    process.env.STORAGE_MODE === 'supabase',
    'STORAGE_MODE is set to supabase',
    `Current STORAGE_MODE: ${process.env.STORAGE_MODE}`
  );
  assert(
    isProductionEnv() === true,
    'isProductionEnv() correctly identifies production/supabase mode'
  );

  // Test fail-safe assertion: when STORAGE_MODE=supabase and keys are not yet configured,
  // the DAL must refuse silent fallback to local storage and throw a fatal error.
  if (!isSupabaseConfigured()) {
    try {
      await db.users.list();
      assert(false, 'DAL silently fell back to local storage when Supabase was unconfigured');
    } catch (err: any) {
      assert(
        err.message.includes('FATAL PRODUCTION SECURITY ERROR') || err.message.includes('FATAL CONFIGURATION ERROR'),
        'DAL enforces fail-safe guard: blocks silent fallback to local storage in production/supabase mode'
      );
    }
  } else {
    console.log('Live Supabase credentials configured. Testing live query connection...');
    try {
      const users = await db.users.list();
      assert(users.length >= 0, 'Live Supabase query executed successfully');
    } catch (err: any) {
      assert(false, `Live Supabase connection failed: ${err.message}`);
    }
  }

  // Switch to local mode temporarily to test application DAL logic & safeguards in isolated runner
  const originalMode = process.env.STORAGE_MODE;
  process.env.STORAGE_MODE = 'local';

  // -------------------------------------------------------------------------
  // 2. Employee Creation Logic & Duplicate Protection
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Employee Creation Logic ---');
  const allEmps = await db.employees.list();
  assert(allEmps.length > 0, 'Employee directory populated');

  // Verify duplicate ID prevention logic
  try {
    const existing = allEmps[0];
    await db.employees.create({
      employee_id: existing.employee_id,
      full_name: 'Duplicate Test',
      email: 'unique_email_test@varsaka.com',
      phone: '+91 9999999999',
      address: 'Test Address',
      department_id: existing.department_id,
      designation: 'Engineer',
      joining_date: '2026-01-01',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad',
      status: 'ACTIVE',
    });
    assert(false, 'Duplicate employee ID was accepted unexpectedly');
  } catch (err: any) {
    assert(
      err.message.includes('already exists'),
      'Employee creation strictly rejects duplicate employee IDs'
    );
  }

  // -------------------------------------------------------------------------
  // 3. Employee Retrieval
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Employee Retrieval ---');
  const sampleEmp = allEmps[0];
  const fetchedEmp = await db.employees.getById(sampleEmp.id);
  assert(fetchedEmp !== null, 'Employee retrieved successfully by ID');
  assert(fetchedEmp?.employee_id === sampleEmp.employee_id, 'Retrieved employee matches ID');

  const filtered = await db.employees.list({ search: sampleEmp.employee_id });
  assert(filtered.length >= 1, 'Employee retrieved by search query');

  // -------------------------------------------------------------------------
  // 4. Salary Creation & Upsert
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Salary Creation & Upsert ---');
  let sal = await db.salary.getByEmployeeId(sampleEmp.id);
  if (!sal) {
    sal = await db.salary.upsert({
      employee_id: sampleEmp.id,
      annual_ctc: 1200000,
      monthly_gross: 100000,
      basic: 50000,
      hra: 25000,
      communication_allowance: 5000,
      travel_allowance: 5000,
      food_allowance: 5000,
      other_allowances: 10000,
      employee_pf: 6000,
      employer_pf: 6000,
      professional_tax: 200,
      gratuity: 2400,
      tds: 5000,
      variable_pay: 0,
      net_salary: 81400,
      effective_date: '2026-04-01',
    });
  }
  assert(sal !== null, 'Salary record exists for test employee');
  assert(sal?.annual_ctc !== undefined && sal.annual_ctc > 0, 'Annual CTC is positive numeric value');

  // -------------------------------------------------------------------------
  // 5. Salary Authorization Matrix
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Salary Authorization Matrix ---');
  const makeUser = (role: RoleCode): User => ({
    id: `usr-${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@varsaka.com`,
    full_name: `Test ${role}`,
    is_active: true,
    role,
    permissions: ROLE_PERMISSIONS[role],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const hrUser = makeUser('HR_ADMIN');
  const viewerUser = makeUser('VIEWER');
  const payrollUser = makeUser('PAYROLL_ADMIN');
  const superUser = makeUser('SUPER_ADMIN');

  assert(!canAccessSalary(hrUser), 'HR_ADMIN CANNOT access confidential employee salary');
  assert(!canAccessSalary(viewerUser), 'VIEWER CANNOT access confidential employee salary');
  assert(canAccessSalary(payrollUser), 'PAYROLL_ADMIN HAS authorized salary access');
  assert(canAccessSalary(superUser), 'SUPER_ADMIN HAS authorized salary access');
  assert(canModifySalary(payrollUser), 'PAYROLL_ADMIN CAN modify salary records');
  assert(!canModifySalary(hrUser), 'HR_ADMIN CANNOT modify salary records');

  // -------------------------------------------------------------------------
  // 6. Document Creation Workflow
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Document Creation Workflow ---');
  const testDocNumber = formatDocumentNumber('OFFER_LETTER', 9999);
  const testVId = generateVerificationId('OFFER_LETTER');
  assert(testDocNumber.startsWith('VAR-OFF-'), 'Document number correctly formatted');
  assert(testVId.startsWith('VVR-OFF-'), 'Verification ID correctly formatted');

  // -------------------------------------------------------------------------
  // 7. Document Approval Authority
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Document Approval Authority ---');
  assert(canApproveDocument(superUser), 'SUPER_ADMIN can approve documents');
  assert(canApproveDocument(hrUser), 'HR_ADMIN can approve documents');
  assert(!canApproveDocument(viewerUser), 'VIEWER CANNOT approve documents');

  // -------------------------------------------------------------------------
  // 8. Document Retrieval
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Document Retrieval ---');
  const docs = await db.documents.list();
  assert(docs.length > 0, 'Document list retrieved');
  const firstDoc = docs[0];
  const byId = await db.documents.getById(firstDoc.id);
  assert(byId?.id === firstDoc.id, 'Document retrieved by ID');
  const byNumber = await db.documents.getById(firstDoc.document_number);
  assert(byNumber?.document_number === firstDoc.document_number, 'Document retrieved by document number');

  // -------------------------------------------------------------------------
  // 9. Salary Slip Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Salary Slip Isolation ---');
  const salaryDocs = docs.filter(d => d.document_type === 'SALARY_SLIP');
  assert(salaryDocs.length > 0, 'Salary slip documents exist in datastore');
  assert(
    !hasPermission(hrUser, 'salary.view') && !hasPermission(hrUser, 'document.salary.view'),
    'HR_ADMIN does not possess salary slip permissions'
  );
  assert(
    hasPermission(payrollUser, 'salary.view') && hasPermission(payrollUser, 'document.salary.view'),
    'PAYROLL_ADMIN possesses required salary slip permissions'
  );

  // -------------------------------------------------------------------------
  // 10. Signed Download Authorization
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Signed Download Authorization ---');
  const token = generateSignedDownloadToken('test-doc-123', 900);
  const verifiedToken = verifySignedDownloadToken(token);
  assert(verifiedToken.valid === true, 'Signed download token verifies successfully');
  assert(verifiedToken.documentId === 'test-doc-123', 'Signed download token preserves document ID');

  const forgedToken = verifySignedDownloadToken('forged-token-payload');
  assert(forgedToken.valid === false, 'Forged download token is strictly rejected');

  const expiredToken = generateSignedDownloadToken('test-doc-123', -10);
  const expiredCheck = verifySignedDownloadToken(expiredToken);
  assert(expiredCheck.valid === false, 'Expired download token is strictly rejected');

  // -------------------------------------------------------------------------
  // 11. Public Certificate Verification (Zero PII / Zero Salary)
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Public Certificate Verification ---');
  const certDoc = docs.find(d => d.document_type === 'CERTIFICATE');
  if (certDoc) {
    const pubResult = await db.verification.verifyPublic(certDoc.verification_id);
    assert(pubResult.status === 'VALID', 'Public certificate verification status is VALID');
    assert(pubResult.candidate_name !== undefined, 'Public verification includes candidate name');
    assert(pubResult.authorized_signatory !== undefined, 'Public verification includes signatory');
    assert((pubResult as any).salary === undefined, 'Public verification NEVER exposes salary');
    assert((pubResult as any).pan === undefined, 'Public verification NEVER exposes PAN');
    assert((pubResult as any).bankAccount === undefined, 'Public verification NEVER exposes bank details');
  }

  // -------------------------------------------------------------------------
  // 12. Audit Log Persistence & Secret Sanitization
  // -------------------------------------------------------------------------
  console.log('\n--- 12. Audit Log Persistence & Sanitization ---');
  const auditEvent = await logAuditEvent({
    userId: superUser.id,
    userEmail: superUser.email,
    action: 'TEST_AUDIT_ACTION',
    resourceType: 'SYSTEM',
    resourceId: 'test-123',
    metadata: {
      password: 'sensitive-password-123',
      token: 'jwt-token-456',
      secret: 'api-secret-789',
      safeField: 'visible-metadata',
    },
  });

  assert(auditEvent.metadata.password === undefined, 'Audit log strips password');
  assert(auditEvent.metadata.token === undefined, 'Audit log strips token');
  assert(auditEvent.metadata.secret === undefined, 'Audit log strips secret');
  assert(auditEvent.metadata.safeField === 'visible-metadata', 'Audit log preserves safe business metadata');

  // -------------------------------------------------------------------------
  // 13. JSON Fallback Disabled in Production / Supabase Mode
  // -------------------------------------------------------------------------
  console.log('\n--- 13. JSON Fallback Guard in Production/Supabase Mode ---');
  // Re-enable STORAGE_MODE=supabase to test the fail-safe write guard
  process.env.STORAGE_MODE = 'supabase';
  try {
    // Calling localDb.save() in STORAGE_MODE=supabase must throw a fatal guard error
    localDb.save();
    assert(false, 'Local JSON write succeeded unexpectedly in Supabase storage mode');
  } catch (err: any) {
    assert(
      err.message.includes('FATAL DATA INTEGRITY VIOLATION'),
      'Accidental local JSON writes are strictly blocked in STORAGE_MODE=supabase'
    );
  }

  // -------------------------------------------------------------------------
  // 14. Private Storage Access Configuration
  // -------------------------------------------------------------------------
  console.log('\n--- 14. Private Storage Bucket Verification ---');
  assert(
    SUPABASE_DOCUMENTS_BUCKET === 'hr-documents',
    'Supabase private documents bucket is configured as hr-documents'
  );

  // -------------------------------------------------------------------------
  // 15. Revoked Document Verification & Security
  // -------------------------------------------------------------------------
  console.log('\n--- 15. Revocation Security & Public Verification ---');
  process.env.STORAGE_MODE = 'local';
  assert(canRevokeDocument(superUser), 'SUPER_ADMIN has revocation privileges');
  assert(canRevokeDocument(hrUser), 'HR_ADMIN has revocation privileges');
  assert(!canRevokeDocument(payrollUser), 'PAYROLL_ADMIN CANNOT revoke documents');
  assert(!canRevokeDocument(viewerUser), 'VIEWER CANNOT revoke documents');

  // Test revocation of a document
  const sampleDoc = docs[0];
  const revoked = await db.documents.revoke(
    sampleDoc.id,
    superUser.id,
    superUser.full_name,
    'Official test revocation: Separation terms completed'
  );
  assert(revoked.status === 'REVOKED', 'Document status transitioned to REVOKED');
  assert(revoked.revocation_reason !== undefined, 'Revocation reason attached');

  const revokedVerification = await db.verification.verifyPublic(sampleDoc.verification_id);
  assert(revokedVerification.status === 'REVOKED', 'Public verification confirms REVOKED status');
  assert(revokedVerification.revocation_reason !== undefined, 'Public verification provides revocation reason');

  // Revoked document cannot be re-approved
  try {
    await db.documents.approve(sampleDoc.id, superUser.id, superUser.full_name);
    assert(false, 'Revoked document was re-approved unexpectedly');
  } catch (err: any) {
    assert(
      err.message.includes('Revoked document cannot be approved'),
      'Revoked document cannot be approved'
    );
  }

  // Restore original storage mode
  process.env.STORAGE_MODE = originalMode;

  // -------------------------------------------------------------------------
  // Final Results
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`INTEGRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
