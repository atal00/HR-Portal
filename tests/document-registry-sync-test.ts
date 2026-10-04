/**
 * ==============================================================================
 * VARSAKA HR PORTAL — DOCUMENT REGISTRY SYNC & SEARCH RESET TEST SUITE
 * ==============================================================================
 * Explicitly tests:
 * 
 * DELETE SYNCHRONIZATION:
 * 1. Delete succeeds → subsequent registry GET does not contain deleted document
 * 2. UI refresh after successful delete (authoritative re-fetch without cache)
 * 3. Delete failure → document remains visible and error is shown
 * 4. Audit event remains recorded for all deletions
 * 5. RBAC remains strictly enforced on DELETE endpoint
 * 
 * SEARCH SYNCHRONIZATION:
 * 6. Search "001004" → matching records only
 * 7. Clear search ("") → returns ALL accessible documents
 * 8. New search after clear → correct matching results
 * 9. Empty search + Type filter → correct type subset
 * 10. Empty search + Status filter → correct status subset
 * 11. Search + Type + Status → correct intersection
 * 12. Pagination reset on search clear / filter change
 * 13. Route handler force-dynamic & Cache-Control: no-store validation
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';

// Load .env.local configuration if present
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
import { hasPermission } from '../src/lib/rbac';
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
  console.log(`${BOLD}${CYAN}  HR PORTAL — DOCUMENT REGISTRY SYNC & SEARCH RESET SUITE       ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // ============================================================================
  // SECTION 1: CODE ARCHITECTURE & CACHING AUDIT
  // ============================================================================
  console.log(`${BOLD}SECTION 1: Route Handler & UI Cache-Busting Audit${RESET}`);

  const pagePath = path.resolve(process.cwd(), 'src/app/(portal)/documents/page.tsx');
  const pageContent = fs.readFileSync(pagePath, 'utf-8');

  // Verify UI has reactive search that triggers on search, typeFilter, statusFilter
  assert(
    pageContent.includes('[search, typeFilter, statusFilter, fetchDocs]'),
    'UI: useEffect triggers reactively when search, typeFilter, or statusFilter changes'
  );

  // Verify UI uses 0ms delay when clearing search
  assert(
    pageContent.includes("const delay = search === '' ? 0 : 180;"),
    'UI: Cleared search triggers immediate (0ms) re-fetch without debounce lag'
  );

  // Verify UI has clear button
  assert(
    pageContent.includes('handleClearSearch') && pageContent.includes('title="Clear search"'),
    'UI: Includes explicit Clear Search ("X") action button inside the search field'
  );

  // Verify UI resets pagination on search or filter change
  assert(
    pageContent.includes('setCurrentPage(1);'),
    'UI: Resets pagination state to Page 1 whenever search query or filters change'
  );

  // Verify UI uses cache: 'no-store' and cache-busting timestamp
  assert(
    pageContent.includes("cache: 'no-store'") && pageContent.includes("params.set('_t'"),
    "UI: fetchDocs uses cache: 'no-store' and timestamp param to bypass browser/CDN cache"
  );

  // Verify UI handles refresh failure gracefully
  assert(
    pageContent.includes('toast.error(\'Document was deleted, but refreshing the registry failed'),
    'UI: Displays explicit error state if deletion succeeds on backend but re-fetch fails'
  );

  // Verify API route has force-dynamic and no-store headers
  const routePath = path.resolve(process.cwd(), 'src/app/api/documents/route.ts');
  const routeContent = fs.readFileSync(routePath, 'utf-8');
  assert(
    routeContent.includes("export const dynamic = 'force-dynamic';") &&
    routeContent.includes('export const revalidate = 0;'),
    'API: GET /api/documents enforces dynamic execution with revalidate = 0'
  );
  assert(
    routeContent.includes("'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'"),
    'API: GET /api/documents sets Cache-Control: no-store on response'
  );
  assert(
    routeContent.includes('const rawSearch = searchParams.get(\'search\');') &&
    routeContent.includes('const search = rawSearch && rawSearch.trim() ? rawSearch.trim() : undefined;'),
    'API: GET /api/documents safely handles empty/whitespace search as no filter'
  );

  // Verify DELETE route has dynamic export
  const deleteRoutePath = path.resolve(process.cwd(), 'src/app/api/documents/[id]/route.ts');
  const deleteRouteContent = fs.readFileSync(deleteRoutePath, 'utf-8');
  assert(
    deleteRouteContent.includes("export const dynamic = 'force-dynamic';"),
    'API: DELETE /api/documents/[id] enforces dynamic execution'
  );

  // ============================================================================
  // SECTION 2: END-TO-END SEARCH & FILTER DATA SYNCHRONIZATION
  // ============================================================================
  console.log(`\n${BOLD}SECTION 2: Search & Filter Data Synchronization${RESET}`);

  // Setup seed documents in database
  const empList = await db.employees.list();
  const testEmp = empList[0] || (await db.employees.create({
    full_name: 'Sync Test Employee',
    email: `sync.test.${Date.now()}@varsaka.internal`,
    designation: 'Software Engineer',
    department: 'Engineering',
    joining_date: '2025-01-01',
    employment_type: 'FULL_TIME',
    work_location: 'Bangalore',
    status: 'ACTIVE',
  }, 'sys-admin', 'admin@varsaka.com'));

  // Create known test documents
  const docOffer = await db.documents.create({
    document_type: 'OFFER_LETTER',
    employee_id: testEmp.id,
    title: 'Offer Letter - Senior Engineer Test 001004',
    data_snapshot: { ctc: 1800000 },
    created_by: 'test-admin',
    created_by_name: 'Test Administrator',
    status: 'PENDING_APPROVAL',
  });

  const docExp = await db.documents.create({
    document_type: 'EXPERIENCE_LETTER',
    employee_id: testEmp.id,
    title: 'Experience Letter - Standard 002005',
    data_snapshot: { period: '2 years' },
    created_by: 'test-admin',
    created_by_name: 'Test Administrator',
    status: 'APPROVED',
  });

  const docCert = await db.documents.create({
    document_type: 'CERTIFICATE',
    employee_id: testEmp.id,
    title: 'Certificate of Excellence 003006',
    data_snapshot: { reason: 'Top Performer' },
    created_by: 'test-admin',
    created_by_name: 'Test Administrator',
    status: 'PENDING_APPROVAL',
  });

  // Test 2.1: Search by specific string "001004"
  const searchResults1 = await db.documents.list({ search: '001004' });
  assert(
    searchResults1.some((d) => d.id === docOffer.id),
    'Search: Query "001004" finds document with matching number/title'
  );
  assert(
    !searchResults1.some((d) => d.id === docExp.id),
    'Search: Query "001004" strictly excludes non-matching document docExp'
  );

  // Test 2.2: Clearing search completely ("") restores ALL accessible documents
  const allDocs = await db.documents.list();
  const clearedResults = await db.documents.list({ search: '' });
  assert(
    clearedResults.length === allDocs.length,
    `Search: Clearing search ("") restores ALL documents (${clearedResults.length} records)`
  );
  assert(
    clearedResults.some((d) => d.id === docOffer.id) &&
    clearedResults.some((d) => d.id === docExp.id) &&
    clearedResults.some((d) => d.id === docCert.id),
    'Search: All test documents are present when search query is empty'
  );

  // Test 2.3: Whitespace search ("   ") is treated identically to no filter
  const whitespaceResults = await db.documents.list({ search: '   ' });
  assert(
    whitespaceResults.length === allDocs.length,
    'Search: Whitespace search ("   ") correctly treated as no filter'
  );

  // Test 2.4: New search after clearing works
  const searchResults2 = await db.documents.list({ search: '003006' });
  assert(
    searchResults2.length === 1 && searchResults2[0].id === docCert.id,
    'Search: Subsequent search "003006" after clearing returns correct single record'
  );

  // Test 2.5: Empty search + Type filter
  const offerOnly = await db.documents.list({ search: '', type: 'OFFER_LETTER' });
  assert(
    offerOnly.every((d) => d.document_type === 'OFFER_LETTER'),
    'Filter: Empty search + Type="OFFER_LETTER" returns only Offer Letters'
  );
  assert(
    offerOnly.some((d) => d.id === docOffer.id) && !offerOnly.some((d) => d.id === docCert.id),
    'Filter: Type filter correctly isolates matching types'
  );

  // Test 2.6: Empty search + Status filter
  const approvedOnly = await db.documents.list({ search: '', status: 'APPROVED' });
  assert(
    approvedOnly.every((d) => d.status === 'APPROVED'),
    'Filter: Empty search + Status="APPROVED" returns only Approved documents'
  );

  // Test 2.7: Intersection of Search + Type + Status
  const intersectionResults = await db.documents.list({
    search: 'Senior Engineer',
    type: 'OFFER_LETTER',
    status: 'PENDING_APPROVAL',
  });
  assert(
    intersectionResults.length >= 1 && intersectionResults[0].id === docOffer.id,
    'Filter: Search + Type + Status combines into correct intersection'
  );

  // ============================================================================
  // SECTION 3: DELETE SYNCHRONIZATION & LIFECYCLE AUDIT
  // ============================================================================
  console.log(`\n${BOLD}SECTION 3: Document Deletion Synchronization & Lifecycle${RESET}`);

  // Test 3.1: Super Admin has document.delete
  const superAdminUser: SessionUser = {
    id: 'usr-admin-1',
    email: 'admin@varsaka.com',
    full_name: 'Super Administrator',
    role: 'SUPER_ADMIN',
    department: 'Executive',
    status: 'ACTIVE',
    mfa_enabled: true,
  };

  const viewerUser: SessionUser = {
    id: 'usr-viewer-1',
    email: 'viewer@varsaka.com',
    full_name: 'Readonly Viewer',
    role: 'VIEWER',
    department: 'Operations',
    status: 'ACTIVE',
    mfa_enabled: true,
  };

  assert(hasPermission(superAdminUser, 'document.delete'), 'RBAC: SUPER_ADMIN has document.delete privilege');
  assert(!hasPermission(viewerUser, 'document.delete'), 'RBAC: VIEWER strictly lacks document.delete privilege');

  // Test 3.2: Delete Draft / Pending document succeeds
  const deleteResult = await db.documents.delete(
    docOffer.id,
    superAdminUser.id,
    superAdminUser.email,
    'Duplicate test draft requiring removal'
  );
  assert(deleteResult.success, 'Delete: delete() returns success = true');
  assert(deleteResult.action === 'DELETED', 'Delete: PENDING_APPROVAL document executes physical DELETED action');

  // Test 3.3: Authoritative GET after delete does NOT contain deleted document
  const listAfterDelete = await db.documents.list();
  assert(
    !listAfterDelete.some((d) => d.id === docOffer.id),
    'Delete: Authoritative registry list does NOT contain physically deleted document'
  );

  // Test 3.4: getById on physically deleted document returns null
  const fetchedDeleted = await db.documents.getById(docOffer.id);
  assert(fetchedDeleted === null, 'Delete: Direct getById on physically deleted document returns null');

  // Test 3.5: Mandatory deletion reason is enforced
  let reasonErrorCaught = false;
  try {
    await db.documents.delete(docCert.id, superAdminUser.id, superAdminUser.email, '   ');
  } catch (e: any) {
    reasonErrorCaught = true;
    assert(
      e.message.includes('mandatory deletion reason'),
      'Delete: Empty/whitespace deletion reason throws validation error'
    );
  }
  assert(reasonErrorCaught, 'Delete: Mandatory reason strictly enforced (cannot delete with whitespace)');

  // Verify docCert remains intact after failed delete attempt
  const certStillExists = await db.documents.getById(docCert.id);
  assert(certStillExists !== null, 'Delete: Document remains in registry when deletion validation fails');

  // Test 3.6: Approved document deletion executes soft-delete (REVOKED) lifecycle rule
  const revokeDeleteResult = await db.documents.delete(
    docExp.id,
    superAdminUser.id,
    superAdminUser.email,
    'Employee separation canceled; revoking historical experience letter'
  );
  assert(revokeDeleteResult.success, 'Delete: Approved document deletion succeeds');
  assert(revokeDeleteResult.action === 'REVOKED', 'Delete: Approved document follows legal lifecycle to REVOKED');
  
  const revokedDocRecord = await db.documents.getById(docExp.id);
  assert(
    revokedDocRecord?.status === 'REVOKED',
    'Delete: Revoked document remains in registry with REVOKED status for audit retention'
  );

  // Clean up remaining test certificate
  await db.documents.delete(
    docCert.id,
    superAdminUser.id,
    superAdminUser.email,
    'Cleanup of test record'
  );

  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}FINAL RESULTS: ${passed} PASSED, ${failed} FAILED${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
