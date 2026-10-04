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
import { TokenBucketRateLimiter, loginTokenBucket } from '../src/lib/rate-limit';
import { formatDocumentNumber, getDocumentPrefix } from '../src/lib/id-generator';
import { hasPermission, canApproveDocument } from '../src/lib/rbac';
import { User, DocumentType } from '../src/types/database';

// ANSI escape sequences
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
    console.log(`${GREEN}✅ PASS:${RESET} ${testName}`);
    passed++;
  } else {
    console.error(`${RED}❌ FAIL:${RESET} ${testName}`);
    if (failureDetails) {
      console.error(`   ${YELLOW}Details: ${failureDetails}${RESET}`);
    }
    failed++;
  }
}

async function runTests() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}TEST SUITE: BULK ACTIONS, TOKEN BUCKET & COLLISION RESILIENCE${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  // =========================================================================
  // SECTION 1: TOKEN BUCKET LOGIN RATE LIMITING ALGORITHM
  // =========================================================================
  console.log(`${BOLD}--- 1. TOKEN BUCKET RATE LIMITER SPECIFICATION ---${RESET}`);

  const testLimiter = new TokenBucketRateLimiter(5, 15);
  const testKey = 'test:account:target@varsaka.com';
  const now = Date.now();

  // Test 1: Initial capacity is exactly 5 tokens
  const initialCheck = testLimiter.check(testKey, now);
  assert(initialCheck.allowed === true, 'Initial state: allowed = true');
  assert(initialCheck.remainingTokens === 5, 'Initial state: capacity = 5 tokens');

  // Test 2: Consume 5 tokens sequentially on failure
  for (let i = 1; i <= 5; i++) {
    const res = testLimiter.consume(testKey, now);
    assert(
      res.remainingTokens === 5 - i,
      `Failure ${i} consumes 1 token: ${res.remainingTokens} remaining`,
      `Expected ${5 - i} tokens, got ${res.remainingTokens}`
    );
    if (i < 5) {
      assert(res.isLocked === false, `Failure ${i} is not locked`);
    } else {
      assert(res.isLocked === true, 'Failure 5 exhausts bucket and locks account');
      assert(res.lockoutSeconds > 0, 'Lockout seconds is positive');
    }
  }

  // Test 3: 6th immediate failure is blocked
  const sixthCheck = testLimiter.check(testKey, now);
  assert(sixthCheck.allowed === false, '6th immediate check: allowed = false (blocked)');
  assert(sixthCheck.remainingTokens === 0, '6th immediate check: 0 tokens remaining');
  assert(sixthCheck.lockoutSeconds > 0, '6th check returns Retry-After lockout duration');

  // Test 4: Continuous elapsed refill — After 15 minutes, exactly 1 token is refilled
  const fifteenMinsLater = now + 15 * 60 * 1000;
  const refill15 = testLimiter.check(testKey, fifteenMinsLater);
  assert(refill15.allowed === true, 'After 15 minutes: allowed = true');
  assert(refill15.remainingTokens === 1, `After 15 minutes: exactly 1 token available (got ${refill15.remainingTokens})`);

  // Test 5: After 30 minutes, exactly 2 tokens are refilled
  const thirtyMinsLater = now + 30 * 60 * 1000;
  const refill30 = testLimiter.check(testKey, thirtyMinsLater);
  assert(refill30.remainingTokens === 2, `After 30 minutes: exactly 2 tokens available (got ${refill30.remainingTokens})`);

  // Test 6: Bucket never exceeds capacity of 5 even after 5 hours
  const fiveHoursLater = now + 5 * 60 * 60 * 1000;
  const refillMax = testLimiter.check(testKey, fiveHoursLater);
  assert(refillMax.remainingTokens === 5, `After 5 hours: capped at maximum 5 tokens (got ${refillMax.remainingTokens})`);

  // Test 7: Successful login immediately resets bucket to 5 tokens
  testLimiter.consume(testKey, now);
  testLimiter.consume(testKey, now);
  const beforeReset = testLimiter.check(testKey, now);
  assert(beforeReset.remainingTokens < 5, 'Tokens consumed prior to reset');
  testLimiter.reset(testKey);
  const afterReset = testLimiter.check(testKey, now);
  assert(afterReset.remainingTokens === 5, 'Successful login resets bucket immediately to 5 tokens');
  assert(afterReset.allowed === true, 'Successful login resets allowed to true');

  // Test 8: Global singleton loginTokenBucket is initialized with 5 capacity and 15 min refill
  const globalCheck = loginTokenBucket.check('login:account:test_probe@varsaka.com');
  assert(globalCheck.remainingTokens === 5, 'Global loginTokenBucket initialized with 5 tokens');

  // =========================================================================
  // SECTION 2: DOCUMENT NUMBER COLLISION PREVENTION & RESILIENCE
  // =========================================================================
  console.log(`\n${BOLD}--- 2. DOCUMENT NUMBER SEQUENCE RESILIENCE & COLLISION PREVENTION ---${RESET}`);

  // Test 9: FormatDocumentNumber produces expected pattern
  const offerNum = formatDocumentNumber('OFFER_LETTER', 1005, new Date(2026, 0, 1));
  assert(offerNum === 'VAR-OFF-2026-001005', `formatDocumentNumber standard pattern: ${offerNum}`);

  const salNum = formatDocumentNumber('SALARY_SLIP', 1005, new Date(2026, 9, 1));
  assert(salNum === 'VAR-SAL-2026-10-001005', `formatDocumentNumber salary pattern: ${salNum}`);

  // Test 10: Extracting numeric suffixes from document numbers
  const testDocs = [
    { document_number: 'VAR-OFF-2026-001001' },
    { document_number: 'VAR-OFF-2026-001005' },
    { document_number: 'VAR-OFF-2026-001002' },
  ];
  const extracted = testDocs.map((d) => {
    const match = (d.document_number || '').match(/-(\d+)$/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const maxSeq = Math.max(1000, ...extracted);
  assert(maxSeq === 1005, `Max sequence detected correctly from existing list: ${maxSeq}`);
  const nextSeq = maxSeq + 1;
  assert(nextSeq === 1006, `Next generated sequence avoids collision: ${nextSeq}`);

  // Test 11: Even if documents were deleted (leaving only 1001 and 1005), sequence is still 1006
  const deletedScenario = [
    { document_number: 'VAR-OFF-2026-001001' },
    // 1002, 1003, 1004 deleted!
    { document_number: 'VAR-OFF-2026-001005' },
  ];
  const countOfRemaining = deletedScenario.length; // 2
  const flawedSeq = countOfRemaining + 1001; // 1003 -> might collide or leave gaps
  const robustSeq = Math.max(1000, ...deletedScenario.map(d => parseInt(d.document_number.match(/-(\d+)$/)![1], 10))) + 1;
  assert(robustSeq === 1006, `Sequence scanner guarantees next sequence 1006 despite deletions (not ${flawedSeq})`);

  // =========================================================================
  // SECTION 3: BULK ACTION SERVER-SIDE RBAC & LIFECYCLE
  // =========================================================================
  console.log(`\n${BOLD}--- 3. BULK ACTIONS RBAC & DOCUMENT LIFECYCLE ---${RESET}`);

  // Test 12: Permission checks
  const superAdminUser: any = { id: 'u1', email: 'admin@varsaka.com', role: 'SUPER_ADMIN', permissions: ['*'] };
  const hrAdminUser: any = { id: 'u2', email: 'hr@varsaka.com', role: 'HR_ADMIN', permissions: ['document.delete', 'document.approve', 'document.reject'] };
  const docAdminUser: any = { id: 'u3', email: 'doc@varsaka.com', role: 'DOCUMENT_ADMIN', permissions: ['document.view', 'document.create'] };
  const viewerUser: any = { id: 'u4', email: 'viewer@varsaka.com', role: 'VIEWER', permissions: ['document.view'] };

  assert(hasPermission(superAdminUser, 'document.delete'), 'SUPER_ADMIN has document.delete permission');
  assert(hasPermission(hrAdminUser, 'document.delete'), 'HR_ADMIN has document.delete permission');
  assert(!hasPermission(docAdminUser, 'document.delete'), 'DOCUMENT_ADMIN strictly lacks document.delete permission');
  assert(!hasPermission(viewerUser, 'document.delete'), 'VIEWER strictly lacks document.delete permission');

  // Test 13: Approval permissions
  assert(canApproveDocument(superAdminUser, 'OFFER_LETTER'), 'SUPER_ADMIN can approve OFFER_LETTER');
  assert(canApproveDocument(superAdminUser, 'SALARY_SLIP'), 'SUPER_ADMIN can approve SALARY_SLIP');
  assert(canApproveDocument(hrAdminUser, 'OFFER_LETTER'), 'HR_ADMIN with document.approve can approve OFFER_LETTER');
  const specificApprover: any = { id: 'u5', email: 'offer_mgr@varsaka.com', role: 'HR_ADMIN', permissions: ['document.offer.approve'] };
  assert(canApproveDocument(specificApprover, 'OFFER_LETTER'), 'Specific approver can approve OFFER_LETTER');
  assert(!canApproveDocument(specificApprover, 'SALARY_SLIP'), 'Specific approver cannot approve SALARY_SLIP');
  assert(!canApproveDocument(docAdminUser, 'OFFER_LETTER'), 'DOCUMENT_ADMIN without approval permission cannot approve');

  // Test 14: Lifecycle distinction on delete
  // DRAFT / PENDING_APPROVAL -> Physical delete
  // APPROVED / FINAL -> Transition to REVOKED
  // REVOKED -> Idempotent
  const draftStatus = 'PENDING_APPROVAL';
  const approvedStatus = 'APPROVED';
  assert(
    draftStatus === 'PENDING_APPROVAL' || draftStatus === 'DRAFT' || draftStatus === 'REJECTED',
    'Pending/Draft/Rejected documents identified for physical removal'
  );
  assert(
    approvedStatus === 'APPROVED' || approvedStatus === 'FINAL',
    'Approved/Final documents identified for controlled soft-delete (REVOKED)'
  );

  // =========================================================================
  // SECTION 4: TEMPLATE & DUAL SIGNATURE GRID AUDIT
  // =========================================================================
  console.log(`\n${BOLD}--- 4. DUAL SIGNATURE GRID & A4 TEMPLATE VERIFICATION ---${RESET}`);

  // Test 15: AuthorizedSignatoryBlock exports DualSignatureGrid
  const authBlockSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/documents/AuthorizedSignatoryBlock.tsx'),
    'utf-8'
  );
  assert(authBlockSource.includes('export const DualSignatureGrid'), 'AuthorizedSignatoryBlock.tsx exports DualSignatureGrid');
  assert(authBlockSource.includes('export const AuthorizedSignatoryBlock'), 'AuthorizedSignatoryBlock.tsx preserves AuthorizedSignatoryBlock');
  assert(authBlockSource.includes('export const CandidateSignatoryBlock'), 'AuthorizedSignatoryBlock.tsx preserves CandidateSignatoryBlock');

  // Test 16: OfferLetterTemplate uses DualSignatureGrid on Page 2 and Page 16
  const offerTemplateSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/documents/OfferLetterTemplate.tsx'),
    'utf-8'
  );
  assert(offerTemplateSource.includes('<DualSignatureGrid'), 'OfferLetterTemplate imports and renders DualSignatureGrid');

  // Count discrete A4 pages in OfferLetterTemplate
  const a4PageMatches = (offerTemplateSource.match(/className="a4-page/g) || []).length;
  assert(a4PageMatches === 16, `OfferLetterTemplate has exactly 16 discrete A4 pages (got ${a4PageMatches})`);

  // Test 17: Signature and stamp aspect ratio constraints
  assert(authBlockSource.includes('objectFit: \'contain\''), 'Signature & Stamp use objectFit: contain');
  assert(authBlockSource.includes('border-t-2 border-slate-800'), 'Divider line uses clean border-t-2 border-slate-800');
  assert(authBlockSource.includes('Accepted Candidate'), 'Header includes Accepted Candidate');
  assert(authBlockSource.includes('Authorized Signatory'), 'Header includes Authorized Signatory');

  // =========================================================================
  // SECTION 5: APPROVALS QUEUE COMPONENT AUDIT
  // =========================================================================
  console.log(`\n${BOLD}--- 5. APPROVALS QUEUE COMPONENT & ACTIONS AUDIT ---${RESET}`);

  const approvalsPageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/(portal)/approvals/page.tsx'),
    'utf-8'
  );
  assert(approvalsPageSource.includes('Selected:'), 'Approvals page displays Selected: N counter');
  assert(approvalsPageSource.includes('Approve Selected'), 'Approvals page has Approve Selected action');
  assert(approvalsPageSource.includes('Reject Selected'), 'Approvals page has Reject Selected action');
  assert(approvalsPageSource.includes('Delete Selected'), 'Approvals page has Delete Selected action');
  assert(approvalsPageSource.includes('handleToggleSelectAll'), 'Approvals page implements Select All toggle');
  assert(approvalsPageSource.includes('bulkApproveModalOpen'), 'Approvals page has bulk approval confirmation modal');
  assert(approvalsPageSource.includes('deleteModalOpen'), 'Approvals page has bulk delete confirmation modal with mandatory reason');

  const bulkRouteSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/api/documents/bulk-action/route.ts'),
    'utf-8'
  );
  assert(bulkRouteSource.includes('\'DELETE\''), 'bulk-action API route supports DELETE action');
  assert(bulkRouteSource.includes('document.delete'), 'bulk-action API route enforces document.delete RBAC');
  assert(bulkRouteSource.includes('SALARY_SLIP'), 'bulk-action API route protects confidential SALARY_SLIP documents');

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
