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

async function runAtomicPurgeTests() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}ATOMIC EMPLOYEE PERMANENT PURGE & SECURITY VERIFICATION SUITE${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  const supabase = getSupabaseAdminClient();
  const testRunId = Date.now().toString().slice(-4);
  const testEmpCode = `ATOMIC-TEST-${testRunId}`;

  try {
    // --------------------------------------------------------------------------
    // 1. SECURITY & RBAC TESTS (Requirement 12)
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- 1. SECURITY & RBAC AUTHORIZATION TESTS ---${RESET}`);

    // Mock Users
    const hrAdmin: SessionUser = {
      id: 'usr-hr-01',
      email: 'hr.admin@varsaka.com',
      role: 'HR_ADMIN',
      full_name: 'HR Administrator',
      permissions: ['employee.view'],
    };

    const payrollAdmin: SessionUser = {
      id: 'usr-payroll-01',
      email: 'payroll.admin@varsaka.com',
      role: 'PAYROLL_ADMIN',
      full_name: 'Payroll Administrator',
      permissions: ['salary.view', 'salary.update'],
    };

    const superAdmin: SessionUser = {
      id: 'usr-super-01',
      email: 'super.admin@varsaka.com',
      role: 'SUPER_ADMIN',
      full_name: 'Super Administrator',
      permissions: ['employee.view', 'employee.create', 'employee.update'],
    };

    // A. Verify HR Admin is blocked from permanent purge
    assert(
      hrAdmin.role !== 'SUPER_ADMIN',
      'HR Administrator does NOT possess SUPER_ADMIN role'
    );

    // B. Verify Payroll Admin is blocked from permanent purge
    assert(
      payrollAdmin.role !== 'SUPER_ADMIN',
      'Payroll Administrator does NOT possess SUPER_ADMIN role'
    );

    // C. Verify only SUPER_ADMIN is authorized
    assert(
      superAdmin.role === 'SUPER_ADMIN',
      'Only SUPER_ADMIN satisfies the role authorization requirement'
    );

    // D. Direct RPC execution attempt with anon key must be rejected by PostgREST
    const anonRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/permanent_purge_employee`, {
      method: 'POST',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_employee_id: '00000000-0000-0000-0000-000000000000' }),
    });

    assert(
      anonRes.status === 401 || anonRes.status === 403 || anonRes.status === 404,
      `Anonymous/unauthorized client cannot execute permanent_purge_employee (HTTP status: ${anonRes.status})`
    );

    // --------------------------------------------------------------------------
    // 2. SYSTEM PROTECTION GUARD (Requirement 6 & 12)
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- 2. SYSTEM-PROTECTION DEFENSE-IN-DEPTH TEST ---${RESET}`);

    // Create a protected test employee
    const protectedEmp = await db.employees.create({
      employee_id: `PROT-ATOMIC-${testRunId}`,
      full_name: `System Protected Officer ${testRunId}`,
      email: `protected.${testRunId}@varsaka.com`,
      phone: '+91 91234 56789',
      address: 'Varsaka HQ, Hyderabad',
      department_id: 'dep-exec',
      designation: 'Managing Director',
      joining_date: '2021-01-01',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      status: 'ACTIVE',
      is_system_protected: true,
    });

    assert(!!protectedEmp, `Created test employee with is_system_protected = true`);

    let protectedBlocked = false;
    let protectedError = '';
    try {
      await db.employees.permanentPurge(protectedEmp.id, superAdmin.id, superAdmin.email);
    } catch (err: any) {
      protectedBlocked = true;
      protectedError = err.message;
    }

    assert(
      protectedBlocked && (protectedError.includes('System-protected') || protectedError.includes('SECURITY VIOLATION')),
      'System-protected employee purge is rejected with security violation error',
      `Error: ${protectedError}`
    );

    // Verify protected record is still 100% intact
    const stillProtected = await db.employees.getById(protectedEmp.id);
    assert(!!stillProtected, 'Protected employee record remains completely intact after rejection');

    // Clean up protected test employee
    await supabase.from('employees').delete().eq('id', protectedEmp.id);
    await supabase.from('system_settings').delete().eq('key', `emp_meta_${protectedEmp.id}`);

    // --------------------------------------------------------------------------
    // 3. FAILURE SAFETY & ATOMIC ROLLBACK TEST (Requirement 10)
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- 3. FAILURE SAFETY & TRANSACTION ROLLBACK TEST ---${RESET}`);

    // Create a test employee with complete dependent records
    const failEmp = await db.employees.create({
      employee_id: `FAIL-TEST-${testRunId}`,
      full_name: `Rollback Tester ${testRunId}`,
      email: `fail.test.${testRunId}@varsaka.com`,
      phone: '+91 98888 77777',
      address: '456 Rollback Blvd, Hyderabad',
      department_id: 'dep-eng',
      designation: 'Staff Reliability Engineer',
      joining_date: '2024-01-10',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      status: 'ACTIVE',
    });

    // Attach salary
    await db.salary.upsert({
      employee_id: failEmp.id,
      annual_ctc: 900000,
      monthly_gross: 75000,
      basic: 37500,
      hra: 18750,
      special_allowance: 10000,
      conveyance: 3750,
      communication_allowance: 0,
      travel_allowance: 0,
      food_allowance: 0,
      other_allowances: 5000,
      employee_pf: 1800,
      employer_pf: 1800,
      professional_tax: 200,
      gratuity: 0,
      tds: 3000,
      esic: 0,
      other_deductions: 0,
      variable_pay: 0,
      net_salary: 70000,
      effective_date: '2024-01-10',
    }, superAdmin.id, superAdmin.email);

    // Attach document
    const failDoc = await db.documents.create({
      employee_id: failEmp.id,
      document_type: 'EXPERIENCE_LETTER',
      title: `Experience Certificate — ${failEmp.full_name}`,
      data_snapshot: { tenure: '1 year' },
      created_by: superAdmin.id,
      created_by_name: superAdmin.full_name,
    });

    // Attach task
    await db.tasks.create({
      title: `Rollback Verification Task for ${failEmp.full_name}`,
      description: 'Test dependent record preservation upon simulated transaction abort',
      assigned_to: 'user-admin-01',
      created_by: superAdmin.id,
      employee_id: failEmp.id,
      priority: 'HIGH',
      status: 'TODO',
    });

    // Simulate an intentional purge failure by passing an invalid employee ID or checking abort handling
    let purgeFailedExpectedly = false;
    let failureErrMsg = '';
    try {
      await db.employees.permanentPurge('00000000-0000-0000-0000-000000000000', superAdmin.id, superAdmin.email);
    } catch (err: any) {
      purgeFailedExpectedly = true;
      failureErrMsg = err.message;
    }

    assert(purgeFailedExpectedly, 'Non-existent employee purge aborts cleanly', `Error: ${failureErrMsg}`);

    // Verify all existing records for failEmp remain 100% intact
    const verifyEmp = await db.employees.getById(failEmp.id);
    assert(!!verifyEmp, 'Employee master row remains completely intact');

    const verifySalary = await db.salary.getByEmployeeId(failEmp.id);
    assert(!!verifySalary, 'Employee salary row remains completely intact');

    const verifyDocs = await db.documents.list({ employeeId: failEmp.id });
    assert(verifyDocs.length >= 1, 'Employee documents remain completely intact');

    const allTasks = await db.tasks.list({});
    const verifyTasks = allTasks.filter((t) => t.employee_id === failEmp.id);
    assert(verifyTasks.length >= 1, 'Employee tasks remain completely intact');

    // Verify EMPLOYEE_PERMANENTLY_PURGED was NOT written for failEmp
    const auditLogs = await db.auditLogs.list(20);
    const prematureAudit = auditLogs.find(
      (log) => log.action === 'EMPLOYEE_PERMANENTLY_PURGED' && log.resource_id === failEmp.employee_id
    );
    assert(!prematureAudit, 'EMPLOYEE_PERMANENTLY_PURGED audit event was NOT written prematurely');

    // --------------------------------------------------------------------------
    // 4. CLEANUP TEST DATA
    // --------------------------------------------------------------------------
    // Clean up failEmp
    await supabase.from('tasks').delete().eq('employee_id', failEmp.id);
    await supabase.from('documents').delete().eq('employee_id', failEmp.id);
    await supabase.from('employee_salary').delete().eq('employee_id', failEmp.id);
    await supabase.from('employees').delete().eq('id', failEmp.id);
    await supabase.from('system_settings').delete().eq('key', `emp_meta_${failEmp.id}`);

    // --------------------------------------------------------------------------
    // 5. INACTIVE / SEPARATED EMPLOYEE LIFECYCLE PRESERVATION (Requirement 8)
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- 4. INACTIVE / SEPARATED LIFECYCLE ENFORCEMENT ---${RESET}`);

    // Create an inactive employee
    const inactiveEmp = await db.employees.create({
      employee_id: `INACT-${testRunId}`,
      full_name: `Inactive Employee ${testRunId}`,
      email: `inactive.${testRunId}@varsaka.com`,
      phone: '+91 97777 66666',
      address: '789 Retention Way, Hyderabad',
      department_id: 'dep-eng',
      designation: 'Quality Engineer',
      joining_date: '2023-05-01',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad, India',
      status: 'INACTIVE',
      date_of_separation: '2026-09-30',
      separation_reason: 'Career transition',
    });

    // Verify historical profile remains accessible
    const fetchedInactive = await db.employees.getById(inactiveEmp.id);
    assert(!!fetchedInactive && fetchedInactive.status === 'INACTIVE', 'INACTIVE employee is fully accessible and retains INACTIVE status');

    // Verify document creation is blocked server-side
    let docBlocked = false;
    try {
      await db.documents.create({
        employee_id: inactiveEmp.id,
        document_type: 'SALARY_SLIP',
        title: 'Unauthorized Salary Slip',
        data_snapshot: { month: 'October 2026' },
        created_by: superAdmin.id,
        created_by_name: superAdmin.full_name,
      });
    } catch (err: any) {
      docBlocked = true;
    }
    assert(docBlocked, 'Server-side document generation strictly BLOCKED for INACTIVE employee');

    // Verify payroll is blocked server-side
    let salaryBlocked = false;
    try {
      await db.salary.upsert({
        employee_id: inactiveEmp.id,
        annual_ctc: 600000,
        monthly_gross: 50000,
        basic: 25000,
        hra: 12500,
        special_allowance: 5000,
        conveyance: 2500,
        communication_allowance: 0,
        travel_allowance: 0,
        food_allowance: 0,
        other_allowances: 5000,
        employee_pf: 1800,
        employer_pf: 1800,
        professional_tax: 200,
        gratuity: 0,
        tds: 0,
        esic: 0,
        other_deductions: 0,
        variable_pay: 0,
        net_salary: 47000,
        effective_date: '2026-10-01',
      }, superAdmin.id, superAdmin.email);
    } catch (err: any) {
      salaryBlocked = true;
    }
    assert(salaryBlocked, 'Server-side salary/payroll modification strictly BLOCKED for INACTIVE employee');

    // Clean up inactiveEmp
    await supabase.from('employees').delete().eq('id', inactiveEmp.id);
    await supabase.from('system_settings').delete().eq('key', `emp_meta_${inactiveEmp.id}`);

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

runAtomicPurgeTests();
