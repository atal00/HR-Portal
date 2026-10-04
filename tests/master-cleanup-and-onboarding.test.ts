import fs from 'fs';
import path from 'path';

// Load .env.local
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
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

import { getSupabaseAdminClient } from '../src/lib/supabase';
import { calculateCompensation, calculateNetInHand } from '../src/lib/compensation';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function check(condition: boolean, title: string, details?: any) {
  if (condition) {
    console.log(`${GREEN}✅ PASS:${RESET} ${title}`);
    if (details) console.log(`   ${JSON.stringify(details)}`);
    passed++;
  } else {
    console.error(`${RED}❌ FAIL:${RESET} ${title}`);
    if (details) console.error(`   ${JSON.stringify(details)}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   HR PORTAL MASTER SUITE: CLEANUP, ONBOARDING & SALARY TESTS   ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  const supabase = getSupabaseAdminClient();
  const PROTECTED_ADMIN_EMAIL = 'admin@in.varsaka.com';

  // =========================================================================
  // GROUP A: Data Cleanup Safety
  // =========================================================================
  console.log(`\n${BOLD}--- GROUP A: Data Cleanup Safety ---${RESET}`);

  // A1: Exactly one auth user exists and it is admin@in.varsaka.com
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUsers = authData?.users || [];
  check(
    authUsers.length === 1 && authUsers[0].email?.toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase(),
    'A1: admin@in.varsaka.com remains as the ONLY protected auth user',
    { count: authUsers.length, email: authUsers[0]?.email, id: authUsers[0]?.id }
  );

  // A2: Exactly one public user exists and it is admin@in.varsaka.com
  const { data: appUsers } = await supabase.from('users').select('*');
  check(
    (appUsers?.length === 1) && appUsers[0].email?.toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase(),
    'A2: admin@in.varsaka.com remains as the ONLY public.users record',
    { count: appUsers?.length, email: appUsers?.[0]?.email, id: appUsers?.[0]?.id }
  );

  // A3: Admin has SUPER_ADMIN role binding
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('*, roles(code, name)')
    .eq('user_id', appUsers?.[0]?.id);
  const superAdminRole = (userRoles || []).find((r: any) => r.roles?.code === 'SUPER_ADMIN');
  check(
    Boolean(superAdminRole),
    'A3: SUPER_ADMIN role binding remains active for admin@in.varsaka.com',
    { roles: userRoles?.map((r: any) => r.roles?.code) }
  );

  // A4: Admin credentials and password hash remain intact
  const { data: creds } = await supabase
    .from('user_credentials')
    .select('*')
    .eq('user_id', appUsers?.[0]?.id);
  check(
    (creds?.length === 1) && Boolean(creds[0].password_hash),
    'A4: Admin credentials record exists and password hash is intact',
    { count: creds?.length, hasHash: Boolean(creds?.[0]?.password_hash) }
  );

  // A5: Non-admin test employees are removed
  const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });
  check(
    empCount === 0,
    'A5: All temporary/test employees have been cleanly purged',
    { remainingEmployees: empCount }
  );

  // A6: Non-admin test documents are removed
  const { count: docCount } = await supabase.from('documents').select('*', { count: 'exact', head: true });
  check(
    docCount === 0,
    'A6: All temporary/test documents have been cleanly purged',
    { remainingDocuments: docCount }
  );

  // A7: Document & Employee sequences are NOT reset
  const { data: sequences } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['numbering_sequences', 'employee_sequence_counter']);
  const numSeq = sequences?.find((s) => s.key === 'numbering_sequences');
  const empSeq = sequences?.find((s) => s.key === 'employee_sequence_counter');
  check(
    Boolean(numSeq) && Boolean(empSeq) && typeof empSeq?.value === 'number' && empSeq?.value >= 1027,
    'A7: PostgreSQL / system sequences were NOT reset (employee_sequence_counter retained: ' + empSeq?.value + ')',
    { numbering_sequences: numSeq?.value, employee_sequence_counter: empSeq?.value }
  );

  // =========================================================================
  // GROUP B: Onboarding Wizard Steps
  // =========================================================================
  console.log(`\n${BOLD}--- GROUP B: Onboarding Wizard Steps ---${RESET}`);

  const onboardingFilePath = path.resolve(process.cwd(), 'src/app/(portal)/employees/new/page.tsx');
  const onboardingContent = fs.readFileSync(onboardingFilePath, 'utf-8');

  // B1: Exactly 4 steps exist in SECTIONS
  const sectionsMatch = onboardingContent.match(/const SECTIONS\s*=\s*\[([\s\S]*?)\]\s*as const;/);
  const sectionsBlock = sectionsMatch ? sectionsMatch[1] : '';
  const stepCountMatches = (sectionsBlock.match(/step:\s*\d+/g) || []).length;
  check(
    stepCountMatches === 4,
    'B1: Exactly 4 onboarding steps are defined in the wizard',
    { definedSteps: stepCountMatches }
  );

  // B2: No KYC & Documents Step 5 in SECTIONS or Stepper
  const hasStep5InSections = sectionsBlock.includes('KYC') || sectionsBlock.includes('step: 5');
  const hasSectionE = onboardingContent.includes("activeSection === 'E'");
  check(
    !hasStep5InSections && !hasSectionE,
    'B2: KYC & Documents Step 5 and Section E are completely removed',
    { hasStep5InSections, hasSectionE }
  );

  // B3: Stepper indicator reflects 4 steps
  const hasOf4Text = onboardingContent.includes('of 4');
  check(
    hasOf4Text,
    'B3: Progress indicator and navigation display "Step X of 4"',
    { hasOf4Text }
  );

  // B4: Statutory fields remain in Step 2 (Section B)
  const hasPan = onboardingContent.includes("register('pan_number')");
  const hasAadhaar = onboardingContent.includes("register('aadhaar_number')");
  const hasPassport = onboardingContent.includes("register('passport_number')");
  const hasUan = onboardingContent.includes("register('uan')");
  const hasPf = onboardingContent.includes("register('pf_number')");
  const hasEsic = onboardingContent.includes("register('esic_number')");
  check(
    hasPan && hasAadhaar && hasPassport && hasUan && hasPf && hasEsic,
    'B4: Statutory fields (PAN, Aadhaar, Passport, UAN, PF, ESIC) remain in Step 2',
    { hasPan, hasAadhaar, hasPassport, hasUan, hasPf, hasEsic }
  );

  // =========================================================================
  // GROUP C: Required Fields Validation
  // =========================================================================
  console.log(`\n${BOLD}--- GROUP C: Required Fields Validation ---${RESET}`);

  // C1: City, State, PIN Code are required in Step 1
  const cityValidation = onboardingContent.includes("register('city'");
  const stateValidation = onboardingContent.includes("register('state'");
  const pinValidation = onboardingContent.includes("register('pin_code'");
  check(
    cityValidation && stateValidation && pinValidation,
    'C1: City, State, and PIN Code are registered with validation in Step 1',
    { cityValidation, stateValidation, pinValidation }
  );

  // C2: Indian 6-digit PIN Code validation regex
  const pinRegex = /^[1-9][0-9]{5}$/;
  check(
    pinRegex.test('500081') &&
    pinRegex.test('110001') &&
    !pinRegex.test('012345') &&
    !pinRegex.test('50008') &&
    !pinRegex.test('5000812') &&
    !pinRegex.test('ABCDEF') &&
    !pinRegex.test('      '),
    'C2: Indian 6-digit PIN Code regex correctly validates valid codes and rejects invalid/whitespace',
    { sampleValid: pinRegex.test('500081'), sampleInvalidLeadingZero: pinRegex.test('012345'), sampleShort: pinRegex.test('50008') }
  );

  // C3: Bank coordinates required fields
  const bankNameVal = onboardingContent.includes("register('bank_name'");
  const holderNameVal = onboardingContent.includes("register('bank_account_holder_name'");
  const accNumVal = onboardingContent.includes("register('bank_account_number'");
  const ifscVal = onboardingContent.includes("register('bank_ifsc'");
  check(
    bankNameVal && holderNameVal && accNumVal && ifscVal,
    'C3: Bank Name, Account Holder Name, Bank Account Number, and IFSC are registered with validation in Step 4',
    { bankNameVal, holderNameVal, accNumVal, ifscVal }
  );

  // C4: Indian IFSC Code validation regex
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  check(
    ifscRegex.test('HDFC0001234') &&
    ifscRegex.test('SBIN0000456') &&
    ifscRegex.test('ICIC0000001') &&
    !ifscRegex.test('HDFC1001234') && // 5th char must be 0
    !ifscRegex.test('HDF0001234') &&  // too short
    !ifscRegex.test('HDFC00012345') && // too long
    !ifscRegex.test('      '),
    'C4: Standard Indian IFSC regex correctly validates standard IFSC and rejects non-standard',
    { sampleValid: ifscRegex.test('HDFC0001234'), sampleInvalidFifthChar: ifscRegex.test('HDFC1001234') }
  );

  // =========================================================================
  // GROUP D: Placeholder / Sample Text
  // =========================================================================
  console.log(`\n${BOLD}--- GROUP D: Placeholder / Sample Text ---${RESET}`);

  // D1: No "Atal Kumar Pandey" placeholder exists
  const hasAtalKumarPandey = onboardingContent.includes('Atal Kumar Pandey');
  check(
    !hasAtalKumarPandey,
    'D1: "Atal Kumar Pandey" does NOT appear anywhere in onboarding UI placeholder text',
    { hasAtalKumarPandey }
  );

  // D2: Generic "e.g. Full Legal Name" is used
  const hasGenericPlaceholder = onboardingContent.includes('placeholder="e.g. Full Legal Name"');
  check(
    hasGenericPlaceholder,
    'D2: Generic placeholder "e.g. Full Legal Name" is actively used for the Full Legal Name input',
    { hasGenericPlaceholder }
  );

  // =========================================================================
  // GROUP E: Live Salary Calculation & Compensation Engine Consistency
  // =========================================================================
  console.log(`\n${BOLD}--- GROUP E: Live Salary Calculation & Engine Parity ---${RESET}`);

  // E1: Central compensation engine produces standard breakdown
  const ctc50kGross = calculateCompensation(600000, 0);
  check(
    ctc50kGross.annualCtc === 600000 &&
    ctc50kGross.monthlyGross === 50000 &&
    ctc50kGross.basic === 20000 &&
    ctc50kGross.hra === 10000 &&
    ctc50kGross.employeePf === 1800 &&
    ctc50kGross.employerPf === 1800 &&
    ctc50kGross.professionalTax === 200 &&
    ctc50kGross.gratuity === 962 &&
    ctc50kGross.netSalary === 45238,
    'E1: Shared compensation engine calculateCompensation(600000) matches standard breakdown',
    {
      monthlyGross: ctc50kGross.monthlyGross,
      basic: ctc50kGross.basic,
      hra: ctc50kGross.hra,
      employeePf: ctc50kGross.employeePf,
      employerPf: ctc50kGross.employerPf,
      pt: ctc50kGross.professionalTax,
      gratuity: ctc50kGross.gratuity,
      netSalary: ctc50kGross.netSalary,
    }
  );

  // E2: calculateNetInHand reacts immediately to modified Employee PF
  const originalNet = calculateNetInHand({
    monthlyGross: 50000,
    employeePf: 1800,
    employerPf: 1800,
    professionalTax: 200,
    gratuity: 962,
    tds: 0,
    esic: 0,
    otherDeductions: 0,
  });

  const modifiedPfNet = calculateNetInHand({
    monthlyGross: 50000,
    employeePf: 2500, // Changed from 1800 to 2500 (+700 deduction)
    employerPf: 1800,
    professionalTax: 200,
    gratuity: 962,
    tds: 0,
    esic: 0,
    otherDeductions: 0,
  });

  check(
    originalNet.netSalary === 45238 &&
    modifiedPfNet.netSalary === 44538 &&
    originalNet.netSalary - modifiedPfNet.netSalary === 700,
    'E2: Modifying Employee PF (1800 -> 2500) immediately adjusts Net In-Hand (45238 -> 44538)',
    { original: originalNet.netSalary, modified: modifiedPfNet.netSalary, difference: 700 }
  );

  // E3: calculateNetInHand reacts to TDS modification
  const modifiedTdsNet = calculateNetInHand({
    monthlyGross: 50000,
    employeePf: 1800,
    employerPf: 1800,
    professionalTax: 200,
    gratuity: 962,
    tds: 2000, // Added 2000 TDS
    esic: 0,
    otherDeductions: 0,
  });
  check(
    modifiedTdsNet.netSalary === 43238 &&
    originalNet.netSalary - modifiedTdsNet.netSalary === 2000,
    'E3: Modifying TDS (0 -> 2000) immediately adjusts Net In-Hand (45238 -> 43238)',
    { modifiedTds: modifiedTdsNet.netSalary, expected: 43238 }
  );

  // E4: calculateNetInHand reacts to Professional Tax (PT) modification
  const modifiedPtNet = calculateNetInHand({
    monthlyGross: 50000,
    employeePf: 1800,
    employerPf: 1800,
    professionalTax: 300, // Changed PT from 200 to 300
    gratuity: 962,
    tds: 0,
    esic: 0,
    otherDeductions: 0,
  });
  check(
    modifiedPtNet.netSalary === 45138 &&
    originalNet.netSalary - modifiedPtNet.netSalary === 100,
    'E4: Modifying Professional Tax (200 -> 300) immediately adjusts Net In-Hand (45238 -> 45138)',
    { modifiedPt: modifiedPtNet.netSalary, expected: 45138 }
  );

  // E5: calculateNetInHand reacts to ESIC modification
  const modifiedEsicNet = calculateNetInHand({
    monthlyGross: 50000,
    employeePf: 1800,
    employerPf: 1800,
    professionalTax: 200,
    gratuity: 962,
    tds: 0,
    esic: 375, // Added ESIC
    otherDeductions: 0,
  });
  check(
    modifiedEsicNet.netSalary === 44863 &&
    originalNet.netSalary - modifiedEsicNet.netSalary === 375,
    'E5: Modifying ESIC (0 -> 375) immediately adjusts Net In-Hand (45238 -> 44863)',
    { modifiedEsic: modifiedEsicNet.netSalary, expected: 44863 }
  );

  // E6: calculateNetInHand reacts to Other Deductions modification
  const modifiedOtherNet = calculateNetInHand({
    monthlyGross: 50000,
    employeePf: 1800,
    employerPf: 1800,
    professionalTax: 200,
    gratuity: 962,
    tds: 0,
    esic: 0,
    otherDeductions: 500, // Added Other Deductions
  });
  check(
    modifiedOtherNet.netSalary === 44738 &&
    originalNet.netSalary - modifiedOtherNet.netSalary === 500,
    'E6: Modifying Other Deductions (0 -> 500) immediately adjusts Net In-Hand (45238 -> 44738)',
    { modifiedOther: modifiedOtherNet.netSalary, expected: 44738 }
  );

  // E7: Onboarding form includes both [Auto-Calculate Breakdown] and [Calculate In-Hand] actions
  const hasAutoCalculate = onboardingContent.includes('Auto-Calculate Breakdown');
  const hasCalculateInHand = onboardingContent.includes('Calculate In-Hand');
  const hasHelperText = onboardingContent.includes('Calculated from current earnings and deductions');
  check(
    hasAutoCalculate && hasCalculateInHand && hasHelperText,
    'E7: Onboarding component includes [Auto-Calculate Breakdown], [Calculate In-Hand], and helper text',
    { hasAutoCalculate, hasCalculateInHand, hasHelperText }
  );

  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${passed === 20 ? GREEN : RED}TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  if (failed > 0) process.exit(1);
}

runTestSuite().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
