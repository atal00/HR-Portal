import { db } from '../src/lib/db';
import { ROLE_PERMISSIONS, hasPermission, canApproveDocument, canRevokeDocument } from '../src/lib/rbac';
import { formatDocumentNumber, generateVerificationId, getDocumentPrefix } from '../src/lib/id-generator';
import { SessionUser } from '../src/types/auth';

console.log('================================================================');
console.log('RELIEVING LETTER ARCHITECTURE & PERMISSION TEST SUITE');
console.log('================================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    if (detail) console.error(`   Detail: ${detail}`);
    failCount++;
  }
}

// 1. Prefix and Numbering
const prefix = getDocumentPrefix('RELIEVING_LETTER');
assert(prefix === 'VAR-REL', 'Relieving Letter prefix is VAR-REL');

const docNumber = formatDocumentNumber('RELIEVING_LETTER', 1001, new Date('2026-10-01'));
assert(docNumber === 'VAR-REL-2026-001001', `Document number formatting matches canonical specification (${docNumber})`);

// 2. Verification ID
const vId = generateVerificationId('RELIEVING_LETTER');
assert(vId.startsWith('VVR-REL-'), `Verification ID starts with VVR-REL- (${vId})`);
assert(vId.length >= 16, `Verification ID has sufficient cryptographic entropy (${vId})`);

// 3. User Mock Roles
const superAdmin: SessionUser = {
  id: 'usr-sa',
  email: 'admin@varsaka.com',
  full_name: 'Super Admin',
  role: 'SUPER_ADMIN',
  permissions: ROLE_PERMISSIONS['SUPER_ADMIN'],
};

const hrAdmin: SessionUser = {
  id: 'usr-hr',
  email: 'hr@varsaka.com',
  full_name: 'HR Admin',
  role: 'HR_ADMIN',
  permissions: ROLE_PERMISSIONS['HR_ADMIN'],
};

const payrollAdmin: SessionUser = {
  id: 'usr-payroll',
  email: 'payroll@varsaka.com',
  full_name: 'Payroll Admin',
  role: 'PAYROLL_ADMIN',
  permissions: ROLE_PERMISSIONS['PAYROLL_ADMIN'],
};

const viewer: SessionUser = {
  id: 'usr-viewer',
  email: 'viewer@varsaka.com',
  full_name: 'Viewer',
  role: 'VIEWER',
  permissions: ROLE_PERMISSIONS['VIEWER'],
};

// 4. Permission Boundary Checks
assert(hasPermission(superAdmin, 'document.relieving.create'), 'Super Admin can create Relieving Letters');
assert(hasPermission(hrAdmin, 'document.relieving.create'), 'HR Admin can create Relieving Letters');
assert(!hasPermission(payrollAdmin, 'document.relieving.create'), 'Payroll Admin CANNOT create Relieving Letters');
assert(!hasPermission(viewer, 'document.relieving.create'), 'Viewer CANNOT create Relieving Letters');

assert(hasPermission(superAdmin, 'document.relieving.view'), 'Super Admin can view Relieving Letters');
assert(hasPermission(hrAdmin, 'document.relieving.view'), 'HR Admin can view Relieving Letters');
assert(hasPermission(viewer, 'document.relieving.view'), 'Viewer can view Relieving Letters');
assert(!hasPermission(payrollAdmin, 'document.relieving.view'), 'Payroll Admin CANNOT view Relieving Letters');

assert(hasPermission(superAdmin, 'document.relieving.download'), 'Super Admin can download Relieving Letters');
assert(hasPermission(hrAdmin, 'document.relieving.download'), 'HR Admin can download Relieving Letters');
assert(!hasPermission(viewer, 'document.relieving.download'), 'Viewer CANNOT download Relieving Letters');

// 5. Approval & Revocation Architecture
assert(canApproveDocument(superAdmin, 'RELIEVING_LETTER'), 'Super Admin can approve Relieving Letters');
assert(canApproveDocument(hrAdmin, 'RELIEVING_LETTER'), 'HR Admin can approve Relieving Letters');
assert(!canApproveDocument(payrollAdmin, 'RELIEVING_LETTER'), 'Payroll Admin CANNOT approve Relieving Letters');
assert(!canApproveDocument(viewer, 'RELIEVING_LETTER'), 'Viewer CANNOT approve Relieving Letters');

assert(canRevokeDocument(superAdmin), 'Super Admin can revoke documents');
assert(canRevokeDocument(hrAdmin), 'HR Admin can revoke documents');
assert(!canRevokeDocument(payrollAdmin), 'Payroll Admin CANNOT revoke documents');
assert(!canRevokeDocument(viewer), 'Viewer CANNOT revoke documents');

// 6. End-to-End Relieving Letter Creation & Public Verification
async function runAsyncTests() {
  const employees = await db.employees.list();
  const emp = employees[0];
  assert(!!emp, 'Employee directory populated for test');

  const doc = await db.documents.create({
    document_type: 'RELIEVING_LETTER',
    employee_id: emp.id,
    title: `Relieving & Separation Order - ${emp.full_name}`,
    data_snapshot: {
      issueDate: '2026-10-01',
      employeeName: emp.full_name,
      employeeId: emp.employee_id,
      designation: emp.designation,
      department: emp.department_name,
      joiningDate: emp.joining_date,
      lastWorkingDate: '2026-10-01',
      relievingDate: '2026-10-01',
      clearanceStatus: 'Satisfactorily Completed',
      authorizedSignatoryName: 'Authorized Signatory',
      authorizedSignatoryTitle: 'Head of Human Resources',
    },
    created_by: hrAdmin.id,
    created_by_name: hrAdmin.full_name,
  });

  assert(doc.document_type === 'RELIEVING_LETTER', 'Created document has type RELIEVING_LETTER');
  assert(doc.document_number.startsWith('VAR-REL-'), `Document number starts with VAR-REL- (${doc.document_number})`);
  assert(doc.verification_id.startsWith('VVR-REL-'), `Verification ID starts with VVR-REL- (${doc.verification_id})`);
  assert(doc.status === 'PENDING_APPROVAL', 'Initial status is PENDING_APPROVAL');

  // Approve Document
  const approved = await db.documents.approve(doc.id, hrAdmin.id, hrAdmin.full_name);
  assert(approved.status === 'APPROVED', 'Document transitioned to APPROVED');

  // Verify Publicly
  const pubVerify = await db.verification.verifyPublic(approved.verification_id);
  assert(pubVerify.status === 'VALID', 'Public verification confirms VALID');
  assert(pubVerify.document_number === approved.document_number, 'Public verification matches document number');
  assert(pubVerify.candidate_name === emp.full_name, 'Public verification displays employee name');
  assert(pubVerify.authorized_signatory === 'Authorized Signatory, Varsaka Labs', 'Public verification displays signatory');
  
  // Verify No Sensitive Data in Public Result
  const pubKeys = Object.keys(pubVerify);
  assert(!pubKeys.includes('salary'), 'Public verification does NOT expose salary');
  assert(!pubKeys.includes('pan'), 'Public verification does NOT expose PAN');
  assert(!pubKeys.includes('bank'), 'Public verification does NOT expose Bank details');
  assert(!pubKeys.includes('phone'), 'Public verification does NOT expose phone');
  assert(!pubKeys.includes('address'), 'Public verification does NOT expose address');

  // Revoke Document
  const revoked = await db.documents.revoke(doc.id, hrAdmin.id, hrAdmin.full_name, 'Test revocation of relieving letter');
  assert(revoked.status === 'REVOKED', 'Document transitioned to REVOKED');

  const pubVerifyRevoked = await db.verification.verifyPublic(approved.verification_id);
  assert(pubVerifyRevoked.status === 'REVOKED', 'Public verification immediately confirms REVOKED');
  assert(pubVerifyRevoked.revocation_reason === 'Test revocation of relieving letter', 'Public verification includes revocation reason');

  console.log('\n================================================================');
  console.log(`TEST SUITE FINISHED: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAsyncTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
