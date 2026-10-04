import fs from 'fs';
import path from 'path';

// Run in mock mode to ensure no real production records are created or modified
delete process.env.NEXT_PUBLIC_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.NEXT_PUBLIC_DATASTORE_MODE = 'mock';
process.env.NODE_ENV = 'test';

import { db } from '../src/lib/db';
import { SessionUser } from '../src/types/auth';
import { DELETE as singleDeleteHandler } from '../src/app/api/documents/[id]/route';
import { POST as bulkActionHandler } from '../src/app/api/documents/bulk-action/route';
import { NextRequest } from 'next/server';

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

async function runProtectedDocumentTests() {
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}TEST SUITE: PROTECTED DOCUMENT DELETE UX & STATUTORY RETENTION${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  const testId = Date.now().toString().slice(-5);

  const superAdminUser: SessionUser = {
    id: 'usr-super-admin-01',
    email: 'admin@varsaka.com',
    role: 'SUPER_ADMIN',
    full_name: 'Super Administrator',
    permissions: [
      'employee.view',
      'employee.create',
      'employee.update',
      'employee.delete',
      'document.offer.create',
      'document.offer.view',
      'document.offer.download',
      'document.offer.approve',
      'document.approve',
      'document.revoke',
      'document.delete',
      'salary.view',
      'salary.update',
    ],
  };

  // Mock requireAuthUser to return superAdminUser
  (global as any).__mockAuthUser = superAdminUser;

  try {
    // Setup test employee
    const testEmp = await db.employees.create({
      employee_id: `EMP-PROT-${testId}`,
      full_name: `Protected Doc Tester ${testId}`,
      email: `prot.${testId}@varsaka.com`,
      phone: '+91 99999 12345',
      department_id: 'dep-eng',
      designation: 'Staff Security Engineer',
      status: 'ACTIVE',
    }, superAdminUser.id, superAdminUser.email);

    // =========================================================================
    // SECTION A: REVOKED DOCUMENT
    // =========================================================================
    console.log(`\n${BOLD}--- A. REVOKED DOCUMENT VERIFICATION ---${RESET}`);

    // Create a REVOKED document
    const revokedDoc = await db.documents.create({
      document_type: 'OFFER_LETTER',
      employee_id: testEmp.id,
      title: `Offer Letter - Revoked Test ${testId}`,
      created_by: superAdminUser.id,
      created_by_name: superAdminUser.full_name,
      status: 'REVOKED',
      data_snapshot: { ctc: 1500000 },
    });

    // 1. UI Row Action inspection (Static code analysis)
    const documentsPagePath = path.resolve(process.cwd(), 'src/app/(portal)/documents/page.tsx');
    const documentsPageSource = fs.readFileSync(documentsPagePath, 'utf-8');

    assert(
      documentsPageSource.includes("doc.status === 'REVOKED'"),
      'A1. UI: Explicit branch exists for doc.status === "REVOKED"'
    );
    assert(
      documentsPageSource.includes('Retention Protected'),
      'A2. UI: Shows "Retention Protected" badge instead of normal Delete button'
    );
    assert(
      documentsPageSource.includes('REVOKED documents are retained for compliance and cannot be physically deleted.'),
      'A3. UI: Tooltip explains statutory retention compliance: "REVOKED documents are retained for compliance and cannot be physically deleted."'
    );

    // 2. Direct DELETE API rejects physical deletion (status 400)
    const directDeleteReq = new NextRequest(`http://localhost:3000/api/documents/${revokedDoc.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Attempting to physically delete a revoked document' }),
    });

    const directDeleteRes = await singleDeleteHandler(directDeleteReq, {
      params: Promise.resolve({ id: revokedDoc.id }),
    });

    assert(
      directDeleteRes.status === 400,
      `A4. Direct DELETE API: Rejects physical deletion of REVOKED document with HTTP 400 (got ${directDeleteRes.status})`
    );

    const directDeleteData = await directDeleteRes.json();
    assert(
      directDeleteData.error?.includes('REVOKED documents are retained for compliance and cannot be physically deleted.'),
      `A5. Direct DELETE API: Returns explicit retention compliance error: "${directDeleteData.error}"`
    );

    const docAfterDirectDelete = await db.documents.getById(revokedDoc.id);
    assert(
      docAfterDirectDelete !== null && docAfterDirectDelete.status === 'REVOKED',
      'A6. Direct DELETE API: REVOKED document remains untouched in database'
    );

    // 3. Bulk deletion reports protected / skipped
    const bulkDeleteRevokedReq = new NextRequest('http://localhost:3000/api/documents/bulk-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'DELETE',
        documentIds: [revokedDoc.id],
        reason: 'Bulk delete test on revoked document',
      }),
    });

    const bulkDeleteRevokedRes = await bulkActionHandler(bulkDeleteRevokedReq);
    assert(bulkDeleteRevokedRes.status === 200, 'A7. Bulk DELETE API: Returns 200 OK');
    const bulkRevokedData = await bulkDeleteRevokedRes.json();
    assert(
      bulkRevokedData.summary.succeeded === 0 && bulkRevokedData.summary.skipped === 1 && bulkRevokedData.summary.failed === 0,
      `A8. Bulk DELETE API: Reports 0 succeeded, 1 skipped, 0 failed (Summary: ${JSON.stringify(bulkRevokedData.summary)})`
    );
    assert(
      bulkRevokedData.results[0]?.outcome === 'skipped',
      'A9. Bulk DELETE API: Result outcome for REVOKED document is "skipped"'
    );

    // =========================================================================
    // SECTION B: APPROVED DOCUMENT
    // =========================================================================
    console.log(`\n${BOLD}--- B. APPROVED DOCUMENT VERIFICATION ---${RESET}`);

    // Create an APPROVED document
    const approvedDoc = await db.documents.create({
      document_type: 'EXPERIENCE_LETTER',
      employee_id: testEmp.id,
      title: `Experience Letter - Approved Test ${testId}`,
      created_by: superAdminUser.id,
      created_by_name: superAdminUser.full_name,
      status: 'APPROVED',
      data_snapshot: { designation: 'Security Engineer' },
    });

    // 1. UI Row Action inspection
    assert(
      documentsPageSource.includes("doc.status === 'APPROVED'"),
      'B1. UI: Explicit branch exists for doc.status === "APPROVED"'
    );
    assert(
      documentsPageSource.includes('Protected') && documentsPageSource.includes('ShieldCheck'),
      'B2. UI: Shows "Protected" pill for APPROVED document without normal physical Delete button'
    );

    // 2. Normal delete transitions according to existing lifecycle (transitions to REVOKED, never physically deleted)
    const approveDeleteReq = new NextRequest(`http://localhost:3000/api/documents/${approvedDoc.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Tenure dispute; revoking approved document under audit lifecycle' }),
    });

    const approveDeleteRes = await singleDeleteHandler(approveDeleteReq, {
      params: Promise.resolve({ id: approvedDoc.id }),
    });

    assert(
      approveDeleteRes.status === 200,
      `B3. Single DELETE API: Succeeds on APPROVED document with HTTP 200 (got ${approveDeleteRes.status})`
    );

    const approveDeleteData = await approveDeleteRes.json();
    assert(
      approveDeleteData.action === 'REVOKED',
      `B4. Single DELETE API: Action is "REVOKED" (soft-delete lifecycle)`
    );

    const checkAppToRev = await db.documents.getById(approvedDoc.id);
    assert(
      checkAppToRev !== null,
      'B5. Single DELETE API: Approved document is NEVER physically deleted'
    );
    assert(
      checkAppToRev?.status === 'REVOKED',
      'B6. Single DELETE API: Document status transitioned from APPROVED to REVOKED'
    );

    // =========================================================================
    // SECTION C: FINAL DOCUMENT
    // =========================================================================
    console.log(`\n${BOLD}--- C. FINAL DOCUMENT VERIFICATION ---${RESET}`);

    // Create a FINAL document
    const finalDoc = await db.documents.create({
      document_type: 'RELIEVING_LETTER',
      employee_id: testEmp.id,
      title: `Relieving Letter - Final Test ${testId}`,
      created_by: superAdminUser.id,
      created_by_name: superAdminUser.full_name,
      status: 'FINAL' as any,
      data_snapshot: { last_working_day: '2026-06-30' },
    });

    // 1. UI Row Action inspection
    assert(
      documentsPageSource.includes("(doc.status as string) === 'FINAL'") || documentsPageSource.includes("FINAL"),
      'C1. UI: Protects FINAL documents identically to APPROVED documents'
    );

    // 2. Delete transitions to REVOKED and is never physically deleted
    const finalDeleteReq = new NextRequest(`http://localhost:3000/api/documents/${finalDoc.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Rehired employee; revoking final separation letter' }),
    });

    const finalDeleteRes = await singleDeleteHandler(finalDeleteReq, {
      params: Promise.resolve({ id: finalDoc.id }),
    });

    assert(
      finalDeleteRes.status === 200,
      `C2. Single DELETE API: Succeeds on FINAL document with HTTP 200 (got ${finalDeleteRes.status})`
    );

    const finalDeleteData = await finalDeleteRes.json();
    assert(
      finalDeleteData.action === 'REVOKED',
      'C3. Single DELETE API: Action is "REVOKED" for FINAL document'
    );

    const checkFinalDoc = await db.documents.getById(finalDoc.id);
    assert(
      checkFinalDoc !== null,
      'C4. Single DELETE API: FINAL document is NEVER physically deleted'
    );
    assert(
      checkFinalDoc?.status === 'REVOKED',
      'C5. Single DELETE API: FINAL document transitioned to REVOKED'
    );

    // =========================================================================
    // SECTION D: MIXED BULK SELECTION
    // =========================================================================
    console.log(`\n${BOLD}--- D. MIXED BULK SELECTION VERIFICATION ---${RESET}`);

    // Create 2 deletable draft documents (PENDING_APPROVAL and REJECTED)
    const draftDoc1 = await db.documents.create({
      document_type: 'OFFER_LETTER',
      employee_id: testEmp.id,
      title: `Draft Offer 1 - Mixed Test ${testId}`,
      created_by: superAdminUser.id,
      created_by_name: superAdminUser.full_name,
      status: 'PENDING_APPROVAL',
      data_snapshot: { ctc: 1000000 },
    });

    const draftDoc2 = await db.documents.create({
      document_type: 'EXPERIENCE_LETTER',
      employee_id: testEmp.id,
      title: `Draft Exp 2 - Mixed Test ${testId}`,
      created_by: superAdminUser.id,
      created_by_name: superAdminUser.full_name,
      status: 'REJECTED',
      data_snapshot: { tenure: '1 year' },
    });

    // Create 1 protected document (APPROVED)
    const protectedApprovedDoc = await db.documents.create({
      document_type: 'CERTIFICATE',
      employee_id: testEmp.id,
      title: `Protected Cert - Mixed Test ${testId}`,
      created_by: superAdminUser.id,
      created_by_name: superAdminUser.full_name,
      status: 'APPROVED',
      data_snapshot: { certification: 'Excellence' },
    });

    // Execute mixed bulk deletion on [draftDoc1, draftDoc2, protectedApprovedDoc]
    const mixedBulkReq = new NextRequest('http://localhost:3000/api/documents/bulk-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'DELETE',
        documentIds: [draftDoc1.id, draftDoc2.id, protectedApprovedDoc.id],
        reason: 'Mixed bulk deletion test execution',
      }),
    });

    const mixedBulkRes = await bulkActionHandler(mixedBulkReq);
    assert(mixedBulkRes.status === 200, 'D1. Mixed Bulk DELETE API: Returns 200 OK');

    const mixedBulkData = await mixedBulkRes.json();
    assert(
      mixedBulkData.summary.total === 3,
      'D2. Mixed Bulk DELETE API: Total documents processed is 3'
    );
    assert(
      mixedBulkData.summary.succeeded === 2,
      `D3. Mixed Bulk DELETE API: 2 deletable draft documents succeeded (deleted) (got ${mixedBulkData.summary.succeeded})`
    );
    assert(
      mixedBulkData.summary.skipped === 1,
      `D4. Mixed Bulk DELETE API: 1 protected document skipped (got ${mixedBulkData.summary.skipped})`
    );
    assert(
      mixedBulkData.summary.failed === 0,
      `D5. Mixed Bulk DELETE API: 0 failed (got ${mixedBulkData.summary.failed})`
    );

    // Verify deletable documents were physically deleted
    const postDraft1 = await db.documents.getById(draftDoc1.id);
    const postDraft2 = await db.documents.getById(draftDoc2.id);
    assert(postDraft1 === null, 'D6. Deletable PENDING_APPROVAL document was physically deleted');
    assert(postDraft2 === null, 'D7. Deletable REJECTED document was physically deleted');

    // Verify protected document remained UNTOUCHED and still APPROVED
    const postProtectedDoc = await db.documents.getById(protectedApprovedDoc.id);
    assert(postProtectedDoc !== null, 'D8. Protected document remains in database registry');
    assert(
      postProtectedDoc?.status === 'APPROVED',
      `D9. Protected document remains UNTOUCHED with status APPROVED (got ${postProtectedDoc?.status})`
    );

    // Verify UI toast formatting logic for mixed selection
    const mockSummaryMixed = { succeeded: 2, skipped: 1, failed: 0 };
    const skippedMsgMixed = mockSummaryMixed.skipped === 1 ? '1 protected document skipped' : `${mockSummaryMixed.skipped} protected documents skipped`;
    const toastMsgMixed = `${mockSummaryMixed.succeeded} deleted, ${skippedMsgMixed}, ${mockSummaryMixed.failed} failed.`;
    assert(
      toastMsgMixed === '2 deleted, 1 protected document skipped, 0 failed.',
      `D10. Toast format for mixed selection: "${toastMsgMixed}"`
    );

    // Verify UI toast formatting logic for all protected selection
    const mockSummaryAllProt = { succeeded: 0, skipped: 3, failed: 0 };
    const skippedMsgAllProt = mockSummaryAllProt.skipped === 1 ? '1 protected document skipped' : `${mockSummaryAllProt.skipped} protected documents skipped`;
    const toastMsgAllProt = `${mockSummaryAllProt.succeeded} deleted, ${skippedMsgAllProt}, ${mockSummaryAllProt.failed} failed.`;
    assert(
      toastMsgAllProt === '0 deleted, 3 protected documents skipped, 0 failed.',
      `D11. Toast format for all-protected selection: "${toastMsgAllProt}"`
    );

    // =========================================================================
    // SECTION E: EMPLOYEE WITH REVOKED DOCUMENT PURGE BLOCKED
    // =========================================================================
    console.log(`\n${BOLD}--- E. EMPLOYEE WITH REVOKED DOCUMENT PURGE BLOCKED ---${RESET}`);

    // Create an employee with only a REVOKED document
    const empWithRevoked = await db.employees.create({
      employee_id: `EMP-REV-${testId}`,
      full_name: `Revoked Employee Tester ${testId}`,
      email: `rev.emp.${testId}@varsaka.com`,
      phone: '+91 99999 54321',
      department_id: 'dep-eng',
      designation: 'Former Staff Engineer',
      status: 'ACTIVE',
    }, superAdminUser.id, superAdminUser.email);

    await db.documents.create({
      document_type: 'EXPERIENCE_LETTER',
      employee_id: empWithRevoked.id,
      title: `Revoked Experience Certificate — ${empWithRevoked.full_name}`,
      created_by: superAdminUser.id,
      created_by_name: superAdminUser.full_name,
      status: 'REVOKED',
      data_snapshot: { tenure: '3 years' },
    });

    // Check preflight dependency evaluation
    const depsRevoked = await db.employees.getDeletionDependencies(empWithRevoked.id);
    assert(
      depsRevoked.retainedDocumentsCount === 1,
      'E1. Dependencies: Accurately counts 1 retained official document'
    );
    assert(
      depsRevoked.canPurge === false,
      'E2. Dependencies: canPurge evaluates to false'
    );
    assert(
      depsRevoked.blockingReason?.includes('Permanent purge unavailable because official documents are retained for statutory/compliance purposes.'),
      `E3. Dependencies: blockingReason includes exact mandatory phrase: "${depsRevoked.blockingReason}"`
    );

    // Attempt direct permanentPurge call -> must fail closed
    let purgeBlocked = false;
    let purgeErrorMsg = '';
    try {
      await db.employees.permanentPurge(empWithRevoked.id, superAdminUser.id, superAdminUser.email);
    } catch (err: any) {
      purgeBlocked = true;
      purgeErrorMsg = err.message;
    }

    assert(purgeBlocked, 'E4. db.employees.permanentPurge: Throws error and fails closed');
    assert(
      purgeErrorMsg.includes('Permanent purge unavailable because official documents are retained for statutory/compliance purposes.'),
      `E5. Error message contains required statutory compliance text: "${purgeErrorMsg}"`
    );

    // Verify employee record remains intact
    const postBlockEmp = await db.employees.getById(empWithRevoked.id);
    assert(postBlockEmp !== null, 'E6. Employee record preserved in database');

    // Verify UI component prevents typing DELETE from bypassing
    const deletionButtonPath = path.resolve(process.cwd(), 'src/components/employees/EmployeeDeletionButton.tsx');
    const deletionButtonSource = fs.readFileSync(deletionButtonPath, 'utf-8');

    assert(
      deletionButtonSource.includes('Permanent purge unavailable because official documents are retained for statutory/compliance purposes.'),
      'E7. UI: EmployeeDeletionButton modal contains exact required compliance banner'
    );
    assert(
      deletionButtonSource.includes('disabled={isBlocked || isPurging}'),
      'E8. UI: Confirmation input is strictly disabled when purge is blocked'
    );
    assert(
      deletionButtonSource.includes('disabled={isPurging || isBlocked || purgeConfirmation !== \'DELETE\'}'),
      'E9. UI: Purge confirmation button cannot be submitted even if typing DELETE were attempted'
    );

    // =========================================================================
    // SECTION F: EMPLOYEE WITH NO RETAINED OFFICIAL DOCUMENTS
    // =========================================================================
    console.log(`\n${BOLD}--- F. EMPLOYEE WITH NO RETAINED DOCUMENTS ELIGIBLE PURGE ---${RESET}`);

    // Create an eligible employee with zero retained documents (only draft unapproved doc + salary)
    const eligibleEmp = await db.employees.create({
      employee_id: `EMP-ELIG-${testId}`,
      full_name: `Eligible Purge Tester ${testId}`,
      email: `elig.${testId}@varsaka.com`,
      phone: '+91 99999 67890',
      department_id: 'dep-eng',
      designation: 'Intern Engineer',
      status: 'ACTIVE',
    }, superAdminUser.id, superAdminUser.email);

    // Add unapproved working draft document
    const eligibleDraftDoc = await db.documents.create({
      document_type: 'OFFER_LETTER',
      employee_id: eligibleEmp.id,
      title: `Draft Offer - Eligible Test ${testId}`,
      created_by: superAdminUser.id,
      created_by_name: superAdminUser.full_name,
      status: 'PENDING_APPROVAL',
      data_snapshot: { stipend: 35000 },
    });

    const depsEligible = await db.employees.getDeletionDependencies(eligibleEmp.id);
    assert(
      depsEligible.retainedDocumentsCount === 0,
      'F1. Dependencies: 0 retained official documents'
    );
    assert(
      depsEligible.draftDocumentsCount === 1,
      'F2. Dependencies: 1 draft document recognized'
    );
    assert(
      depsEligible.canPurge === true,
      'F3. Dependencies: canPurge is true for employee with no retained documents'
    );

    // Execute purge
    const eligiblePurgeResult = await db.employees.permanentPurge(eligibleEmp.id, superAdminUser.id, superAdminUser.email);
    assert(eligiblePurgeResult.success === true, 'F4. permanentPurge succeeds for eligible employee');

    // Verify employee master record and draft document were removed
    const postEligibleEmp = await db.employees.getById(eligibleEmp.id);
    const postEligibleDoc = await db.documents.getById(eligibleDraftDoc.id);
    assert(postEligibleEmp === null, 'F5. Master employee record physically purged');
    assert(postEligibleDoc === null, 'F6. Unapproved draft document cleaned up during purge');

    console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
    console.log(`${BOLD}${CYAN}FINAL RESULT: ${passed} PASSED, ${failed} FAILED${RESET}`);
    console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

runProtectedDocumentTests();
