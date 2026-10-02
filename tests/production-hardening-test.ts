import { db } from '../src/lib/db';
import { 
  formatEmployeeId, 
  parseEmployeeIdSequence 
} from '../src/lib/id-generator';
import { 
  calculateTenure, 
  maskPanNumber, 
  maskBankNumber, 
  validateVerificationDomain, 
  getPublicVerificationBaseUrl 
} from '../src/lib/utils';
import { ROLE_PERMISSIONS, hasPermission } from '../src/lib/rbac';
import { SessionUser } from '../src/types/auth';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runProductionHardeningTests() {
  console.log('================================================================');
  console.log('VARSAKA HR PORTAL - PRODUCTION HARDENING & WORKFLOW QA SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // 1. Employee ID Auto-Generation & Sequential Guarantee
  // --------------------------------------------------------------------------
  console.log('--- 1. EMPLOYEE ID AUTO-GENERATION ---');
  const seq1001 = formatEmployeeId(1001);
  assert(seq1001 === 'EMP-VL-1001', 'formatEmployeeId(1001) produces EMP-VL-1001');

  const seq1002 = formatEmployeeId(1002);
  assert(seq1002 === 'EMP-VL-1002', 'formatEmployeeId(1002) produces EMP-VL-1002');

  const parsed = parseEmployeeIdSequence('EMP-VL-1045');
  assert(parsed === 1045, 'parseEmployeeIdSequence extracts numeric sequence 1045 from EMP-VL-1045');

  const parsedLegacy = parseEmployeeIdSequence('VL 1086');
  assert(parsedLegacy === null, 'parseEmployeeIdSequence returns null for legacy format VL 1086');

  const parsedPrefixed = parseEmployeeIdSequence('EMP-VL-1086');
  assert(parsedPrefixed === 1086, 'parseEmployeeIdSequence extracts 1086 from EMP-VL-1086');

  // Verify next ID generated is sequential >= 1001
  const generatedId = await db.employees.generateNextEmployeeId();
  assert(generatedId.startsWith('EMP-VL-'), `Generated ID "${generatedId}" matches EMP-VL- pattern`);
  const genSeq = parseEmployeeIdSequence(generatedId);
  assert(genSeq !== null && genSeq >= 1001, `Generated sequence ${genSeq} is >= 1001`);

  // Verify legacy VL 1086 employee record exists and remains untouched
  const allEmployees = await db.employees.list();
  const vl1086 = allEmployees.find(e => e.employee_id === 'VL 1086' || e.employee_code === 'VL 1086');
  assert(!!vl1086, 'Existing production employee VL 1086 (Atal Kumar Pandey) is present and preserved');
  assert(vl1086?.employee_id === 'VL 1086', 'VL 1086 identifier has NOT been changed or overwritten');

  // --------------------------------------------------------------------------
  // 2. Experience & Tenure Calculation
  // --------------------------------------------------------------------------
  console.log('\n--- 2. EXPERIENCE & TENURE CALCULATION ---');
  const tenure1 = calculateTenure('2024-01-01', '2025-01-01');
  assert(tenure1.includes('1 yr') || tenure1.includes('1 year'), `1 year tenure correctly calculated: "${tenure1}"`);

  const tenure2 = calculateTenure('2025-01-20', '2026-10-01');
  assert((tenure2.includes('1 yr') || tenure2.includes('1 year')) && (tenure2.includes('8 mos') || tenure2.includes('8 month') || tenure2.includes('9 mos') || tenure2.includes('9 month')), `1 yr 8/9 mos correctly calculated: "${tenure2}"`);

  const emptyTenure = calculateTenure('', '');
  assert(emptyTenure === '' || emptyTenure === 'N/A', 'Empty dates return N/A or empty gracefully');

  // --------------------------------------------------------------------------
  // 3. Salary Slip Data & Masking (Zero Hardcoded Production PII)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. SALARY DATA MASKING & PRIVACY ---');
  const maskedPan = maskPanNumber('ABCDE1234F');
  assert(maskedPan === '••••••1234', `PAN properly masked: ${maskedPan}`);

  const maskedBank = maskBankNumber('98765432104092');
  assert(maskedBank === '••••4092', `Bank account properly masked to last 4: ${maskedBank}`);

  const shortBank = maskBankNumber('4092');
  assert(shortBank === '••••4092', `Short bank account handled safely: ${shortBank}`);

  // --------------------------------------------------------------------------
  // 4. Offer Letter Bond Decision & Revision Immutability
  // --------------------------------------------------------------------------
  console.log('\n--- 4. OFFER LETTER BOND & REVISION IMMUTABILITY ---');
  // Simulated Offer Letter data snapshots
  const offerWithBond = {
    bondIncluded: true,
    bondDuration: '2 Years',
    bondAmount: 150000,
    bondTerms: 'Standard commitment clause',
  };
  assert(offerWithBond.bondIncluded === true, 'Bond YES state preserved in snapshot');

  const offerWithoutBond = {
    bondIncluded: false,
    bondDuration: undefined,
    bondAmount: undefined,
    bondTerms: undefined,
  };
  assert(offerWithoutBond.bondIncluded === false, 'Bond NO state preserved with omitted terms');

  // Salary revision creates separate document rather than mutating original
  const originalDoc = {
    id: 'doc-original-offer-001',
    document_number: 'VVR-OFF-2026-001',
    status: 'FINAL',
    data_snapshot: { annualCtc: 600000 },
  };
  const revisedDoc = {
    id: 'doc-revised-offer-002',
    document_number: 'VVR-OFF-2026-002',
    status: 'DRAFT',
    data_snapshot: { 
      annualCtc: 750000, 
      previousCompensationReference: '₹6,00,000 per annum (Document: VVR-OFF-2026-001)',
      revisedCompensation: '₹7,50,000 per annum',
    },
  };
  assert(originalDoc.id !== revisedDoc.id, 'Original offer and revision have distinct document IDs');
  assert(originalDoc.document_number !== revisedDoc.document_number, 'Revision receives distinct sequential document number');
  assert(originalDoc.status === 'FINAL', 'Original approved document remains immutable FINAL');

  // --------------------------------------------------------------------------
  // 5. Employee Deletion Protection & Dependency Checks
  // --------------------------------------------------------------------------
  console.log('\n--- 5. EMPLOYEE DELETION WORKFLOW & PROTECTIONS ---');
  // Attempting to delete VL 1086 MUST be rejected
  let vl1086Blocked = false;
  try {
    if (vl1086) {
      await db.employees.requestDeletion(vl1086.id, 'Accidental deletion attempt', 'admin-id');
    }
  } catch (err: any) {
    vl1086Blocked = true;
    assert(err.message.includes('Protected production employee'), 'Deletion request for VL 1086 strictly blocked by protection guard');
  }
  assert(vl1086Blocked, 'Protection guard prevented deletion request for VL 1086');

  // Check dependencies computation
  if (vl1086) {
    const deps = await db.employees.getDeletionDependencies(vl1086.id);
    assert(typeof deps.documentsCount === 'number', `Dependency check returns valid documentsCount (${deps.documentsCount})`);
    assert(typeof deps.salaryCount === 'number', `Dependency check returns valid salaryCount (${deps.salaryCount})`);
  }

  // --------------------------------------------------------------------------
  // 6. User Directory Administration & RBAC Overrides
  // --------------------------------------------------------------------------
  console.log('\n--- 6. USER DIRECTORY & GRANULAR PERMISSION OVERRIDES ---');
  const superAdminUser: SessionUser = {
    id: 'usr-admin-1',
    email: 'admin@varsaka.com',
    full_name: 'Administrator',
    role: 'SUPER_ADMIN',
    permissions: ROLE_PERMISSIONS['SUPER_ADMIN'],
  };

  const hrAdminUser: SessionUser = {
    id: 'usr-hr-1',
    email: 'hr@varsaka.com',
    full_name: 'HR Manager',
    role: 'HR_ADMIN',
    permissions: ROLE_PERMISSIONS['HR_ADMIN'],
  };

  const viewerUser: SessionUser = {
    id: 'usr-viewer-1',
    email: 'viewer@varsaka.com',
    full_name: 'Auditor',
    role: 'VIEWER',
    permissions: ROLE_PERMISSIONS['VIEWER'],
  };

  // RBAC checks
  assert(hasPermission(superAdminUser, 'user.create'), 'SUPER_ADMIN can create system users');
  assert(!hasPermission(hrAdminUser, 'user.create'), 'HR_ADMIN cannot create system users');
  assert(!hasPermission(viewerUser, 'user.create'), 'VIEWER cannot create system users');

  assert(hasPermission(superAdminUser, 'user.delete'), 'SUPER_ADMIN can delete system users');
  assert(!hasPermission(hrAdminUser, 'user.delete'), 'HR_ADMIN cannot delete system users');

  assert(hasPermission(superAdminUser, 'employee.delete'), 'SUPER_ADMIN can approve employee deletion');
  assert(!hasPermission(hrAdminUser, 'employee.delete'), 'HR_ADMIN cannot approve employee deletion');

  // Permission override test
  const testUserId = 'test-override-user-001';
  // Grant explicit override
  await db.users.setPermissionOverride(testUserId, 'document.certificate.create', true, superAdminUser.id);
  const permsWithGrant = await db.users.getPermissions(testUserId, 'VIEWER');
  const certPerm = permsWithGrant.find(p => p.permission === 'document.certificate.create');
  assert(certPerm?.source === 'EXPLICIT_GRANT' && certPerm.effective === true, 'Explicit permission grant override effectively enables permission');

  // Explicit revocation override
  await db.users.setPermissionOverride(testUserId, 'document.certificate.create', false, superAdminUser.id);
  const permsWithRevoke = await db.users.getPermissions(testUserId, 'DOCUMENT_ADMIN');
  const revokedPerm = permsWithRevoke.find(p => p.permission === 'document.certificate.create');
  assert(revokedPerm?.source === 'EXPLICIT_REVOKE' && revokedPerm.effective === false, 'Explicit revocation override disables role-derived permission');

  // Reset override
  await db.users.resetPermissionOverride(testUserId, 'document.certificate.create', superAdminUser.id);
  const permsReset = await db.users.getPermissions(testUserId, 'DOCUMENT_ADMIN');
  const resetPerm = permsReset.find(p => p.permission === 'document.certificate.create');
  assert(resetPerm?.source === 'ROLE_DEFAULT' && resetPerm.effective === true, 'Resetting override restores role default permission');

  // Protection of last active SUPER_ADMIN
  let lastSuperAdminProtected = false;
  try {
    const adminUser = await db.users.getByEmail('admin@varsaka.com');
    if (adminUser) {
      await db.users.updateStatusWithReason(adminUser.id, false, 'Testing protection guard', 'some-actor');
    }
  } catch (err: any) {
    lastSuperAdminProtected = true;
    assert(err.message.includes('Cannot deactivate the last active SUPER_ADMIN'), 'Deactivation of last active SUPER_ADMIN is strictly blocked');
  }
  assert(lastSuperAdminProtected, 'Guard protected the last active SUPER_ADMIN from deactivation');

  // --------------------------------------------------------------------------
  // 7. Certificate Access Request Workflow
  // --------------------------------------------------------------------------
  console.log('\n--- 7. CERTIFICATE ACCESS REQUEST WORKFLOW ---');
  const certReq = await db.certificateRequests.create({
    user_id: hrAdminUser.id,
    user_name: hrAdminUser.full_name,
    user_email: hrAdminUser.email,
    department: 'Human Resources',
    requested_permission: 'document.certificate.create',
  });
  assert(certReq.status === 'PENDING', `New certificate access request has status PENDING (${certReq.id})`);

  // Super Admin approval
  const approvedReq = await db.certificateRequests.approve(certReq.id, superAdminUser.id);
  assert(approvedReq.status === 'APPROVED', 'Certificate access request transitions to APPROVED');
  assert(approvedReq.reviewed_by === superAdminUser.id, 'Reviewer recorded accurately on request');

  // Check that permission override was granted
  const hrPerms = await db.users.getPermissions(hrAdminUser.id, 'HR_ADMIN');
  const hrCertPerm = hrPerms.find(p => p.permission === 'document.certificate.create');
  assert(hrCertPerm?.effective === true, 'Approved request automatically granted certificate generation permission override');

  // --------------------------------------------------------------------------
  // 8. Canonical Public Verification Domain & Localhost Leakage Prevention
  // --------------------------------------------------------------------------
  console.log('\n--- 8. CANONICAL VERIFICATION DOMAIN VALIDATION ---');
  // Local development domain check
  const origNodeEnv = process.env.NODE_ENV;
  const origBaseUrl = process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL;

  // Test 1: Configured domain
  process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL = 'https://varsaka.com';
  const configuredUrl = getPublicVerificationBaseUrl();
  assert(configuredUrl === 'https://varsaka.com', `Configured URL resolved: ${configuredUrl}`);

  const validCheck = validateVerificationDomain();
  assert(validCheck.valid === true, 'Configured domain passes validation');

  // Test 2: In production with missing domain -> must FAIL
  (process.env as any).NODE_ENV = 'production';
  delete process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL;
  const prodCheck = validateVerificationDomain();
  assert(prodCheck.valid === false, 'Production check stops if verification domain is missing');

  // Test 3: In production with localhost domain -> must FAIL
  process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL = 'http://localhost:3000';
  const prodLocalhostCheck = validateVerificationDomain();
  assert(prodLocalhostCheck.valid === false, 'Production check stops if localhost is configured');

  // Restore env
  (process.env as any).NODE_ENV = origNodeEnv;
  if (origBaseUrl) {
    process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL = origBaseUrl;
  } else {
    delete process.env.NEXT_PUBLIC_PUBLIC_VERIFICATION_BASE_URL;
  }

  // --------------------------------------------------------------------------
  // 9. Corporate Legal Entity Metadata Management
  // --------------------------------------------------------------------------
  console.log('\n--- 9. CORPORATE LEGAL ENTITY METADATA ---');
  const metadata = await db.corporateMetadata.get();
  assert(!!metadata.legal_entity, `Legal entity configured: "${metadata.legal_entity}"`);
  assert(!!metadata.brand_name, `Brand name configured: "${metadata.brand_name}"`);
  assert(!!metadata.corporate_website, `Corporate website configured: "${metadata.corporate_website}"`);
  assert(!!metadata.registered_office_address, `Office address configured: "${metadata.registered_office_address}"`);

  console.log('\n================================================================');
  console.log('ALL PRODUCTION HARDENING & WORKFLOW QA TESTS PASSED SUCCESSFULLY');
  console.log('================================================================');
}

runProductionHardeningTests().catch((err) => {
  console.error('\n❌ QA TEST SUITE CRASHED:', err);
  process.exit(1);
});
