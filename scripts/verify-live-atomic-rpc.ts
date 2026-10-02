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
import { getSupabaseAdminClient } from '../src/lib/supabase';

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

async function verifyLiveAtomicRpc() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}LIVE SUPABASE ATOMIC RPC DEPLOYMENT & BEHAVIOR VERIFICATION${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  const supabase = getSupabaseAdminClient();
  const testRunId = Date.now().toString().slice(-4);

  try {
    // --------------------------------------------------------------------------
    // 1. PROVE FUNCTION EXISTS & RESTRICTS PERMISSIONS
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- 1. Verification of Function Existence & Access Control ---${RESET}`);

    // Test A: Anon client call must be blocked with PostgreSQL error 42501 (permission denied)
    const anonRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/permanent_purge_employee`, {
      method: 'POST',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_employee_id: '00000000-0000-0000-0000-000000000000' }),
    });

    const anonJson = await anonRes.json().catch(() => ({}));
    assert(
      anonRes.status === 401 && anonJson.code === '42501',
      'PostgreSQL rejected anon caller with 42501 (permission denied for function permanent_purge_employee)',
      `HTTP Status: ${anonRes.status}, Error: ${JSON.stringify(anonJson)}`
    );

    // Test B: Service role caller CAN reach the function (proves function exists and is executable by service_role)
    const { error: serviceRoleErr } = await supabase.rpc('permanent_purge_employee', {
      p_employee_id: '00000000-0000-0000-0000-000000000000',
    });

    assert(
      !!serviceRoleErr && serviceRoleErr.code === 'P0001' && serviceRoleErr.message.includes('EMPLOYEE_NOT_FOUND'),
      'Service-role caller executed function and received PostgreSQL exception P0001: EMPLOYEE_NOT_FOUND',
      `Error: ${serviceRoleErr?.message}`
    );

    // --------------------------------------------------------------------------
    // 2. SYSTEM-PROTECTION ENFORCEMENT INSIDE POSTGRESQL ENGINE
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- 2. Live System-Protection Guard Test ---${RESET}`);

    // Create disposable test employee with is_system_protected = true
    const protectedEmp = await db.employees.create({
      employee_id: `DISP-PROT-${testRunId}`,
      full_name: `Disposable Protected Officer ${testRunId}`,
      email: `disp.prot.${testRunId}@varsaka.com`,
      phone: '+91 91234 56789',
      address: 'Test Facility, Hyderabad',
      department_id: 'dep-exec',
      designation: 'Executive Director',
      joining_date: '2022-01-01',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      status: 'ACTIVE',
      is_system_protected: true,
    });

    assert(!!protectedEmp, `Created disposable protected employee ${protectedEmp.employee_id}`);

    // Attempt RPC purge on protected employee
    const { error: protPurgeErr } = await supabase.rpc('permanent_purge_employee', {
      p_employee_id: protectedEmp.id,
    });

    assert(
      !!protPurgeErr && protPurgeErr.code === 'P0001' && protPurgeErr.message.includes('CRITICAL_SECURITY_VIOLATION'),
      'PostgreSQL engine threw P0001: CRITICAL_SECURITY_VIOLATION for system-protected record',
      `Error: ${protPurgeErr?.message}`
    );

    // Verify protected record is 100% intact
    const verifyProtected = await db.employees.getById(protectedEmp.id);
    assert(!!verifyProtected, 'Protected employee master record remains completely intact');

    // Clean up disposable protected record
    await supabase.from('employees').delete().eq('id', protectedEmp.id);
    await supabase.from('system_settings').delete().eq('key', `emp_meta_${protectedEmp.id}`);

    // --------------------------------------------------------------------------
    // 3. ATOMIC PURGE EXECUTION & FULL TRANSACTION ROLLBACK/COMMIT
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- 3. Live Atomic Purge with Full Dependency Tree ---${RESET}`);

    // Create disposable test employee
    const dispEmp = await db.employees.create({
      employee_id: `DISP-PURGE-${testRunId}`,
      full_name: `Disposable Purge Tester ${testRunId}`,
      email: `disp.purge.${testRunId}@varsaka.com`,
      phone: '+91 98888 11111',
      address: 'Atomic Testing Suite, Hyderabad',
      department_id: 'dep-eng',
      designation: 'Database Architect',
      joining_date: '2024-03-01',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      status: 'ACTIVE',
    });

    // Attach salary
    await db.salary.upsert({
      employee_id: dispEmp.id,
      annual_ctc: 1800000,
      monthly_gross: 150000,
      basic: 75000,
      hra: 37500,
      special_allowance: 20000,
      conveyance: 5000,
      communication_allowance: 0,
      travel_allowance: 0,
      food_allowance: 0,
      other_allowances: 12500,
      employee_pf: 1800,
      employer_pf: 1800,
      professional_tax: 200,
      gratuity: 0,
      tds: 15000,
      esic: 0,
      other_deductions: 0,
      variable_pay: 0,
      net_salary: 135000,
      effective_date: '2024-03-01',
    }, 'super-admin-id', 'admin@varsaka.com');

    // Attach document
    const dispDoc = await db.documents.create({
      employee_id: dispEmp.id,
      document_type: 'OFFER_LETTER',
      title: `Offer Letter — ${dispEmp.full_name}`,
      data_snapshot: { ctc: 1800000 },
      created_by: 'super-admin-id',
      created_by_name: 'Super Administrator',
    });

    // Attach task
    await db.tasks.create({
      title: `Disposable Task for ${dispEmp.full_name}`,
      description: 'Operational task to verify atomic cascading cleanup',
      assigned_to: 'user-admin-01',
      created_by: 'super-admin-id',
      employee_id: dispEmp.id,
      priority: 'HIGH',
      status: 'TODO',
    });

    // Verify all records exist before purge
    const preDocs = await db.documents.list({ employeeId: dispEmp.id });
    assert(preDocs.length >= 1, `Pre-purge: Document exists (count: ${preDocs.length})`);

    const preSalary = await db.salary.getByEmployeeId(dispEmp.id);
    assert(!!preSalary, `Pre-purge: Salary record exists`);

    // Execute atomic permanent purge via DAL (which calls supabase.rpc('permanent_purge_employee'))
    const purgeResult = await db.employees.permanentPurge(dispEmp.id, 'super-admin-id', 'admin@varsaka.com');
    assert(purgeResult.success === true, `Atomic purge RPC executed and committed successfully!`);

    // Verify all employee operational data was removed
    const postEmp = await db.employees.getById(dispEmp.id);
    assert(postEmp === null, `Post-purge: Employee master record permanently deleted`);

    const postSalary = await db.salary.getByEmployeeId(dispEmp.id);
    assert(postSalary === null, `Post-purge: Employee salary record permanently deleted`);

    const postDocs = await db.documents.list({ employeeId: dispEmp.id });
    assert(postDocs.length === 0, `Post-purge: Employee documents permanently deleted`);

    const allTasks = await db.tasks.list({});
    const postTasks = allTasks.filter((t) => t.employee_id === dispEmp.id);
    assert(postTasks.length === 0, `Post-purge: Employee operational tasks permanently deleted`);

    // Verify statutory audit log was written ONLY AFTER successful commit
    const auditLogs = await db.auditLogs.list(20);
    const postAudit = auditLogs.find(
      (log) => log.action === 'EMPLOYEE_PERMANENTLY_PURGED' && log.resource_id === dispEmp.employee_id
    );
    assert(!!postAudit, `Post-purge: Immutable audit log event EMPLOYEE_PERMANENTLY_PURGED preserved`);
    assert(
      (postAudit?.metadata as any)?.atomic_transaction === true,
      `Post-purge: Audit log metadata includes atomic_transaction=true`
    );

    // --------------------------------------------------------------------------
    // 4. REAL EMPLOYEE RECORDS INTEGRITY CONFIRMATION
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- 4. Real Employee Records Integrity Verification ---${RESET}`);

    const allLiveStaff = await db.employees.list({});
    const vl1086 = allLiveStaff.find((e) => e.employee_id === 'VL 1086');
    assert(!!vl1086, 'Production employee VL 1086 (Atal Kumar Pandey) is present and unharmed');
    assert(vl1086?.status === 'ACTIVE', 'VL 1086 status remains ACTIVE');

    const empVl1014 = allLiveStaff.find((e) => e.employee_id === 'EMP-VL-1014');
    assert(!!empVl1014, 'Production employee EMP-VL-1014 is present and unharmed');

  } catch (globalErr: any) {
    console.error(`${RED}Global test runner exception:${RESET}`, globalErr);
    failed++;
  }

  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}TEST SUMMARY: ${passed} PASSED, ${failed} FAILED${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

verifyLiveAtomicRpc();
