import fs from 'fs';
import path from 'path';

// Load .env.local for standalone test runner execution against live Supabase
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
import { hashPassword, verifyPassword, validatePasswordPolicy, generateSecureTemporaryPassword } from '../src/lib/password';
import { ROLE_PERMISSIONS, hasPermission } from '../src/lib/rbac';
import { SessionUser } from '../src/types/auth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${desc}`);
    failed++;
  }
}

async function runMasterHardeningSuite() {
  console.log('\n===============================================================');
  console.log('VARSAKA HR PORTAL — MASTER DATA, AUTH & DELETION HARDENING SUITE');
  console.log('===============================================================\n');

  // =========================================================================
  // TEST SUITE A: EMPLOYEE MASTER DATA & DELETION WORKFLOW
  // =========================================================================
  console.log('--- TEST SUITE A: EMPLOYEE MASTER DATA & LIFECYCLE ---');

  const testEmpSuffix = Date.now().toString(36).slice(-4).toUpperCase();
  const customEmpId = `VL-TST-${testEmpSuffix}`;

  // 1. Next ID generation
  const nextAutoId = await db.employees.generateNextEmployeeId();
  assert(Boolean(nextAutoId && (nextAutoId.startsWith('EMP-VL-') || nextAutoId.startsWith('VL '))), `Next auto Employee ID generated: ${nextAutoId}`);

  // 2. Create Employee with complete Sections A - E
  console.log('  Creating employee with complete Sections A to E master data...');
  const createdEmp = await db.employees.create({
    employee_id: customEmpId,
    full_name: `Vikram Malhotra ${testEmpSuffix}`,
    father_name: 'Suresh Malhotra',
    mother_name: 'Kavita Malhotra',
    date_of_birth: '1992-05-14',
    gender: 'Male',
    personal_email: `vikram.${testEmpSuffix}@personal.com`,
    email: `vikram.${testEmpSuffix}@varsaka.com`,
    phone: '+91 9876543210',
    alternate_phone: '+91 9123456780',
    address: 'Flat 402, Green Meadows, Madhapur, Hyderabad, Telangana',
    current_address: 'Flat 402, Green Meadows, Madhapur, Hyderabad, Telangana',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    pin_code: '500081',

    // Section B
    pan_number: 'ABCDE1234F',
    aadhaar_number: '123456789012',
    passport_number: 'Z1234567',
    uan: '100987654321',
    pf_number: 'PF-HYD-98765',
    esic_number: 'ESIC-HYD-1234',

    // Section C
    department_id: 'dept-eng',
    designation: 'Staff Security Engineer',
    employment_type: 'FULL_TIME',
    work_location: 'Hyderabad, India',
    reporting_manager: 'Super Administrator',
    joining_date: '2024-01-15',
    probation_period: '6 months',
    confirmation_date: '2024-07-15',
    notice_period: '60 days',
    status: 'ACTIVE',

    // Section D
    bank_name: 'HDFC Bank',
    bank_account_holder_name: `Vikram Malhotra ${testEmpSuffix}`,
    bank_account_number: '50100123456789',
    bank_ifsc: 'HDFC0001234',
    salary_structure: 'Standard Annual CTC',

    // Section E
    kyc_documents: {
      pan_doc: 'pan_vikram.pdf',
      aadhaar_doc: 'aadhaar_vikram.pdf',
    },
  }, 'test-admin-uuid', 'admin@varsaka.com');

  assert(Boolean(createdEmp && createdEmp.id), `Employee created with ID ${createdEmp.id} and code ${createdEmp.employee_id}`);
  assert(createdEmp.father_name === 'Suresh Malhotra', 'Section A father_name persisted');
  assert(createdEmp.pan_number === 'ABCDE1234F', 'Section B pan_number persisted');
  assert(createdEmp.bank_name === 'HDFC Bank', 'Section D bank_name persisted');
  assert(createdEmp.deletion_status === 'NONE', 'Initial deletion_status is NONE');

  // 3. Duplicate Employee ID rejection
  let duplicateRejected = false;
  try {
    await db.employees.create({
      employee_id: customEmpId, // Duplicate
      full_name: 'Duplicate Candidate',
      email: `other.${testEmpSuffix}@varsaka.com`,
      phone: '+91 9999999999',
      address: 'Address',
      department_id: 'dept-eng',
      designation: 'Engineer',
      joining_date: '2024-01-15',
      employment_type: 'FULL_TIME',
      work_location: 'Hyderabad',
      status: 'ACTIVE',
    });
  } catch (err: any) {
    if (err.message.includes('already exists')) duplicateRejected = true;
  }
  assert(duplicateRejected, 'Server-side duplicate Employee ID rejected');

  // 4. Controlled Employee ID edit with audit log
  const updatedEmpId = `VL-EDIT-${testEmpSuffix}`;
  console.log(`  Updating Employee ID from ${customEmpId} to ${updatedEmpId}...`);
  const updatedEmp = await db.employees.update(
    createdEmp.id,
    { employee_id: updatedEmpId, city: 'Cyberabad' },
    'test-admin-uuid',
    'admin@varsaka.com'
  );
  assert(updatedEmp.employee_id === updatedEmpId, `Employee ID successfully updated to ${updatedEmp.employee_id}`);
  assert(updatedEmp.city === 'Cyberabad', 'Profile city updated');

  // 5. Salary creation & retrieval for employee
  console.log('  Upserting salary master record...');
  const salaryRec = await db.salary.upsert({
    employee_id: createdEmp.id,
    annual_ctc: 1200000,
    monthly_gross: 100000,
    basic: 50000,
    hra: 25000,
    special_allowance: 15000,
    conveyance: 1600,
    communication_allowance: 2000,
    travel_allowance: 0,
    food_allowance: 0,
    other_allowances: 6400,
    employee_pf: 1800,
    employer_pf: 1800,
    professional_tax: 200,
    gratuity: 2404,
    tds: 5000,
    esic: 0,
    other_deductions: 0,
    variable_pay: 0,
    net_salary: 91000,
    effective_date: '2024-01-15',
  }, 'test-admin-uuid', 'admin@varsaka.com');
  assert(salaryRec.annual_ctc === 1200000, 'Salary record annual_ctc verified (1,200,000)');
  assert(salaryRec.special_allowance === 15000, 'Salary special_allowance verified (15,000)');

  // 6. Deletion Lifecycle: Request, Dependencies, Rejection, Approval
  console.log('  Testing Employee Deletion Workflow...');

  // Deletion dependencies
  const deps = await db.employees.getDeletionDependencies(createdEmp.id);
  assert(deps.salaryCount >= 1, `Deletion dependencies detected: ${deps.salaryCount} salary record`);

  // Request deletion
  const deletionReq = await db.employees.requestDeletion(
    createdEmp.id,
    'Employee resigned with notice served',
    'hr-admin-uuid',
    'hr@varsaka.com'
  );
  assert(deletionReq.deletion_status === 'DELETION_REQUESTED', 'Employee status transitioned to DELETION_REQUESTED');

  // Reject deletion
  const rejectedDel = await db.employees.rejectDeletion(
    createdEmp.id,
    'super-admin-uuid',
    'Handover pending from employee',
    'admin@varsaka.com'
  );
  assert(rejectedDel.deletion_status === 'NONE', 'Deletion rejection reverted status to NONE');

  // Request deletion again and approve
  await db.employees.requestDeletion(createdEmp.id, 'Resignation approved and clearances done', 'hr-admin-uuid', 'hr@varsaka.com');
  const approvedDel = await db.employees.approveDeletion(createdEmp.id, 'super-admin-uuid', 'admin@varsaka.com');
  assert(approvedDel.deletion_status === 'DELETED', 'Approved deletion transitioned to DELETED');
  assert(approvedDel.status === 'INACTIVE', 'Approved deletion set status to INACTIVE');

  // Protected Employee Deletion Guard (VL 1086)
  let protectedBlocked = false;
  try {
    const vl1086 = await db.employees.getById('VL 1086');
    if (vl1086) {
      await db.employees.requestDeletion(vl1086.id, 'Illegal deletion attempt', 'actor', 'actor@varsaka.com');
    }
  } catch (err: any) {
    if (err.message.includes('Protected production employee VL 1086 cannot be deleted')) {
      protectedBlocked = true;
    }
  }
  assert(protectedBlocked, 'Protected production employee VL 1086 is shielded from deletion');

  // =========================================================================
  // TEST SUITE B: SYSTEM USER AUTHENTICATION & TEMPORARY PASSWORDS
  // =========================================================================
  console.log('\n--- TEST SUITE B: SYSTEM USER & PASSWORD LIFECYCLE ---');

  const testUserEmail = `engineer.${testEmpSuffix}@varsaka.com`;

  // 1. Password policy checker
  const weakCheck = validatePasswordPolicy('weak');
  assert(!weakCheck.valid, 'Password policy correctly rejects weak password');
  const strongCheck = validatePasswordPolicy('Varsaka@Secured2026!');
  assert(strongCheck.valid, 'Password policy accepts compliant strong password');

  // 2. User Creation with secure temporary password
  console.log(`  Creating system user ${testUserEmail}...`);
  const createdUser = await db.users.create({
    full_name: `Engineer ${testEmpSuffix}`,
    email: testUserEmail,
    role: 'HR_ADMIN',
    department: 'Engineering & Technology',
    is_active: true,
  }, 'admin-uuid', 'admin@varsaka.com');

  assert(Boolean(createdUser.tempPassword), `Temporary password generated: ${createdUser.tempPassword}`);
  assert(createdUser.must_change_password === true, 'must_change_password flag is true');
  assert(Boolean(createdUser.temp_password_expires_at), `Temporary password expires at: ${createdUser.temp_password_expires_at}`);
  assert(createdUser.password_hash !== createdUser.tempPassword, 'Temporary password is NOT stored in plaintext');

  // 3. Verify temporary password hash matches
  const tempPassValid = await verifyPassword(createdUser.tempPassword!, createdUser.password_hash!);
  assert(tempPassValid, 'Temporary password matches bcrypt hash');

  // 4. Mandatory Password Change
  console.log('  Executing mandatory first-login password change...');
  const permanentPass = 'Permanent@Pass2026#';
  const changeRes = await db.users.changePassword(createdUser.id, createdUser.tempPassword!, permanentPass);
  assert(changeRes.success, 'Permanent password change succeeded');

  const refreshedUser = await db.users.getById(createdUser.id);
  assert(refreshedUser?.must_change_password === false, 'must_change_password is now false');
  assert(refreshedUser?.temp_password_expires_at === null, 'Temporary password expiry metadata cleared');

  const permanentValid = await verifyPassword(permanentPass, refreshedUser?.password_hash!);
  assert(permanentValid, 'New permanent password bcrypt hash verified');

  const oldTempInvalid = await verifyPassword(createdUser.tempPassword!, refreshedUser?.password_hash!);
  assert(!oldTempInvalid, 'Previous temporary password is fully invalidated');

  // 5. Admin Password Reset
  console.log('  Admin executing password reset on user...');
  const resetRes = await db.users.resetPassword(createdUser.id, 'admin-uuid', 'admin@varsaka.com');
  assert(resetRes.success, 'Admin password reset succeeded');
  assert(Boolean(resetRes.tempPassword), `New temporary password generated: ${resetRes.tempPassword}`);

  const userAfterReset = await db.users.getById(createdUser.id);
  assert(userAfterReset?.must_change_password === true, 'must_change_password re-engaged to true');
  assert(Boolean(userAfterReset?.temp_password_expires_at), 'New 24-hour expiry set on reset');

  // 6. Expired temporary password rejection
  console.log('  Testing expired temporary password rejection...');
  // Force expiry in the past
  const pastExpiry = new Date(Date.now() - 1000 * 60).toISOString(); // 1 min ago
  const metaKey = `user_meta_${createdUser.id}`;
  const meta = (await db.systemSettings.get<any>(metaKey)) || {};
  meta.temp_password_expires_at = pastExpiry;
  await db.systemSettings.set(metaKey, meta, 'Test expired metadata');

  // Also update user record in localDb if running in local mode
  try {
    const { localDb } = await import('../src/lib/storage/mock-db');
    const u = localDb.getState().users.find((x) => x.id === createdUser.id);
    if (u) u.temp_password_expires_at = pastExpiry;
  } catch {
    // Non-fatal
  }

  let expiredRejected = false;
  try {
    await db.users.changePassword(createdUser.id, resetRes.tempPassword, 'Another@Pass2026!');
  } catch (err: any) {
    if (err.message.includes('expired')) expiredRejected = true;
  }
  assert(expiredRejected, 'Expired temporary password correctly rejected');

  // =========================================================================
  // TEST SUITE C: DOCUMENT GENERATION & TITLE SANITIZATION
  // =========================================================================
  console.log('\n--- TEST SUITE C: DOCUMENTS & TITLE INTEGRITY ---');

  // Create an Experience Letter document
  const doc = await db.documents.create({
    document_type: 'EXPERIENCE_LETTER',
    employee_id: createdEmp.id,
    title: `Experience Letter — ${createdEmp.full_name}`,
    created_by: 'admin-uuid',
    created_by_name: 'Super Administrator',
    data_snapshot: {
      employeeName: createdEmp.full_name,
      designation: createdEmp.designation,
      joiningDate: createdEmp.joining_date,
    },
  });

  assert(Boolean(doc && doc.id), `Document created with number ${doc.document_number}`);
  assert(!doc.title.includes('undefined'), `Document title is clean: "${doc.title}"`);

  // Check document list for this employee
  const empDocs = await db.documents.list({ employeeId: createdEmp.id });
  assert(empDocs.length >= 1, `Document history has ${empDocs.length} record(s)`);
  const anyUndefined = empDocs.some((d) => d.title.includes('undefined undefined'));
  assert(!anyUndefined, 'Zero "undefined undefined" documents in history');

  // =========================================================================
  // TEST SUITE D: SECURITY & RBAC CONSTRAINTS
  // =========================================================================
  console.log('\n--- TEST SUITE D: SECURITY & RBAC CONSTRAINTS ---');

  // 1. HR_ADMIN should NOT have employee.delete permission
  const hrPermissions = ROLE_PERMISSIONS['HR_ADMIN'];
  assert(!hrPermissions.includes('employee.delete'), 'HR_ADMIN does NOT possess employee.delete permission');

  // 2. SUPER_ADMIN possesses employee.delete
  const superAdminPermissions = ROLE_PERMISSIONS['SUPER_ADMIN'];
  assert(superAdminPermissions.includes('employee.delete'), 'SUPER_ADMIN possesses employee.delete permission');

  // 3. VIEWER has neither employee.create nor salary.manage
  const viewerPermissions = ROLE_PERMISSIONS['VIEWER'];
  assert(!viewerPermissions.includes('employee.create'), 'VIEWER cannot create employees');
  assert(!viewerPermissions.includes('salary.manage'), 'VIEWER cannot manage payroll');

  // 4. Verify Audit Logs recorded
  const recentLogs = await db.auditLogs.list(50);
  const hasEmpCreated = recentLogs.some((l) => l.action === 'EMPLOYEE_CREATED');
  const hasEmpIdChanged = recentLogs.some((l) => l.action === 'EMPLOYEE_ID_CHANGED');
  const hasDelRequested = recentLogs.some((l) => l.action === 'EMPLOYEE_DELETION_REQUESTED');
  const hasDelApproved = recentLogs.some((l) => l.action === 'EMPLOYEE_DELETION_APPROVED');
  const hasUserCreated = recentLogs.some((l) => l.action === 'USER_CREATED');
  const hasPasswordChanged = recentLogs.some((l) => l.action === 'USER_PASSWORD_CHANGED');
  const hasPasswordReset = recentLogs.some((l) => l.action === 'USER_PASSWORD_RESET_BY_ADMIN');

  assert(hasEmpCreated, 'Audit log recorded EMPLOYEE_CREATED');
  assert(hasEmpIdChanged, 'Audit log recorded EMPLOYEE_ID_CHANGED');
  assert(hasDelRequested, 'Audit log recorded EMPLOYEE_DELETION_REQUESTED');
  assert(hasDelApproved, 'Audit log recorded EMPLOYEE_DELETION_APPROVED');
  assert(hasUserCreated, 'Audit log recorded USER_CREATED');
  assert(hasPasswordChanged, 'Audit log recorded USER_PASSWORD_CHANGED');
  assert(hasPasswordReset, 'Audit log recorded USER_PASSWORD_RESET_BY_ADMIN');

  console.log('\n===============================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runMasterHardeningSuite().catch((err) => {
  console.error('Test suite failed with unexpected error:', err);
  process.exit(1);
});
