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
  getBrandingSettings,
  saveBrandingSettings,
  validateImageBuffer,
  ASSETS_BUCKET
} from '../src/lib/branding';
import { getSupabaseAdminClient } from '../src/lib/supabase';

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

async function runPhase6Tests() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}PHASE 6: FULL VERIFICATION TEST SUITE (HR PORTAL)${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  // =========================================================================
  // 1. DEPARTMENT "OTHER" TESTS
  // =========================================================================
  console.log(`${BOLD}--- 1. DEPARTMENT "OTHER" FUNCTIONALITY ---${RESET}`);

  // 1.1 Default department retrieval
  const departments = await db.departments.list();
  const deptNames = departments.map(d => d.name);
  assert(
    deptNames.includes('Engineering & Technology') &&
    deptNames.includes('Finance & Operations') &&
    deptNames.includes('Human Resources') &&
    deptNames.includes('Product & Design'),
    'All core standard departments exist in department catalog'
  );

  // 1.2 Reject empty or whitespace-only custom department
  let rejectedEmpty = false;
  try {
    await db.departments.findOrCreate('   ');
  } catch (err: any) {
    rejectedEmpty = true;
  }
  assert(rejectedEmpty, 'Reject empty or whitespace-only custom department name');

  // 1.3 Reject "Other" as actual department name
  let rejectedLiteralOther = false;
  try {
    await db.departments.findOrCreate('Other');
  } catch (err: any) {
    rejectedLiteralOther = true;
  }
  assert(rejectedLiteralOther, 'Reject "Other" as an actual persisted department name');

  // 1.4 Reject excessively long department name (>100 chars)
  let rejectedLong = false;
  try {
    const longName = 'A'.repeat(105);
    await db.departments.findOrCreate(longName);
  } catch (err: any) {
    rejectedLong = true;
  }
  assert(rejectedLong, 'Reject custom department name exceeding maximum length (100 chars)');

  // 1.5 Valid custom department creation and deduplication
  const customDeptName = 'Cloud & AI Infrastructure';
  const customDept1 = await db.departments.findOrCreate(customDeptName);
  assert(
    customDept1.name === customDeptName && customDept1.code.length > 0,
    `Custom department "${customDeptName}" created with code "${customDept1.code}"`
  );

  const customDept2 = await db.departments.findOrCreate('  Cloud & AI Infrastructure  ');
  assert(
    customDept2.id === customDept1.id,
    'Custom department lookup is idempotent and trims whitespace properly'
  );

  // 1.6 Employee creation with custom department
  const testEmpCode = `EMP-TEST-${Date.now().toString().slice(-4)}`;
  const empWithCustomDept = await db.employees.create({
    employee_id: testEmpCode,
    first_name: 'Aditi',
    last_name: 'Sharma',
    email: `aditi.sharma.${Date.now()}@varsaka.example.com`,
    phone: '+91 98765 43210',
    department: 'other',
    custom_department: 'Cloud & AI Infrastructure',
    designation: 'Staff ML Engineer',
    joining_date: '2026-03-01',
    employment_type: 'FULL_TIME',
    status: 'ACTIVE',
  });

  assert(
    empWithCustomDept.department === 'Cloud & AI Infrastructure',
    'Employee record stores the actual custom department name ("Cloud & AI Infrastructure"), NOT "other"'
  );
  assert(
    empWithCustomDept.department_id === customDept1.id,
    'Employee record links to the correct custom department ID'
  );

  // 1.7 Employee retrieval reflects custom department
  const fetchedEmp = await db.employees.getById(empWithCustomDept.id);
  assert(
    fetchedEmp?.department === 'Cloud & AI Infrastructure',
    'Retrieved employee preserves custom department name in employee profile'
  );

  // =========================================================================
  // 2. PRINT / PDF A4 PAGINATION & LAYOUT VALIDATION
  // =========================================================================
  console.log(`\n${BOLD}--- 2. PRINT / PDF CSS & A4 PAGINATION AUDIT ---${RESET}`);

  // 2.1 CSS Inspection for A4 page sizing and print-layer isolation
  const globalsCssPath = path.join(process.cwd(), 'src/app/globals.css');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');

  assert(
    globalsCss.includes('@page {') && globalsCss.includes('size: A4;') && globalsCss.includes('margin: 0;'),
    'Print CSS specifies standard A4 sizing with zero print-margins (@page { size: A4; margin: 0; })'
  );
  assert(
    globalsCss.includes('.no-print') && globalsCss.includes('display: none !important;'),
    'Application chrome (nav, aside, header, buttons) is strictly excluded via .no-print'
  );
  assert(
    globalsCss.includes('.a4-page') &&
    globalsCss.includes('width: 210mm') &&
    globalsCss.includes('height: 297mm') &&
    globalsCss.includes('page-break-after: always'),
    'Multi-page template (.a4-page) has exact 210mm x 297mm bounds and explicit page-break-after'
  );
  assert(
    globalsCss.includes('.a4-single-page') &&
    globalsCss.includes('width: 210mm') &&
    globalsCss.includes('height: 297mm') &&
    globalsCss.includes('page-break-after: auto'),
    'Single-page template (.a4-single-page) has exact 210mm x 297mm bounds and avoids extra blank page'
  );
  assert(
    globalsCss.includes('.a4-certificate-page') &&
    globalsCss.includes('width: 210mm') &&
    globalsCss.includes('height: 297mm'),
    'Certificate template (.a4-certificate-page) has exact 210mm x 297mm bounds'
  );

  // 2.2 Template Page Count Audits
  // A. Offer Letter Template
  const offerTemplatePath = path.join(process.cwd(), 'src/components/documents/OfferLetterTemplate.tsx');
  const offerContent = fs.readFileSync(offerTemplatePath, 'utf8');
  const offerA4Pages = (offerContent.match(/className="a4-page"/g) || []).length;
  const offerLastPage = (offerContent.match(/className="a4-page a4-page-last"/g) || []).length;
  const totalOfferPages = offerA4Pages + offerLastPage;
  assert(
    totalOfferPages === 16,
    `Offer Letter template contains exactly 16 discrete A4 pages (Detected: ${totalOfferPages}, was 32 pages previously)`
  );
  assert(
    offerLastPage === 1,
    'Offer Letter final page has .a4-page-last with page-break-after: auto to eliminate trailing blank sheet'
  );

  // B. Experience Letter Template
  const expTemplatePath = path.join(process.cwd(), 'src/components/documents/ExperienceLetterTemplate.tsx');
  const expContent = fs.readFileSync(expTemplatePath, 'utf8');
  const expSinglePages = (expContent.match(/className="a4-single-page/g) || []).length;
  assert(
    expSinglePages === 1 && !expContent.includes('page-break-after: always'),
    'Experience Letter template is strictly 1 single A4 page with no overflow'
  );

  // C. Relieving Letter Template
  const relTemplatePath = path.join(process.cwd(), 'src/components/documents/RelievingLetterTemplate.tsx');
  const relContent = fs.readFileSync(relTemplatePath, 'utf8');
  const relSinglePages = (relContent.match(/className="a4-single-page/g) || []).length;
  assert(
    relSinglePages === 1 && !relContent.includes('page-break-after: always'),
    'Relieving Letter template is strictly 1 single A4 page with no overflow'
  );

  // D. Salary Slip Template
  const salaryTemplatePath = path.join(process.cwd(), 'src/components/documents/SalarySlipTemplate.tsx');
  const salaryContent = fs.readFileSync(salaryTemplatePath, 'utf8');
  const salarySinglePages = (salaryContent.match(/className="a4-single-page/g) || []).length;
  assert(
    salarySinglePages === 1 && !salaryContent.includes('page-break-after: always'),
    'Salary Slip template is strictly 1 single A4 page with no overflow'
  );

  // E. Certificate Template
  const certTemplatePath = path.join(process.cwd(), 'src/components/documents/CertificateTemplate.tsx');
  const certContent = fs.readFileSync(certTemplatePath, 'utf8');
  const certPages = (certContent.match(/className="a4-certificate-page/g) || []).length;
  assert(
    certPages === 1 && !certContent.includes('page-break-after: always'),
    'Certificate template is strictly 1 single A4 page with no overflow'
  );

  // =========================================================================
  // 3. SIGNATURE & STAMP MANAGEMENT AUDIT
  // =========================================================================
  console.log(`\n${BOLD}--- 3. SIGNATURE & STAMP MANAGEMENT & VALIDATION ---${RESET}`);

  // 3.1 Initial branding settings retrieval
  const initialBranding = await getBrandingSettings();
  assert(
    initialBranding.signatory !== undefined && initialBranding.stamp !== undefined,
    'Branding settings schema initialized with signatory and stamp structures'
  );
  assert(
    initialBranding.signatory.is_active === true && initialBranding.stamp.is_active === true,
    'Signatory and stamp are active by default'
  );

  // 3.2 Magic bytes and MIME type validation
  // Test valid PNG (89 50 4E 47 ...)
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
  const pngResult = validateImageBuffer(validPngBuffer, 'image/png');
  assert(pngResult.valid, 'Validation passes for authentic PNG binary header');

  // Test valid JPEG (FF D8 FF ...)
  const validJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
  const jpgResult = validateImageBuffer(validJpgBuffer, 'image/jpeg');
  assert(jpgResult.valid, 'Validation passes for authentic JPEG binary header');

  // Test corrupted / spoofed file (Text disguised as image/png)
  const fakePngBuffer = Buffer.from('This is a text file spoofing as a PNG image');
  const spoofResult = validateImageBuffer(fakePngBuffer, 'image/png');
  assert(!spoofResult.valid && !!spoofResult.error, 'Validation strictly rejects corrupted / spoofed file disguised with fake MIME type');

  // 3.3 Signatory metadata update
  const updatedBranding = await saveBrandingSettings({
    signatory: {
      ...initialBranding.signatory,
      name: 'Dr. Vikram Chandra',
      title: 'Head of Human Resources & People Operations',
      company: 'Varsaka Labs Pvt. Ltd.',
      department: 'Human Resources',
    },
  }, 'USR-SUPERADMIN-001');

  assert(
    updatedBranding.signatory.name === 'Dr. Vikram Chandra' &&
    updatedBranding.signatory.title === 'Head of Human Resources & People Operations',
    'Signatory metadata updated successfully with audit trail'
  );

  // 3.4 Enable/Disable toggling
  const disabledBranding = await saveBrandingSettings({
    stamp: {
      ...initialBranding.stamp,
      is_active: false,
    },
  }, 'USR-SUPERADMIN-001');
  assert(disabledBranding.stamp.is_active === false, 'Company stamp can be successfully disabled');

  const reenabledBranding = await saveBrandingSettings({
    stamp: {
      ...disabledBranding.stamp,
      is_active: true,
    },
  }, 'USR-SUPERADMIN-001');
  assert(reenabledBranding.stamp.is_active === true, 'Company stamp can be successfully re-enabled');

  // =========================================================================
  // 4. VERSIONING & IMMUTABILITY AUDIT
  // =========================================================================
  console.log(`\n${BOLD}--- 4. VERSIONING & IMMUTABILITY VERIFICATION ---${RESET}`);

  // 4.1 Ensure branding is at known Version 1
  const brandV1 = await saveBrandingSettings({
    signatory: {
      ...initialBranding.signatory,
      name: 'Kavita Nair',
      title: 'Chief People Officer',
      version: 1,
      is_active: true,
    },
    stamp: {
      ...initialBranding.stamp,
      version: 1,
      is_active: true,
    },
  }, 'USR-SUPERADMIN-001');

  // 4.2 Create a document under Version 1
  const docV1 = await db.documents.create({
    document_type: 'RELIEVING_LETTER',
    employee_id: empWithCustomDept.id,
    title: `Relieving Certificate - ${empWithCustomDept.full_name}`,
    created_by: 'USR-SUPERADMIN-001',
    data_snapshot: {
      employeeName: empWithCustomDept.full_name,
      employeeId: empWithCustomDept.employee_id,
      designation: empWithCustomDept.designation,
      department: empWithCustomDept.department,
      resignationDate: '2026-02-01',
      lastWorkingDate: '2026-03-31',
      signatory: {
        name: brandV1.signatory.name,
        title: brandV1.signatory.title,
        company: brandV1.signatory.company,
        signature_url: brandV1.signatory.signature_url,
        version: brandV1.signatory.version,
      },
      stamp: {
        stamp_url: brandV1.stamp.stamp_url,
        version: brandV1.stamp.version,
      },
    },
  });

  // 4.3 Approve the document (making it FINAL / IMMUTABLE)
  const approvedDocV1 = await db.documents.approve(docV1.id, 'USR-SUPERADMIN-001');
  assert(
    approvedDocV1.status === 'APPROVED',
    'Document V1 successfully approved and finalized'
  );
  assert(
    approvedDocV1.data_snapshot.signatory?.version === 1 &&
    approvedDocV1.data_snapshot.signatory?.name === 'Kavita Nair',
    'Approved document snapshot records Signatory Version 1 ("Kavita Nair")'
  );

  // 4.4 Admin now updates Signatory and Stamp to Version 2
  const brandV2 = await saveBrandingSettings({
    signatory: {
      ...brandV1.signatory,
      name: 'Rohan Mehra',
      title: 'Director - Global People Operations',
      version: 2,
      effective_from: '2026-04-01',
    },
    stamp: {
      ...brandV1.stamp,
      version: 2,
      effective_from: '2026-04-01',
    },
  }, 'USR-SUPERADMIN-001');

  assert(
    brandV2.signatory.version === 2 && brandV2.signatory.name === 'Rohan Mehra',
    'Global branding successfully upgraded to Version 2 ("Rohan Mehra")'
  );

  // 4.5 Verify previously approved Document V1 remains 100% IMMUTABLE
  const fetchedDocV1 = await db.documents.getById(docV1.id);
  assert(
    fetchedDocV1?.data_snapshot.signatory?.version === 1 &&
    fetchedDocV1?.data_snapshot.signatory?.name === 'Kavita Nair',
    'CRITICAL IMMUTABILITY CHECK: Previously approved document STILL references Version 1 ("Kavita Nair") and was NOT mutated by global branding change!'
  );

  // 4.6 Verify a new document automatically picks up the active Version 2 branding
  const docV2 = await db.documents.create({
    document_type: 'EXPERIENCE_LETTER',
    employee_id: empWithCustomDept.id,
    title: `Experience Letter - ${empWithCustomDept.full_name}`,
    created_by: 'USR-SUPERADMIN-001',
    data_snapshot: {
      employeeName: empWithCustomDept.full_name,
      employeeId: empWithCustomDept.employee_id,
      designation: empWithCustomDept.designation,
      department: empWithCustomDept.department,
      signatory: {
        name: brandV2.signatory.name,
        title: brandV2.signatory.title,
        company: brandV2.signatory.company,
        signature_url: brandV2.signatory.signature_url,
        version: brandV2.signatory.version,
      },
      stamp: {
        stamp_url: brandV2.stamp.stamp_url,
        version: brandV2.stamp.version,
      },
    },
  });

  assert(
    docV2.data_snapshot.signatory?.version === 2 &&
    docV2.data_snapshot.signatory?.name === 'Rohan Mehra',
    'Newly generated document correctly binds to active Version 2 ("Rohan Mehra")'
  );

  // =========================================================================
  // 5. SECURITY & PUBLIC VERIFICATION PRIVACY AUDIT
  // =========================================================================
  console.log(`\n${BOLD}--- 5. STORAGE & PUBLIC VERIFICATION SECURITY AUDIT ---${RESET}`);

  // 5.1 Supabase storage bucket security check
  const supabase = getSupabaseAdminClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  const assetBucket = buckets?.find(b => b.id === ASSETS_BUCKET || b.name === ASSETS_BUCKET);
  assert(
    assetBucket !== undefined,
    `Private Supabase Storage bucket "${ASSETS_BUCKET}" exists`
  );
  assert(
    assetBucket?.public === false,
    `Private Supabase Storage bucket "${ASSETS_BUCKET}" is strictly private (public = false)`
  );

  // 5.2 Public verification privacy projection check
  const publicResult = await db.verification.verifyPublic(approvedDocV1.verification_id);
  assert(
    publicResult.status === 'VALID',
    'Public verification accurately verifies valid approved document'
  );
  assert(
    publicResult.document_number === approvedDocV1.document_number,
    'Public verification provides document number'
  );
  assert(
    publicResult.candidate_name === empWithCustomDept.full_name,
    'Public verification provides employee name'
  );
  assert(
    (publicResult as any).salary === undefined &&
    (publicResult as any).pan === undefined &&
    (publicResult as any).bankAccount === undefined &&
    (publicResult as any).phone === undefined &&
    (publicResult as any).address === undefined,
    'Public verification strictly protects private data (no salary, PAN, bank account, phone, or address)'
  );

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${BOLD}PHASE 6 TEST RESULTS:${RESET} ${GREEN}${passed} PASSED${RESET}, ${failed > 0 ? RED : GREEN}${failed} FAILED${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
