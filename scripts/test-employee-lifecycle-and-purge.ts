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

async function runLifecycleTests() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}EMPLOYEE LIFECYCLE & PERMANENT PURGE VERIFICATION SUITE${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  const supabase = getSupabaseAdminClient();
  const testRunId = Date.now().toString().slice(-4);
  const testEmpCode = `TEST-LC-${testRunId}`;

  try {
    // -------------------------------------------------------------
    // SCENARIO A: ACTIVE employee can create permitted documents
    // -------------------------------------------------------------
    console.log(`${BOLD}\n--- Scenario A: ACTIVE employee document generation ---${RESET}`);
    
    // 1. Create an active test employee with salary
    const newEmp = await db.employees.create({
      employee_id: testEmpCode,
      full_name: `Lifecycle Tester ${testRunId}`,
      email: `test.lc.${testRunId}@varsaka.com`,
      phone: '+91 98765 43210',
      address: '123 Tech Park, Financial District, Hyderabad',
      department_id: 'dep-eng',
      designation: 'Senior QA Engineer',
      joining_date: '2023-01-15',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      status: 'ACTIVE',
      bank_name: 'HDFC Bank',
      bank_account_number: '123456789012',
      bank_ifsc: 'HDFC0001234',
    });

    assert(!!newEmp && !!newEmp.id, `Created test employee ${testEmpCode}`, `ID: ${newEmp?.id}`);
    assert(newEmp.status === 'ACTIVE', `Employee status is ACTIVE`);

    // Attach master salary record for ACTIVE employee
    const activeSalary = await db.salary.upsert({
      employee_id: newEmp.id,
      annual_ctc: 1200000,
      monthly_gross: 100000,
      basic: 50000,
      hra: 25000,
      special_allowance: 15000,
      conveyance: 5000,
      communication_allowance: 0,
      travel_allowance: 0,
      food_allowance: 0,
      other_allowances: 5000,
      employee_pf: 1800,
      employer_pf: 1800,
      professional_tax: 200,
      gratuity: 0,
      tds: 5000,
      esic: 0,
      other_deductions: 0,
      variable_pay: 0,
      net_salary: 93000,
      effective_date: '2023-01-15'
    }, 'admin-super-id', 'admin@varsaka.com');

    assert(!!activeSalary && activeSalary.annual_ctc === 1200000, `ACTIVE employee salary record initialized`);

    // 2. Generate an official document for ACTIVE employee
    const activeDoc = await db.documents.create({
      employee_id: newEmp.id,
      document_type: 'EXPERIENCE_LETTER',
      title: `Experience Certificate — ${newEmp.full_name}`,
      data_snapshot: {
        employeeName: newEmp.full_name,
        employeeId: newEmp.employee_id,
        designation: newEmp.designation,
        joiningDate: newEmp.joining_date,
        tenure: '2 years 3 months',
      },
      created_by: 'admin-super-id',
      created_by_name: 'Super Administrator',
    });

    assert(!!activeDoc && !!activeDoc.id, `ACTIVE employee successfully generated document (${activeDoc?.document_number})`);
    assert(!!activeDoc.verification_id, `Document received unique verification token: ${activeDoc?.verification_id}`);

    // -------------------------------------------------------------
    // SCENARIO B: ACTIVE -> INACTIVE blocks new document generation server-side
    // -------------------------------------------------------------
    console.log(`${BOLD}\n--- Scenario B: ACTIVE -> INACTIVE transition & server-side enforcement ---${RESET}`);

    // Update status to INACTIVE
    const updatedToInactive = await db.employees.update(newEmp.id, {
      status: 'INACTIVE',
      separation_reason: 'Resigned to pursue higher education',
      last_working_date: '2026-09-30'
    });

    assert(updatedToInactive.status === 'INACTIVE', `Employee status updated to INACTIVE`);

    // Historical records must remain intact
    const fetchedInactive = await db.employees.getById(newEmp.id);
    assert(!!fetchedInactive, `Historical employee record remains accessible`);
    assert(fetchedInactive?.separation_reason === 'Resigned to pursue higher education', `Separation metadata preserved`);

    const existingDocs = await db.documents.list({ employeeId: newEmp.id });
    assert(existingDocs.length >= 1, `Existing document history remains intact (count: ${existingDocs.length})`);

    const existingSalary = await db.salary.getByEmployeeId(newEmp.id);
    assert(!!existingSalary, `Historical compensation record remains intact (CTC: ${existingSalary?.annual_ctc})`);

    // Attempting to generate a new document for INACTIVE employee MUST be blocked server-side
    let docBlocked = false;
    let docBlockError = '';
    try {
      await db.documents.create({
        employee_id: newEmp.id,
        document_type: 'SALARY_SLIP',
        title: `Unauthorized Salary Slip for Inactive`,
        data_snapshot: { month: 'October 2026' },
        created_by: 'admin-super-id',
        created_by_name: 'Super Administrator',
      });
    } catch (err: any) {
      docBlocked = true;
      docBlockError = err.message;
    }
    assert(docBlocked, `Server-side document generation strictly BLOCKED for INACTIVE employee`, `Error: ${docBlockError}`);

    // Attempting new payroll processing / salary upsert MUST be blocked server-side
    let salaryBlocked = false;
    let salaryBlockError = '';
    try {
      await db.salary.upsert({
        employee_id: newEmp.id,
        annual_ctc: 1500000,
        monthly_gross: 125000,
        basic: 62500,
        hra: 31250,
        special_allowance: 15000,
        conveyance: 5000,
        communication_allowance: 0,
        travel_allowance: 0,
        food_allowance: 0,
        other_allowances: 11250,
        employee_pf: 1800,
        employer_pf: 1800,
        professional_tax: 200,
        gratuity: 0,
        tds: 8000,
        esic: 0,
        other_deductions: 0,
        variable_pay: 0,
        net_salary: 115000,
        effective_date: '2026-10-01'
      });
    } catch (err: any) {
      salaryBlocked = true;
      salaryBlockError = err.message;
    }
    assert(salaryBlocked, `Server-side salary/payroll modification strictly BLOCKED for INACTIVE employee`, `Error: ${salaryBlockError}`);

    // -------------------------------------------------------------
    // SCENARIO C: INACTIVE employee view & audit verification
    // -------------------------------------------------------------
    console.log(`${BOLD}\n--- Scenario C: INACTIVE employee viewing & audit integrity ---${RESET}`);

    // View profile
    const profileView = await db.employees.getById(newEmp.id);
    assert(!!profileView && profileView.full_name === `Lifecycle Tester ${testRunId}`, `Profile fully readable by authorized users`);
    assert(profileView?.status === 'INACTIVE', `Profile retains accurate INACTIVE badge status`);

    // Check directory listing includes INACTIVE employee for audit/search
    const directory = await db.employees.list({ search: testEmpCode });
    const inDirectory = directory.find((e) => e.id === newEmp.id);
    assert(!!inDirectory, `INACTIVE employee remains searchable and viewable in Employee Directory`);

    // -------------------------------------------------------------
    // SCENARIO D: Permanent purge of a TEST employee in correct FK dependency order
    // -------------------------------------------------------------
    console.log(`${BOLD}\n--- Scenario D: Permanent Purge with controlled FK cascade ---${RESET}`);

    // Add a dependent task to ensure all child branches are populated
    await db.tasks.create({
      title: `Offboarding Task for ${newEmp.full_name}`,
      description: 'Asset return and clearance verification',
      assigned_to: 'user-admin-01',
      created_by: 'admin-super-id',
      employee_id: newEmp.id,
      priority: 'HIGH',
      status: 'COMPLETED'
    });

    // Execute permanent purge
    let purgeSuccess = false;
    let purgeError = '';
    try {
      const purgeResult = await db.employees.permanentPurge(newEmp.id, 'admin-super-id', 'admin@varsaka.com');
      purgeSuccess = !!purgeResult && (purgeResult.success === true || purgeResult.purgedId === newEmp.employee_id || purgeResult.purgedId === newEmp.id);
    } catch (err: any) {
      purgeError = err.message;
    }

    assert(purgeSuccess, `Permanent purge completed without FK constraint violation!`, purgeError);

    // Verify employee record is completely removed
    const postPurgeEmp = await db.employees.getById(newEmp.id);
    assert(postPurgeEmp === null, `Employee record permanently removed from employees table`);

    // Verify salary record is removed
    const postPurgeSalary = await db.salary.getByEmployeeId(newEmp.id);
    assert(postPurgeSalary === null, `Employee salary record permanently removed`);

    // Verify documents are removed
    const postPurgeDocs = await db.documents.list({ employeeId: newEmp.id });
    assert(postPurgeDocs.length === 0, `Employee documents permanently removed`);

    // Verify immutable audit log is preserved
    const auditLogs = await db.auditLogs.list(20);
    const purgeAudit = auditLogs.find(
      (log) => log.action === 'EMPLOYEE_PERMANENTLY_PURGED' && (log.resource_id === testEmpCode || log.resource_id === newEmp.id)
    );
    assert(!!purgeAudit, `Statutory audit log event EMPLOYEE_PERMANENTLY_PURGED is preserved`);

    // -------------------------------------------------------------
    // SCENARIO E: Deleted test employee no longer appears in Employee Directory
    // -------------------------------------------------------------
    console.log(`${BOLD}\n--- Scenario E: Directory verification post-purge ---${RESET}`);

    const postDirectory = await db.employees.list({ search: testEmpCode });
    const inPostDirectory = postDirectory.find((e) => e.id === newEmp.id);
    assert(!inPostDirectory, `Purged test employee no longer appears in Employee Directory`);

    // -------------------------------------------------------------
    // SCENARIO F: Another ACTIVE employee is completely unaffected
    // -------------------------------------------------------------
    console.log(`${BOLD}\n--- Scenario F: Unaffected ACTIVE employees verification ---${RESET}`);

    // Check another ACTIVE employee from the database
    const activeStaff = await db.employees.list({ status: 'ACTIVE' });
    const unaffectedEmp = activeStaff.find((e) => e.id !== newEmp.id && e.status === 'ACTIVE');
    assert(!!unaffectedEmp, `Other ACTIVE employee (${unaffectedEmp?.employee_id} - ${unaffectedEmp?.full_name}) exists and is completely intact`);
    if (unaffectedEmp) {
      assert(unaffectedEmp.status === 'ACTIVE', `Unaffected employee status remains ACTIVE`);
      const empDetails = await db.employees.getById(unaffectedEmp.id);
      assert(!!empDetails, `Unaffected employee profile details remain fully intact`);
    }

    // Protection check: create a protected employee and verify permanent purge is rejected
    const protectedEmp = await db.employees.create({
      employee_id: `PROT-${testRunId}`,
      full_name: `Protected Officer ${testRunId}`,
      email: `officer.${testRunId}@varsaka.com`,
      phone: '+91 99999 88888',
      address: 'Corporate Headquarters, Hyderabad',
      department_id: 'dep-exec',
      designation: 'Managing Director',
      joining_date: '2020-01-01',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      status: 'ACTIVE',
      is_system_protected: true
    });

    let protectedPurgeBlocked = false;
    try {
      await db.employees.permanentPurge(protectedEmp.id, 'admin-super-id', 'admin@varsaka.com');
    } catch (err: any) {
      protectedPurgeBlocked = err.message.includes('System-protected') || err.message.includes('SECURITY VIOLATION');
    }
    assert(protectedPurgeBlocked, `System-protected employee records cannot be permanently purged`);

    // Cleanup protected test employee
    if (protectedEmp) {
      const supabase = getSupabaseAdminClient();
      await supabase.from('employees').delete().eq('id', protectedEmp.id);
      await supabase.from('system_settings').delete().eq('key', `emp_meta_${protectedEmp.id}`);
    }

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

runLifecycleTests();
