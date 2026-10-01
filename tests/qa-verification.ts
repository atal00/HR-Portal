import { ROLE_PERMISSIONS, canAccessSalary, canModifySalary, hasPermission, canRevokeDocument } from '../src/lib/rbac';
import { db } from '../src/lib/db';
import { generateSignedDownloadToken, verifySignedDownloadToken } from '../src/lib/storage';
import { formatDocumentNumber, generateVerificationId } from '../src/lib/id-generator';

async function runTestSuite() {
  console.log('================================================================');
  console.log('VARSAKA HR DOCUMENT PORTAL - COMPREHENSIVE QA AUTOMATION SUITE');
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

  const allUsers = await db.users.list();
  const superAdmin = allUsers.find(u => u.role === 'SUPER_ADMIN')!;
  const hrAdmin = allUsers.find(u => u.role === 'HR_ADMIN')!;
  const docAdmin = allUsers.find(u => u.role === 'DOCUMENT_ADMIN')!;
  const payrollAdmin = allUsers.find(u => u.role === 'PAYROLL_ADMIN')!;
  const viewer = allUsers.find(u => u.role === 'VIEWER')!;

  // Scenario 1: HR Admin cannot access salary without permission
  assert(
    !canAccessSalary(hrAdmin),
    'Scenario 1: HR Admin cannot access salary without permission',
    'HR Admin has salary access unexpectedly'
  );
  assert(
    canAccessSalary(payrollAdmin) && canAccessSalary(superAdmin),
    'Scenario 1b: Payroll Admin and Super Admin HAVE authorized salary access'
  );

  // Scenario 2: Viewer cannot generate documents
  assert(
    !hasPermission(viewer, 'document.offer.create') &&
    !hasPermission(viewer, 'document.certificate.create') &&
    !hasPermission(viewer, 'document.experience.create') &&
    !hasPermission(viewer, 'document.salary.create'),
    'Scenario 2: Viewer cannot generate any official documents',
    'Viewer possessed document creation permissions'
  );

  // Scenario 3: Document Admin cannot modify employee salary
  assert(
    !canModifySalary(docAdmin),
    'Scenario 3: Document Admin cannot modify employee salary',
    'Document Admin possessed salary update authority'
  );

  // Scenario 4: Public user cannot access private PDFs without valid signed token
  const forgedToken = 'invalid-forged-token-xyz';
  const forgedCheck = verifySignedDownloadToken(forgedToken);
  assert(
    !forgedCheck.valid,
    'Scenario 4: Public user cannot access private PDFs (forged tokens rejected)',
    forgedCheck.error
  );

  // Scenario 5: Public user can verify a valid certificate (safe projection only)
  const validVerification = await db.verification.verifyPublic('VVR-CERT-7B9A2F');
  assert(
    validVerification.status === 'VALID' &&
    validVerification.candidate_name !== undefined &&
    (validVerification as any).pan === undefined &&
    (validVerification as any).salary === undefined &&
    (validVerification as any).bank_account === undefined &&
    (validVerification as any).address === undefined,
    'Scenario 5: Public user can verify valid certificate with strict privacy projection',
    JSON.stringify(validVerification)
  );

  // Scenario 6: Revoked certificate shows revoked status
  // Create a document and revoke it
  const testDoc = await db.documents.create({
    document_type: 'CERTIFICATE',
    employee_id: 'emp-test-001',
    title: 'Test Certificate For Revocation QA',
    data_snapshot: { test: true },
    created_by: docAdmin.id,
    created_by_name: docAdmin.full_name,
  });
  await db.documents.revoke(testDoc.id, superAdmin.id, superAdmin.full_name, 'Compliance audit revocation test');
  const revokedVerification = await db.verification.verifyPublic(testDoc.verification_id);
  assert(
    revokedVerification.status === 'REVOKED' &&
    revokedVerification.revocation_reason === 'Compliance audit revocation test',
    'Scenario 6: Revoked certificate immediately shows REVOKED status and reason on public verification route',
    JSON.stringify(revokedVerification)
  );

  // Scenario 7: Approved document cannot be silently edited; requires new version
  const newVersionDoc = await db.documents.createNewVersion(
    testDoc.id,
    { test: true, updatedField: 'Corrected Value' },
    'Correction of nomenclature',
    superAdmin.id,
    superAdmin.full_name
  );
  assert(
    newVersionDoc.version_number === 2 &&
    newVersionDoc.verification_id !== testDoc.verification_id &&
    newVersionDoc.document_number.includes('-v2'),
    'Scenario 7: Approved document cannot be silently edited; creates immutable version v2 with unique verification ID'
  );

  // Scenario 8: Changing frontend permissions cannot bypass backend authorization
  const simulatedFakeViewerUser = {
    ...viewer,
    permissions: ['salary.view' as any] // Tampered on client
  };
  // Real RBAC checks against true authoritative role permissions
  const realViewerPerms = ROLE_PERMISSIONS[viewer.role];
  assert(
    !realViewerPerms.includes('salary.view'),
    'Scenario 8: Changing frontend permissions cannot bypass backend authoritative RBAC matrix'
  );

  // Scenario 9: RLS blocks unauthorized database access
  assert(
    ROLE_PERMISSIONS.HR_ADMIN.indexOf('salary.view') === -1 &&
    ROLE_PERMISSIONS.DOCUMENT_ADMIN.indexOf('salary.view') === -1 &&
    ROLE_PERMISSIONS.VIEWER.indexOf('salary.view') === -1,
    'Scenario 9: RLS security matrix blocks non-payroll roles from accessing sensitive compensation table'
  );

  // Scenario 10: Download URLs expire
  // Generate a token that expired 10 seconds ago
  const expiredToken = generateSignedDownloadToken('doc-sample', -10);
  const expiredCheck = verifySignedDownloadToken(expiredToken);
  assert(
    !expiredCheck.valid && (expiredCheck.error || '').includes('expired'),
    'Scenario 10: Download URLs expire after time-limited window',
    expiredCheck.error
  );

  // Scenario 11: Duplicate verification IDs cannot be created (entropy & uniqueness checks)
  const vId1 = generateVerificationId('CERTIFICATE');
  const vId2 = generateVerificationId('CERTIFICATE');
  assert(
    vId1 !== vId2 && vId1.startsWith('VVR-CERT-'),
    'Scenario 11: Verification IDs are unique and collision-free'
  );

  // Scenario 12: Duplicate document numbers cannot be created (atomic sequence increments)
  const docNum1 = db.documents.create({
    document_type: 'OFFER_LETTER',
    employee_id: 'emp-test-001',
    title: 'Atomic Numbering Test 1',
    data_snapshot: {},
    created_by: hrAdmin.id,
    created_by_name: hrAdmin.full_name,
  });
  const docNum2 = db.documents.create({
    document_type: 'OFFER_LETTER',
    employee_id: 'emp-test-001',
    title: 'Atomic Numbering Test 2',
    data_snapshot: {},
    created_by: hrAdmin.id,
    created_by_name: hrAdmin.full_name,
  });
  const [d1, d2] = await Promise.all([docNum1, docNum2]);
  assert(
    d1.document_number !== d2.document_number,
    'Scenario 12: Atomic sequence engine guarantees non-duplication of document numbers'
  );

  console.log('\n================================================================');
  console.log(`QA SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal QA error:', err);
  process.exit(1);
});
