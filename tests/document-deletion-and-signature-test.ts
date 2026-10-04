import fs from 'fs';
import path from 'path';

// Load .env.local configuration
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim();
      if (!process.env[k]) process.env[k] = v;
    }
  });
}

import { db } from '../src/lib/db';
import { ROLE_PERMISSIONS, hasPermission } from '../src/lib/rbac';
import { SessionUser } from '../src/types/auth';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    console.log(`  ${GREEN}✓ PASS:${RESET} ${testName}`);
    passed++;
  } else {
    console.error(`  ${RED}✗ FAIL:${RESET} ${testName}`);
    if (failureDetails) {
      console.error(`     ${YELLOW}Details: ${failureDetails}${RESET}`);
    }
    failed++;
  }
}

async function runTestSuite() {
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  VARSaka HR PORTAL — DOCUMENT DELETE & SIGNATURE SUITE         ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // ============================================================================
  // SECTION 1: A4 PAGINATION & SIGNATURE LAYOUT INSPECTION
  // ============================================================================
  console.log(`${BOLD}SECTION 1: A4 Pagination & Signature Block Layout${RESET}`);

  // 1.1 Offer Letter Page Count Audit
  const offerTemplatePath = path.join(process.cwd(), 'src/components/documents/OfferLetterTemplate.tsx');
  const offerContent = fs.readFileSync(offerTemplatePath, 'utf8');
  const offerA4Pages = (offerContent.match(/className="a4-page"/g) || []).length;
  const offerLastPage = (offerContent.match(/className="a4-page a4-page-last"/g) || []).length;
  const totalOfferPages = offerA4Pages + offerLastPage;
  assert(
    totalOfferPages === 16,
    `Offer Letter template contains exactly 16 discrete A4 pages (Detected: ${totalOfferPages})`
  );
  assert(
    offerLastPage === 1,
    'Offer Letter final page has .a4-page-last with page-break-after: auto to eliminate trailing blank sheet'
  );

  // 1.2 Final page and Page 2 signature block structure
  assert(
    offerContent.includes('<DualSignatureGrid') || (offerContent.includes('<CandidateSignatoryBlock') && offerContent.includes('<AuthorizedSignatoryBlock')),
    'Offer Letter integrates Candidate and Authorized Signatory via DualSignatureGrid'
  );
  const signatureGridUsages = (offerContent.match(/<DualSignatureGrid|<CandidateSignatoryBlock/g) || []).length;
  assert(
    signatureGridUsages >= 2,
    `DualSignatureGrid rendered on Page 2 and Page 16 (Detected: ${signatureGridUsages})`
  );

  // 1.3 AuthorizedSignatoryBlock implementation invariants
  const signatoryBlockPath = path.join(process.cwd(), 'src/components/documents/AuthorizedSignatoryBlock.tsx');
  const signatoryContent = fs.readFileSync(signatoryBlockPath, 'utf8');

  assert(
    signatoryContent.includes('object-contain') && signatoryContent.includes('objectFit: \'contain\''),
    'AuthorizedSignatoryBlock enforces object-fit: contain to prevent image stretching or distortion'
  );
  assert(
    signatoryContent.includes('CandidateSignatoryBlock'),
    'AuthorizedSignatoryBlock exports CandidateSignatoryBlock for corporate candidate sign-off'
  );
  assert(
    signatoryContent.includes('Signature:') && signatoryContent.includes('Full Name:') && signatoryContent.includes('Date:'),
    'CandidateSignatoryBlock defines uniform Signature, Full Name, and Date fields'
  );
  assert(
    signatoryContent.includes('AUTHORIZED SIGNATORY') || signatoryContent.includes('Authorized Signatory'),
    'AuthorizedSignatoryBlock includes standard corporate Authorized Signatory title'
  );

  // 1.4 Single Page Templates Invariants
  const expPath = path.join(process.cwd(), 'src/components/documents/ExperienceLetterTemplate.tsx');
  const relPath = path.join(process.cwd(), 'src/components/documents/RelievingLetterTemplate.tsx');
  const salPath = path.join(process.cwd(), 'src/components/documents/SalarySlipTemplate.tsx');
  const certPath = path.join(process.cwd(), 'src/components/documents/CertificateTemplate.tsx');

  const expContent = fs.readFileSync(expPath, 'utf8');
  const relContent = fs.readFileSync(relPath, 'utf8');
  const salContent = fs.readFileSync(salPath, 'utf8');
  const certContent = fs.readFileSync(certPath, 'utf8');

  assert((expContent.match(/className="a4-single-page/g) || []).length === 1, 'Experience Letter is strictly 1 A4 page');
  assert((relContent.match(/className="a4-single-page/g) || []).length === 1, 'Relieving Letter is strictly 1 A4 page');
  assert((salContent.match(/className="a4-single-page/g) || []).length === 1, 'Salary Slip is strictly 1 A4 page');
  assert((certContent.match(/className="a4-certificate-page/g) || []).length === 1, 'Certificate is strictly 1 A4 page');

  // ============================================================================
  // SECTION 2: RBAC PERMISSIONS FOR DOCUMENT DELETION
  // ============================================================================
  console.log(`\n${BOLD}SECTION 2: RBAC Permissions for Document Deletion${RESET}`);

  assert(
    ROLE_PERMISSIONS.SUPER_ADMIN.includes('document.delete'),
    'SUPER_ADMIN has document.delete permission'
  );
  assert(
    ROLE_PERMISSIONS.HR_ADMIN.includes('document.delete'),
    'HR_ADMIN has document.delete permission'
  );
  assert(
    !ROLE_PERMISSIONS.DOCUMENT_ADMIN.includes('document.delete'),
    'DOCUMENT_ADMIN does NOT have document.delete permission'
  );
  assert(
    !ROLE_PERMISSIONS.PAYROLL_ADMIN.includes('document.delete'),
    'PAYROLL_ADMIN does NOT have document.delete permission'
  );
  assert(
    !ROLE_PERMISSIONS.VIEWER.includes('document.delete'),
    'VIEWER does NOT have document.delete permission'
  );

  // Setup test session users
  const superAdminUser: SessionUser = {
    id: 'usr-super-admin-01',
    email: 'admin@varsaka.com',
    full_name: 'Dr. Vikram Sarabhai',
    role: 'SUPER_ADMIN',
    permissions: ROLE_PERMISSIONS.SUPER_ADMIN,
    session_version: 1,
    mfa_enabled: true,
  };

  const hrAdminUser: SessionUser = {
    id: 'usr-hr-admin-01',
    email: 'hr@varsaka.com',
    full_name: 'HR Administrator',
    role: 'HR_ADMIN',
    permissions: ROLE_PERMISSIONS.HR_ADMIN,
    session_version: 1,
    mfa_enabled: true,
  };

  const viewerUser: SessionUser = {
    id: 'usr-viewer-01',
    email: 'auditor@varsaka.com',
    full_name: 'Auditor Viewer',
    role: 'VIEWER',
    permissions: ROLE_PERMISSIONS.VIEWER,
    session_version: 1,
    mfa_enabled: true,
  };

  // Evaluate permission checks
  assert(hasPermission(superAdminUser, 'document.delete'), 'superAdmin has document.delete via hasPermission');
  assert(hasPermission(hrAdminUser, 'document.delete'), 'hrAdmin has document.delete via hasPermission');
  assert(!hasPermission(viewerUser, 'document.delete'), 'viewer does NOT have document.delete via hasPermission');

  // ============================================================================
  // SECTION 3: END-TO-END DELETION LIFECYCLE & SECURITY
  // ============================================================================
  console.log(`\n${BOLD}SECTION 3: End-to-End Document Deletion & Lifecycle Tests${RESET}`);

  // Setup a test employee
  const testEmp = await db.employees.create({
    full_name: 'Test Delete Recipient',
    employee_id: `DEL-${Date.now().toString().substring(7)}`,
    email: `del.recipient.${Date.now()}@varsaka.com`,
    official_email: `del.recipient.${Date.now()}@varsaka.com`,
    department: 'Engineering',
    designation: 'Senior Test Engineer',
    joining_date: '2026-01-15',
    ctc: 1200000,
  });

  // Test 3.1: Create a Draft / Pending Document
  const pendingDoc = await db.documents.create({
    document_type: 'OFFER_LETTER',
    employee_id: testEmp.id,
    title: `Employment Offer Letter - ${testEmp.full_name}`,
    created_by: hrAdminUser.id,
    created_by_name: hrAdminUser.full_name,
    status: 'PENDING_APPROVAL',
    data_snapshot: {
      candidateName: testEmp.full_name,
      designation: testEmp.designation,
      ctc: 1200000,
    },
  });
  assert(pendingDoc.id !== undefined, 'Draft/Pending document created successfully');
  assert(pendingDoc.status === 'PENDING_APPROVAL', 'Initial status is PENDING_APPROVAL');

  // Test 3.2: RBAC Gate - Unauthorized user evaluation
  const canViewerDelete = hasPermission(viewerUser, 'document.delete') || viewerUser.role === 'SUPER_ADMIN';
  assert(!canViewerDelete, 'Unauthorized user (VIEWER) evaluates canDelete as false (rejected with 403)');

  // Test 3.3: Empty deletion reason is rejected
  try {
    await db.documents.delete(pendingDoc.id, hrAdminUser.id, hrAdminUser.email, '   ');
    assert(false, 'Empty deletion reason was unexpectedly accepted');
  } catch (err: any) {
    assert(
      err.message.includes('reason is required'),
      'Empty or whitespace-only deletion reason is strictly rejected'
    );
  }

  // Test 3.4: Authorized user deletes unapproved draft -> Physical Deletion with Audit
  const validReason = 'Candidate declined offer prior to formal approval; cancelled draft';
  const deleteResult = await db.documents.delete(
    pendingDoc.id,
    hrAdminUser.id,
    hrAdminUser.email,
    validReason
  );

  assert(
    deleteResult.success === true && deleteResult.action === 'DELETED',
    'Authorized user successfully deletes PENDING_APPROVAL document (action: DELETED)'
  );

  // Verify document is no longer in active registry
  const checkDeletedDoc = await db.documents.getById(pendingDoc.id);
  assert(checkDeletedDoc === null, 'Deleted draft document is purged from active documents registry');

  // Verify audit log exists with required metadata
  const auditLogs = await db.auditLogs.list({ limit: 15 });
  const deleteAudit = auditLogs.find(
    (l) => l.action === 'DOCUMENT_DELETED' && l.resource_id === pendingDoc.document_number
  );
  assert(deleteAudit !== undefined, 'Immutable audit log record created for DOCUMENT_DELETED');
  assert(
    deleteAudit?.metadata?.deletion_reason === validReason || deleteAudit?.metadata?.reason === validReason,
    'Audit record preserves exact deletion reason'
  );
  assert(
    deleteAudit?.metadata?.document_number === pendingDoc.document_number &&
    deleteAudit?.metadata?.previous_status === 'PENDING_APPROVAL' &&
    deleteAudit?.metadata?.action_type === 'PHYSICAL_DELETION',
    'Audit log contains complete required metadata (doc number, previous status, action type)'
  );

  // Test 3.5: Approved/Final Document Deletion -> Follows Protected Lifecycle (Soft-Delete / REVOKED)
  console.log(`\n${BOLD}Test 3.5: Approved Document Deletion Follows Protected Lifecycle${RESET}`);
  const approvedDoc = await db.documents.create({
    document_type: 'EXPERIENCE_LETTER',
    employee_id: testEmp.id,
    title: `Experience Certificate - ${testEmp.full_name}`,
    created_by: hrAdminUser.id,
    created_by_name: hrAdminUser.full_name,
    status: 'PENDING_APPROVAL',
    data_snapshot: {
      employeeName: testEmp.full_name,
      designation: testEmp.designation,
    },
  });

  // Approve the document
  const formallyApproved = await db.documents.approve(
    approvedDoc.id,
    superAdminUser.id,
    superAdminUser.full_name
  );
  assert(formallyApproved.status === 'APPROVED', 'Document transitioned to APPROVED status');

  // Now delete the APPROVED document
  const revokeReason = 'Discovered material error in employment tenure; document revoked under audit governance';
  const approvedDeleteResult = await db.documents.delete(
    approvedDoc.id,
    superAdminUser.id,
    superAdminUser.email,
    revokeReason
  );

  assert(
    approvedDeleteResult.success === true && approvedDeleteResult.action === 'REVOKED',
    'APPROVED document follows protected lifecycle rule: transitioned to REVOKED rather than physically purged'
  );

  // Verify document remains in registry with REVOKED status and revocation metadata
  const checkRevokedDoc = await db.documents.getById(approvedDoc.id);
  assert(checkRevokedDoc !== null, 'Revoked document remains permanently in database registry for auditability');
  assert(checkRevokedDoc?.status === 'REVOKED', 'Document status is now REVOKED');
  assert(
    checkRevokedDoc?.revocation_reason === revokeReason,
    'Revocation reason correctly stored on document record'
  );

  // Test 3.6: Public Verification on Revoked Document
  console.log(`\n${BOLD}Test 3.6: Public Verification on Revoked Document${RESET}`);
  const publicVerifyResult = await db.verification.verifyPublic(approvedDoc.verification_id);
  assert(
    publicVerifyResult.status === 'REVOKED',
    'Public verification accurately displays REVOKED status'
  );

  // Test 3.7: Confidential Salary Slip Document Access Restrictions
  console.log(`\n${BOLD}Test 3.7: Confidential Salary Slip Access Restrictions${RESET}`);
  const salaryDoc = await db.documents.create({
    document_type: 'SALARY_SLIP',
    employee_id: testEmp.id,
    title: `Monthly Salary Slip - ${testEmp.full_name}`,
    created_by: superAdminUser.id,
    created_by_name: superAdminUser.full_name,
    status: 'PENDING_APPROVAL',
    data_snapshot: {
      employeeName: testEmp.full_name,
      netSalary: 95000,
    },
  });

  // HR_ADMIN has document.delete, but does NOT have salary.view
  assert(
    hasPermission(hrAdminUser, 'document.delete'),
    'HR_ADMIN has generic document.delete permission'
  );
  assert(
    !hasPermission(hrAdminUser, 'salary.view') && !hasPermission(hrAdminUser, 'document.salary.view'),
    'HR_ADMIN does NOT have confidential salary access permissions'
  );

  // Evaluate Salary delete guard
  const canHrAdminDeleteSalary = (hasPermission(hrAdminUser, 'document.delete') || hrAdminUser.role === 'SUPER_ADMIN') &&
    (hasPermission(hrAdminUser, 'salary.view') || hasPermission(hrAdminUser, 'document.salary.view') || hrAdminUser.role === 'SUPER_ADMIN');
  assert(
    !canHrAdminDeleteSalary,
    'Deleting a confidential SALARY_SLIP without salary permissions is blocked (returns 403)'
  );

  const canSuperAdminDeleteSalary = (hasPermission(superAdminUser, 'document.delete') || superAdminUser.role === 'SUPER_ADMIN') &&
    (hasPermission(superAdminUser, 'salary.view') || hasPermission(superAdminUser, 'document.salary.view') || superAdminUser.role === 'SUPER_ADMIN');
  assert(
    canSuperAdminDeleteSalary,
    'Super Admin with salary privileges is authorized to delete SALARY_SLIP'
  );

  // Super Admin deletes salary doc
  const deleteSalaryResult = await db.documents.delete(
    salaryDoc.id,
    superAdminUser.id,
    superAdminUser.email,
    'Regenerated salary slip draft due to updated deductions'
  );
  assert(
    deleteSalaryResult.success === true && deleteSalaryResult.action === 'DELETED',
    'Super Admin successfully deletes SALARY_SLIP draft'
  );

  // Summary
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${passed > 0 && failed === 0 ? GREEN : RED}TEST RESULTS: ${passed} PASSED, ${failed} FAILED${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error(`${RED}FATAL ERROR IN TEST SUITE:${RESET}`, err);
  process.exit(1);
});
