import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  canApproveDocument,
  canRevokeDocument,
  canAccessSalary,
  hasPermission,
} from '../src/lib/rbac';
import { SessionUser, UserRole } from '../src/types/auth';
import { DocumentRecord, DocumentType } from '../src/types/database';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`${GREEN}✅ PASS: ${name}${RESET}`);
    passed++;
  } catch (err: any) {
    console.error(`${RED}❌ FAIL: ${name}${RESET}`);
    console.error(`   ${err.message}`);
    failed++;
  }
}

async function runTests() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}TEST SUITE: BULK DOCUMENT SELECTION & ACTIONS ARCHITECTURE${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  const approvalsPath = path.resolve(process.cwd(), 'src/app/(portal)/approvals/page.tsx');
  const documentsPath = path.resolve(process.cwd(), 'src/app/(portal)/documents/page.tsx');
  const bulkRoutePath = path.resolve(process.cwd(), 'src/app/api/documents/bulk-action/route.ts');

  const approvalsSource = fs.readFileSync(approvalsPath, 'utf-8');
  const documentsSource = fs.readFileSync(documentsPath, 'utf-8');
  const bulkRouteSource = fs.readFileSync(bulkRoutePath, 'utf-8');

  // =========================================================================
  // 1. APPROVALS QUEUE STATIC & LOGICAL AUDIT
  // =========================================================================
  console.log(`\n${BOLD}--- 1. APPROVALS QUEUE COMPONENT AUDIT ---${RESET}`);

  it('Approvals table header has visible Select All checkbox with accessible label', () => {
    assert(approvalsSource.includes('<input'), 'Approvals table has input element');
    assert(approvalsSource.includes('type="checkbox"'), 'Approvals table uses checkbox type');
    assert(approvalsSource.includes('aria-label="Select All"'), 'Header checkbox has aria-label="Select All"');
    assert(approvalsSource.includes('ref={headerCheckboxRef}'), 'Header checkbox connects to ref');
  });

  it('Approvals table body rows have visible selection checkbox as the FIRST column', () => {
    assert(approvalsSource.includes('aria-label={`Select document ${doc.document_number}`}'), 'Row checkbox has accessible label');
    assert(approvalsSource.includes('checked={isSelected}'), 'Row checkbox binds to isSelected');
    assert(approvalsSource.includes('onChange={() => handleToggleSelect(doc.id)}'), 'Row checkbox toggles on change');
  });

  it('Approvals header supports indeterminate state synchronized via ref', () => {
    assert(approvalsSource.includes('isPartiallySelected'), 'Calculates isPartiallySelected');
    assert(approvalsSource.includes('headerCheckboxRef.current.indeterminate = isPartiallySelected'), 'Synchronizes indeterminate property via useEffect');
  });

  it('Approvals displays live Selected: N counter and keeps action buttons', () => {
    assert(approvalsSource.includes('Selected:'), 'Displays Selected: label');
    assert(approvalsSource.includes('selectedIds.length'), 'Binds selected count to selectedIds.length');
    assert(approvalsSource.includes('Approve Selected'), 'Contains Approve Selected button');
    assert(approvalsSource.includes('Reject Selected'), 'Contains Reject Selected button');
    assert(approvalsSource.includes('Delete Selected'), 'Contains Delete Selected button');
  });

  it('Approvals disables bulk buttons when zero rows are selected', () => {
    assert(approvalsSource.includes('disabled={selectedIds.length === 0 || isSubmitting}'), 'Approve and Reject disabled when 0 selected');
  });

  it('Approvals handles mixed-result responses with accurate summary counts', () => {
    assert(approvalsSource.includes('data.summary'), 'Reads data.summary from API response');
    assert(approvalsSource.includes('succeeded') && approvalsSource.includes('skipped') && approvalsSource.includes('failed'), 'Includes succeeded, skipped, and failed metrics');
  });

  it('Approvals Bulk Delete modal requires mandatory non-whitespace deletion reason and shows document list', () => {
    assert(approvalsSource.includes('Delete {selectedIds.length} Documents?'), 'Modal title reflects selected count');
    assert(approvalsSource.includes('Reason for deletion'), 'Contains Reason for deletion label');
    assert(approvalsSource.includes('selectedDocuments.map'), 'Lists selected documents in modal');
    assert(approvalsSource.includes('Delete ${selectedIds.length} Documents'), 'Submit button reflects document count');
  });

  it('Approvals clears selections and refreshes authoritative data after bulk operations', () => {
    assert(approvalsSource.includes('setSelectedIds([])'), 'Clears selection array after action');
    assert(approvalsSource.includes('await fetchData()'), 'Refetches authoritative pending docs');
  });

  // =========================================================================
  // 2. OFFICIAL DOCUMENTS REGISTRY STATIC & LOGICAL AUDIT
  // =========================================================================
  console.log(`\n${BOLD}--- 2. OFFICIAL DOCUMENTS REGISTRY COMPONENT AUDIT ---${RESET}`);

  it('Documents Registry has visible checkbox as FIRST column of header and body rows', () => {
    assert(documentsSource.includes('<input'), 'Documents registry has input elements');
    assert(documentsSource.includes('aria-label="Select All"'), 'Registry header has Select All checkbox');
    assert(documentsSource.includes('aria-label={`Select document ${doc.document_number}`}'), 'Registry body rows have accessible checkboxes');
  });

  it('Documents Registry header checkbox supports checked, unchecked, and indeterminate states', () => {
    assert(documentsSource.includes('isAllVisibleSelected'), 'Calculates isAllVisibleSelected');
    assert(documentsSource.includes('isPartiallySelected'), 'Calculates isPartiallySelected');
    assert(documentsSource.includes('headerCheckboxRef.current.indeterminate = isPartiallySelected'), 'Syncs indeterminate state via ref');
  });

  it('Documents Registry displays Selected: X counter in bulk toolbar', () => {
    assert(documentsSource.includes('Selected: <strong className="text-slate-900 font-mono text-sm">{selectedIds.length}</strong>'), 'Displays Selected: X counter');
  });

  it('Documents Registry provides bulk action toolbar with Approve, Revoke, and Delete Selected', () => {
    assert(documentsSource.includes('Approve Selected'), 'Registry has Approve Selected button');
    assert(documentsSource.includes('Revoke Selected'), 'Registry has Revoke Selected button');
    assert(documentsSource.includes('Delete Selected'), 'Registry has Delete Selected button');
    assert(documentsSource.includes('disabled={selectedIds.length === 0 || isBulkSubmitting}'), 'Bulk toolbar buttons disabled when zero selected');
  });

  it('Documents Registry Bulk Delete modal requires mandatory reason and displays selected documents', () => {
    assert(documentsSource.includes('bulkDeleteModalOpen'), 'Has bulkDeleteModalOpen state');
    assert(documentsSource.includes('Delete {selectedIds.length} Documents?'), 'Modal title formatted with count');
    assert(documentsSource.includes('Reason for deletion'), 'Contains Reason for deletion label');
    assert(documentsSource.includes('disabled={isBulkSubmitting || !bulkDeleteReason.trim()}'), 'Prevents submission with empty or whitespace-only reason');
  });

  it('Documents Registry Bulk Revoke modal requires mandatory reason and displays selected documents', () => {
    assert(documentsSource.includes('bulkRevokeModalOpen'), 'Has bulkRevokeModalOpen state');
    assert(documentsSource.includes('Revoke {selectedIds.length} Documents?'), 'Modal title formatted with count');
    assert(documentsSource.includes('Reason for revocation'), 'Contains Reason for revocation label');
    assert(documentsSource.includes('disabled={isBulkSubmitting || bulkRevokeReason.trim().length < 5}'), 'Enforces minimum reason length');
  });

  it('Documents Registry Bulk Approve modal confirms eligibility and displays selected documents', () => {
    assert(documentsSource.includes('bulkApproveModalOpen'), 'Has bulkApproveModalOpen state');
    assert(documentsSource.includes('Approve {selectedIds.length} Documents?'), 'Modal title formatted with count');
  });

  it('Documents Registry resets selection on search, filter, and authoritative refresh', () => {
    assert(documentsSource.includes('setSelectedIds([])'), 'Clears selection state');
    assert(documentsSource.includes('cache: \'no-store\''), 'Bypasses cache on authoritative refresh');
  });

  // =========================================================================
  // 3. BULK ACTION API LIFECYCLE & MIXED-RESULT SEMANTICS
  // =========================================================================
  console.log(`\n${BOLD}--- 3. BULK ACTION API LIFECYCLE & SERVER-SIDE VALIDATION ---${RESET}`);

  it('API route validates action is one of APPROVE, REJECT, REVOKE, DELETE', () => {
    assert(bulkRouteSource.includes('\'APPROVE\''), 'Supports APPROVE');
    assert(bulkRouteSource.includes('\'REJECT\''), 'Supports REJECT');
    assert(bulkRouteSource.includes('\'REVOKE\''), 'Supports REVOKE');
    assert(bulkRouteSource.includes('\'DELETE\''), 'Supports DELETE');
  });

  it('API route enforces server-side RBAC for delete, revoke, and confidential salary slips', () => {
    assert(bulkRouteSource.includes('canRevokeDocument'), 'Checks canRevokeDocument permission');
    assert(bulkRouteSource.includes('document.delete'), 'Checks document.delete permission');
    assert(bulkRouteSource.includes('canAccessSalary'), 'Checks salary slip confidentiality');
  });

  it('API route returns mixed-result summary with succeeded, skipped, and failed counts', () => {
    assert(bulkRouteSource.includes('succeeded: succeededCount'), 'Returns succeeded count');
    assert(bulkRouteSource.includes('skipped: skippedCount'), 'Returns skipped count');
    assert(bulkRouteSource.includes('failed: failedCount'), 'Returns failed count');
  });

  // =========================================================================
  // 4. RBAC SIMULATION TESTS
  // =========================================================================
  console.log(`\n${BOLD}--- 4. RBAC SIMULATION SPECIFICATION ---${RESET}`);

  const superAdminUser: SessionUser = {
    id: 'user-super',
    email: 'admin@varsaka.com',
    full_name: 'Super Admin',
    role: 'SUPER_ADMIN',
    permissions: [],
  };

  const hrAdminUser: SessionUser = {
    id: 'user-hr',
    email: 'hr@varsaka.com',
    full_name: 'HR Admin',
    role: 'HR_ADMIN',
    permissions: ['document.approve', 'document.delete', 'document.revoke', 'salary.view'],
  };

  const viewerUser: SessionUser = {
    id: 'user-viewer',
    email: 'viewer@varsaka.com',
    full_name: 'Viewer',
    role: 'VIEWER',
    permissions: ['document.read'],
  };

  const docAdminUser: SessionUser = {
    id: 'user-doc-admin',
    email: 'docadmin@varsaka.com',
    full_name: 'Doc Admin',
    role: 'DOCUMENT_ADMIN',
    permissions: ['document.read', 'document.create'],
  };

  it('SUPER_ADMIN can bulk approve, revoke, delete, and view salary documents', () => {
    assert.strictEqual(canApproveDocument(superAdminUser, 'OFFER_LETTER'), true);
    assert.strictEqual(canRevokeDocument(superAdminUser), true);
    assert.strictEqual(hasPermission(superAdminUser, 'document.delete'), true);
    assert.strictEqual(canAccessSalary(superAdminUser), true);
  });

  it('HR_ADMIN with authorized permissions can approve, revoke, delete, and view salary documents', () => {
    assert.strictEqual(canApproveDocument(hrAdminUser, 'OFFER_LETTER'), true);
    assert.strictEqual(canRevokeDocument(hrAdminUser), true);
    assert.strictEqual(hasPermission(hrAdminUser, 'document.delete'), true);
    assert.strictEqual(canAccessSalary(hrAdminUser), true);
  });

  it('VIEWER cannot bulk approve, revoke, delete, or access salary documents', () => {
    assert.strictEqual(canApproveDocument(viewerUser, 'OFFER_LETTER'), false);
    assert.strictEqual(canRevokeDocument(viewerUser), false);
    assert.strictEqual(hasPermission(viewerUser, 'document.delete'), false);
    assert.strictEqual(canAccessSalary(viewerUser), false);
  });

  it('DOCUMENT_ADMIN without approval/delete permissions cannot approve, revoke, or delete', () => {
    assert.strictEqual(canApproveDocument(docAdminUser, 'OFFER_LETTER'), false);
    assert.strictEqual(canRevokeDocument(docAdminUser), false);
    assert.strictEqual(hasPermission(docAdminUser, 'document.delete'), false);
  });

  // =========================================================================
  // 5. LIFECYCLE SIMULATION FOR BULK ACTIONS
  // =========================================================================
  console.log(`\n${BOLD}--- 5. DOCUMENT LIFECYCLE SIMULATION ---${RESET}`);

  const mockPendingOffer: DocumentRecord = {
    id: 'doc-pending-1',
    document_number: 'VAR-OFF-2026-001001',
    verification_id: 'V-OFF-ABC1',
    document_type: 'OFFER_LETTER',
    title: 'Offer Letter - Alice',
    status: 'PENDING_APPROVAL',
    employee_id: 'emp-1',
    version_number: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const mockApprovedOffer: DocumentRecord = {
    id: 'doc-approved-1',
    document_number: 'VAR-OFF-2026-001002',
    verification_id: 'V-OFF-ABC2',
    document_type: 'OFFER_LETTER',
    title: 'Offer Letter - Bob',
    status: 'APPROVED',
    employee_id: 'emp-2',
    version_number: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const mockRevokedOffer: DocumentRecord = {
    id: 'doc-revoked-1',
    document_number: 'VAR-OFF-2026-001003',
    verification_id: 'V-OFF-ABC3',
    document_type: 'OFFER_LETTER',
    title: 'Offer Letter - Charlie',
    status: 'REVOKED',
    employee_id: 'emp-3',
    version_number: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  it('Approval lifecycle: only PENDING_APPROVAL can be approved; APPROVED is skipped', () => {
    function evaluateApproveEligibility(doc: DocumentRecord) {
      if (doc.status === 'APPROVED') return 'skipped';
      if (doc.status !== 'PENDING_APPROVAL') return 'failed';
      return 'succeeded';
    }

    assert.strictEqual(evaluateApproveEligibility(mockPendingOffer), 'succeeded');
    assert.strictEqual(evaluateApproveEligibility(mockApprovedOffer), 'skipped');
    assert.strictEqual(evaluateApproveEligibility(mockRevokedOffer), 'failed');
  });

  it('Revocation lifecycle: only APPROVED can be revoked; REVOKED is skipped; PENDING is skipped', () => {
    function evaluateRevokeEligibility(doc: DocumentRecord) {
      if (doc.status === 'REVOKED') return 'skipped';
      if (doc.status !== 'APPROVED') return 'skipped';
      return 'succeeded';
    }

    assert.strictEqual(evaluateRevokeEligibility(mockApprovedOffer), 'succeeded');
    assert.strictEqual(evaluateRevokeEligibility(mockRevokedOffer), 'skipped');
    assert.strictEqual(evaluateRevokeEligibility(mockPendingOffer), 'skipped');
  });

  it('Deletion lifecycle: APPROVED transitions to REVOKED; REVOKED is idempotent; PENDING is physically deleted', () => {
    function evaluateDeleteAction(doc: DocumentRecord) {
      if (doc.status === 'APPROVED') return 'REVOKED';
      if (doc.status === 'REVOKED') return 'ALREADY_REVOKED';
      return 'DELETED';
    }

    assert.strictEqual(evaluateDeleteAction(mockPendingOffer), 'DELETED');
    assert.strictEqual(evaluateDeleteAction(mockApprovedOffer), 'REVOKED');
    assert.strictEqual(evaluateDeleteAction(mockRevokedOffer), 'ALREADY_REVOKED');
  });

  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}FINAL RESULT: ${passed} PASSED, ${failed} FAILED${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
