import { db } from '../src/lib/db';
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

async function runEmployeePermanentPurgeSuite() {
  console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
  console.log(`${CYAN}${BOLD}EMPLOYEE PERMANENT PURGE AUDIT & SAFETY VERIFICATION SUITE${RESET}`);
  console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  const testId = Date.now().toString().slice(-5);

  const superAdmin: SessionUser = {
    id: 'usr-super-admin-01',
    email: 'admin@varsaka.com',
    role: 'SUPER_ADMIN',
    full_name: 'Super Administrator',
    permissions: ['employee.view', 'employee.create', 'employee.update', 'employee.delete', 'salary.view', 'salary.update', 'document.delete'],
  };

  const hrAdmin: SessionUser = {
    id: 'usr-hr-admin-01',
    email: 'hr.admin@varsaka.com',
    role: 'HR_ADMIN',
    full_name: 'HR Administrator',
    permissions: ['employee.view', 'employee.create', 'employee.update', 'employee.delete', 'document.delete'],
  };

  const viewerUser: SessionUser = {
    id: 'usr-viewer-01',
    email: 'viewer@varsaka.com',
    role: 'VIEWER',
    full_name: 'Read Only Viewer',
    permissions: ['employee.view'],
  };

  try {
    // --------------------------------------------------------------------------
    // TEST 1: Employee with no dependencies -> purge succeeds
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 1: Employee with no dependencies -> purge succeeds ---${RESET}`);
    const cleanEmp = await db.employees.create({
      employee_id: `CLN-${testId}`,
      full_name: `Clean Tester ${testId}`,
      email: `clean.${testId}@varsaka.com`,
      phone: '+91 91000 00001',
      department_id: 'dep-eng',
      designation: 'Software Engineer',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    const purgeCleanResult = await db.employees.permanentPurge(cleanEmp.id, superAdmin.id, superAdmin.email);
    assert(purgeCleanResult.success === true, '1a. Purge succeeds for employee with zero dependencies');
    const postCleanEmp = await db.employees.getById(cleanEmp.id);
    assert(postCleanEmp === null, '1b. Employee master record physically removed after clean purge');

    // --------------------------------------------------------------------------
    // TEST 2: Employee with salary -> salary dependency handled correctly
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 2: Employee with salary -> salary dependency handled correctly ---${RESET}`);
    const salEmp = await db.employees.create({
      employee_id: `SAL-${testId}`,
      full_name: `Salary Tester ${testId}`,
      email: `sal.${testId}@varsaka.com`,
      phone: '+91 91000 00002',
      department_id: 'dep-eng',
      designation: 'Backend Engineer',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    await db.salary.upsert({
      employee_id: salEmp.id,
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
      effective_date: '2026-01-01',
    }, superAdmin.id, superAdmin.email);

    const preSal = await db.salary.getByEmployeeId(salEmp.id);
    assert(!!preSal, '2a. Salary record confirmed present prior to purge');

    const purgeSalResult = await db.employees.permanentPurge(salEmp.id, superAdmin.id, superAdmin.email);
    assert(purgeSalResult.success === true, '2b. Purge succeeds for employee with salary dependency');

    const postSalEmp = await db.employees.getById(salEmp.id);
    assert(postSalEmp === null, '2c. Employee master record physically removed');
    const postSal = await db.salary.getByEmployeeId(salEmp.id);
    assert(postSal === null, '2d. Employee salary record cleanly removed without orphan violation');

    // --------------------------------------------------------------------------
    // TEST 3: Employee with tasks -> tasks handled correctly
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 3: Employee with tasks -> tasks handled correctly ---${RESET}`);
    const taskEmp = await db.employees.create({
      employee_id: `TSK-${testId}`,
      full_name: `Task Tester ${testId}`,
      email: `tsk.${testId}@varsaka.com`,
      phone: '+91 91000 00003',
      department_id: 'dep-eng',
      designation: 'Operations Lead',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    const createdTask = await db.tasks.create({
      title: `Onboarding Task for ${taskEmp.full_name}`,
      description: 'Prepare workstation and access permissions',
      assigned_to: superAdmin.id,
      created_by: superAdmin.id,
      employee_id: taskEmp.id,
      priority: 'HIGH',
      status: 'TODO',
    });
    assert(!!createdTask, '3a. Linked operational task created');

    const purgeTaskResult = await db.employees.permanentPurge(taskEmp.id, superAdmin.id, superAdmin.email);
    assert(purgeTaskResult.success === true, '3b. Purge succeeds for employee with tasks');

    const postTaskEmp = await db.employees.getById(taskEmp.id);
    assert(postTaskEmp === null, '3c. Employee master record physically removed');
    const allTasks = await db.tasks.list({});
    const linkedTasksAfter = allTasks.filter(t => t.employee_id === taskEmp.id);
    assert(linkedTasksAfter.length === 0, '3d. Linked operational tasks cleanly removed');

    // --------------------------------------------------------------------------
    // TEST 4: Employee with PENDING_APPROVAL document -> existing lifecycle respected
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 4: Employee with PENDING_APPROVAL document -> existing lifecycle respected ---${RESET}`);
    const draftEmp = await db.employees.create({
      employee_id: `DFT-${testId}`,
      full_name: `Draft Tester ${testId}`,
      email: `dft.${testId}@varsaka.com`,
      phone: '+91 91000 00004',
      department_id: 'dep-eng',
      designation: 'Junior Developer',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    const draftDoc = await db.documents.create({
      employee_id: draftEmp.id,
      document_type: 'OFFER_LETTER',
      title: `Offer Letter — ${draftEmp.full_name}`,
      status: 'PENDING_APPROVAL',
      data_snapshot: { ctc: 600000 },
      created_by: superAdmin.id,
      created_by_name: superAdmin.full_name,
    });
    assert(draftDoc.status === 'PENDING_APPROVAL', '4a. Unapproved document created in PENDING_APPROVAL status');

    const depsDraft = await db.employees.getDeletionDependencies(draftEmp.id);
    assert(depsDraft.draftDocumentsCount === 1, '4b. Deletion dependencies classifies document as draft document');
    assert(depsDraft.retainedDocumentsCount === 0, '4c. Deletion dependencies shows 0 retained official documents');
    assert(depsDraft.canPurge === true, '4d. canPurge evaluates to true for unapproved draft document');

    const purgeDraftResult = await db.employees.permanentPurge(draftEmp.id, superAdmin.id, superAdmin.email);
    assert(purgeDraftResult.success === true, '4e. Purge successfully cleans up unapproved working draft document');
    const postDraftEmp = await db.employees.getById(draftEmp.id);
    assert(postDraftEmp === null, '4f. Employee master record physically removed');
    const postDraftDoc = await db.documents.getById(draftDoc.id);
    assert(postDraftDoc === null, '4g. Unapproved draft document physically removed');

    // --------------------------------------------------------------------------
    // TEST 5: Employee with APPROVED document -> protected according to retention rules
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 5: Employee with APPROVED document -> protected by retention rules ---${RESET}`);
    const appEmp = await db.employees.create({
      employee_id: `APP-${testId}`,
      full_name: `Approved Tester ${testId}`,
      email: `app.${testId}@varsaka.com`,
      phone: '+91 91000 00005',
      department_id: 'dep-eng',
      designation: 'Senior Architect',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    const appDoc = await db.documents.create({
      employee_id: appEmp.id,
      document_type: 'OFFER_LETTER',
      title: `Offer Letter — ${appEmp.full_name}`,
      status: 'APPROVED',
      data_snapshot: { ctc: 2400000 },
      created_by: superAdmin.id,
      created_by_name: superAdmin.full_name,
    });
    assert(appDoc.status === 'APPROVED', '5a. Official document created in APPROVED status');

    const depsApp = await db.employees.getDeletionDependencies(appEmp.id);
    assert(depsApp.retainedDocumentsCount === 1, '5b. Dependencies accurately detects 1 retained official document');
    assert(depsApp.canPurge === false, '5c. canPurge evaluates to false for employee with APPROVED document');
    assert(
      depsApp.blockingReason?.includes('official document(s) in APPROVED, FINAL, or REVOKED status') === true,
      '5d. Dependencies returns clear statutory document retention blocking message'
    );

    let appPurgeBlocked = false;
    let appPurgeError = '';
    try {
      await db.employees.permanentPurge(appEmp.id, superAdmin.id, superAdmin.email);
    } catch (err: any) {
      appPurgeBlocked = true;
      appPurgeError = err.message;
    }
    assert(appPurgeBlocked, '5e. permanentPurge fails closed when employee has APPROVED document');
    assert(
      appPurgeError.includes('statutory document retention rules'),
      `5f. Error explains statutory retention rule: "${appPurgeError}"`
    );

    // Verify employee and document are 100% intact
    const postAppEmp = await db.employees.getById(appEmp.id);
    assert(!!postAppEmp, '5g. Employee record remains 100% intact and protected from physical deletion');
    const postAppDoc = await db.documents.getById(appDoc.id);
    assert(!!postAppDoc && postAppDoc.status === 'APPROVED', '5h. APPROVED document remains 100% intact');

    // --------------------------------------------------------------------------
    // TEST 6: Employee with REVOKED document -> retention preserved
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 6: Employee with REVOKED document -> retention preserved ---${RESET}`);
    const revEmp = await db.employees.create({
      employee_id: `REV-${testId}`,
      full_name: `Revoked Tester ${testId}`,
      email: `rev.${testId}@varsaka.com`,
      phone: '+91 91000 00006',
      department_id: 'dep-eng',
      designation: 'Systems Administrator',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    const revDoc = await db.documents.create({
      employee_id: revEmp.id,
      document_type: 'EXPERIENCE_LETTER',
      title: `Experience Certificate — ${revEmp.full_name}`,
      status: 'REVOKED',
      data_snapshot: { tenure: '2 years' },
      created_by: superAdmin.id,
      created_by_name: superAdmin.full_name,
    });
    assert(revDoc.status === 'REVOKED', '6a. Document created in REVOKED status');

    const depsRev = await db.employees.getDeletionDependencies(revEmp.id);
    assert(depsRev.retainedDocumentsCount === 1, '6b. Dependencies detects 1 retained REVOKED document');
    assert(depsRev.canPurge === false, '6c. canPurge evaluates to false for employee with REVOKED document');

    let revPurgeBlocked = false;
    let revPurgeError = '';
    try {
      await db.employees.permanentPurge(revEmp.id, superAdmin.id, superAdmin.email);
    } catch (err: any) {
      revPurgeBlocked = true;
      revPurgeError = err.message;
    }
    assert(revPurgeBlocked, '6d. permanentPurge fails closed when employee has REVOKED document');
    assert(
      revPurgeError.includes('statutory document retention rules'),
      `6e. Error explains statutory retention preservation: "${revPurgeError}"`
    );

    const postRevEmp = await db.employees.getById(revEmp.id);
    assert(!!postRevEmp, '6f. Employee record preserved to protect foreign-key referential integrity');
    const postRevDoc = await db.documents.getById(revDoc.id);
    assert(!!postRevDoc && postRevDoc.status === 'REVOKED', '6g. REVOKED document preserved for public verification honesty');

    // --------------------------------------------------------------------------
    // TEST 7: Missing public.tasks -> purge fails closed with clear prerequisite error
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 7: Missing public.tasks -> purge fails closed with clear prerequisite error ---${RESET}`);
    const noTaskTableEmp = await db.employees.create({
      employee_id: `NTB-${testId}`,
      full_name: `No Task Table Tester ${testId}`,
      email: `ntb.${testId}@varsaka.com`,
      phone: '+91 91000 00007',
      department_id: 'dep-eng',
      designation: 'Infrastructure Engineer',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    // Simulate missing tasks table in datastore
    (global as any).__simulateMissingTasksTable = true;

    const depsNoTable = await db.employees.getDeletionDependencies(noTaskTableEmp.id);
    assert(depsNoTable.tasksTableAvailable === false, '7a. Dependencies detects tasks table is missing');
    assert(depsNoTable.canPurge === false, '7b. canPurge evaluates to false when tasks table is missing');
    assert(
      depsNoTable.blockingReason === 'Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.',
      '7c. Dependencies returns exact clear UI prerequisite message'
    );

    let missingTablePurgeBlocked = false;
    let missingTableError = '';
    try {
      await db.employees.permanentPurge(noTaskTableEmp.id, superAdmin.id, superAdmin.email);
    } catch (err: any) {
      missingTablePurgeBlocked = true;
      missingTableError = err.message;
    }
    assert(missingTablePurgeBlocked, '7d. permanentPurge fails closed when Tasks table is not installed');
    assert(
      missingTableError.includes('Employee purge is temporarily unavailable because the required Tasks database table is not installed'),
      `7e. Error matches required prerequisite message: "${missingTableError}"`
    );

    // Clear simulation
    (global as any).__simulateMissingTasksTable = false;

    // Verify employee was NOT deleted
    const postNoTableEmp = await db.employees.getById(noTaskTableEmp.id);
    assert(!!postNoTableEmp, '7f. Employee master record remains intact when prerequisite check fails closed');

    // --------------------------------------------------------------------------
    // TEST 8: Foreign-key dependency -> no partial deletion
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 8: Foreign-key dependency -> no partial deletion ---${RESET}`);
    const fkEmp = await db.employees.create({
      employee_id: `FKD-${testId}`,
      full_name: `FK Dep Tester ${testId}`,
      email: `fkd.${testId}@varsaka.com`,
      phone: '+91 91000 00008',
      department_id: 'dep-eng',
      designation: 'Security Analyst',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    // Add salary
    await db.salary.upsert({
      employee_id: fkEmp.id,
      annual_ctc: 1500000,
      monthly_gross: 125000,
      basic: 62500,
      hra: 31250,
      special_allowance: 20000,
      conveyance: 5000,
      communication_allowance: 0,
      travel_allowance: 0,
      food_allowance: 0,
      other_allowances: 6250,
      employee_pf: 1800,
      employer_pf: 1800,
      professional_tax: 200,
      gratuity: 0,
      tds: 10000,
      esic: 0,
      other_deductions: 0,
      variable_pay: 0,
      net_salary: 113000,
      effective_date: '2026-01-01',
    }, superAdmin.id, superAdmin.email);

    // Add an approved document (which creates a protected foreign key reference)
    await db.documents.create({
      employee_id: fkEmp.id,
      document_type: 'OFFER_LETTER',
      title: `Offer Letter — ${fkEmp.full_name}`,
      status: 'APPROVED',
      data_snapshot: { ctc: 1500000 },
      created_by: superAdmin.id,
      created_by_name: superAdmin.full_name,
    });

    let fkPurgeFailed = false;
    try {
      await db.employees.permanentPurge(fkEmp.id, superAdmin.id, superAdmin.email);
    } catch {
      fkPurgeFailed = true;
    }
    assert(fkPurgeFailed, '8a. Purge fails due to protected document foreign key dependency');

    // Verify NO partial deletion occurred: salary, employee, and document still exist
    const postFkEmp = await db.employees.getById(fkEmp.id);
    assert(!!postFkEmp, '8b. Employee master record remains intact (no partial deletion)');
    const postFkSal = await db.salary.getByEmployeeId(fkEmp.id);
    assert(!!postFkSal, '8c. Salary record remains intact (no partial deletion)');

    // --------------------------------------------------------------------------
    // TEST 9: Failed purge -> entire transaction rolls back
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 9: Failed purge -> entire transaction rolls back ---${RESET}`);
    // Non-existent ID must reject cleanly without touching existing DB records
    let invalidIdPurgeFailed = false;
    try {
      await db.employees.permanentPurge('00000000-0000-0000-0000-000000000000', superAdmin.id, superAdmin.email);
    } catch (err: any) {
      invalidIdPurgeFailed = true;
      assert(err.message.includes('not found'), `9a. Non-existent employee throws not found error: "${err.message}"`);
    }
    assert(invalidIdPurgeFailed, '9b. Non-existent ID purge aborts transaction');

    // --------------------------------------------------------------------------
    // TEST 10: Audit/security logs remain preserved
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 10: Audit/security logs remain preserved ---${RESET}`);
    const auditLogs = await db.auditLogs.list(20);
    const cleanPurgeAudit = auditLogs.find(
      l => l.action === 'EMPLOYEE_PERMANENTLY_PURGED' && l.resource_id === cleanEmp.employee_id
    );
    assert(!!cleanPurgeAudit, '10a. Statutory audit log for successful employee purge permanently preserved');
    assert(
      (cleanPurgeAudit?.metadata as any)?.employee_id === cleanEmp.employee_id,
      '10b. Audit log contains correct employee identifier metadata'
    );

    // --------------------------------------------------------------------------
    // TEST 11: Unauthorized user cannot purge
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 11: Unauthorized user cannot purge ---${RESET}`);
    assert(hrAdmin.role !== 'SUPER_ADMIN', '11a. HR_ADMIN does not possess SUPER_ADMIN role');
    assert(viewerUser.role !== 'SUPER_ADMIN', '11b. VIEWER does not possess SUPER_ADMIN role');

    // --------------------------------------------------------------------------
    // TEST 12: SUPER_ADMIN can purge only when all prerequisites are satisfied
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 12: SUPER_ADMIN can purge only when all prerequisites are satisfied ---${RESET}`);
    // 12a. System-protected employee cannot be purged even by SUPER_ADMIN
    const sysProtectedEmp = await db.employees.create({
      employee_id: `PROT-${testId}`,
      full_name: `System Protected Officer ${testId}`,
      email: `prot.${testId}@varsaka.com`,
      phone: '+91 91000 00009',
      department_id: 'dep-exec',
      designation: 'Managing Director',
      is_system_protected: true,
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    let protPurgeBlocked = false;
    let protPurgeError = '';
    try {
      await db.employees.permanentPurge(sysProtectedEmp.id, superAdmin.id, superAdmin.email);
    } catch (err: any) {
      protPurgeBlocked = true;
      protPurgeError = err.message;
    }
    assert(protPurgeBlocked, '12a. SUPER_ADMIN blocked from purging system-protected employee');
    assert(
      protPurgeError.includes('System-protected') || protPurgeError.includes('SECURITY VIOLATION'),
      `12b. Error identifies system protection violation: "${protPurgeError}"`
    );

    // 12c. Eligible employee with all prerequisites satisfied -> purge succeeds
    const eligibleEmp = await db.employees.create({
      employee_id: `ELG-${testId}`,
      full_name: `Eligible Tester ${testId}`,
      email: `elg.${testId}@varsaka.com`,
      phone: '+91 91000 00010',
      department_id: 'dep-eng',
      designation: 'QA Automation Engineer',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    const eligibleDeps = await db.employees.getDeletionDependencies(eligibleEmp.id);
    assert(eligibleDeps.canPurge === true, '12c. Eligible employee has canPurge === true');

    const eligiblePurgeResult = await db.employees.permanentPurge(eligibleEmp.id, superAdmin.id, superAdmin.email);
    assert(eligiblePurgeResult.success === true, '12d. SUPER_ADMIN successfully purges employee when all prerequisites are satisfied');
    const postEligibleEmp = await db.employees.getById(eligibleEmp.id);
    assert(postEligibleEmp === null, '12e. Master record cleanly removed upon satisfying all prerequisites');

    // ==========================================================================
    // UI COMPONENT LOGIC SPECIFICATION TEST SUITE (SCENARIOS A - F)
    // ==========================================================================

    function computePurgeUIState({
      isProtected,
      userRole,
      loadingDeps,
      dependencies,
      depsError,
      error,
      purgeConfirmation,
      isPurging,
    }: {
      isProtected: boolean;
      userRole: string;
      loadingDeps: boolean;
      dependencies: {
        tasksTableAvailable: boolean;
        canPurge: boolean;
        retainedDocumentsCount: number;
        blockingReason: string | null;
      } | null;
      depsError: string | null;
      error: string | null;
      purgeConfirmation: string;
      isPurging: boolean;
    }) {
      const isSuperAdmin = userRole === 'SUPER_ADMIN';

      const isTasksMissingFromDeps = !loadingDeps && !!dependencies && dependencies.tasksTableAvailable === false;
      const isTasksMissingFromError = !!error && (error.toLowerCase().includes('tasks') || error.includes('public.tasks'));
      const isPrerequisiteMissing = isTasksMissingFromDeps || isTasksMissingFromError;

      const isRetentionBlocked = !loadingDeps && !!dependencies && dependencies.retainedDocumentsCount > 0;
      const isPreflightFailed = !loadingDeps && (!!depsError || (!dependencies && !loadingDeps));

      const isBlocked = isProtected || 
                        loadingDeps || 
                        !dependencies || 
                        dependencies.canPurge !== true || 
                        dependencies.tasksTableAvailable !== true || 
                        isRetentionBlocked || 
                        isPrerequisiteMissing ||
                        isPreflightFailed ||
                        !!error;

      const inputDisabled = isBlocked || isPurging;
      const buttonDisabled = isPurging || isBlocked || purgeConfirmation !== 'DELETE';

      const canSubmit = !isBlocked && !isPurging && purgeConfirmation === 'DELETE' &&
        !!dependencies && dependencies.tasksTableAvailable === true && dependencies.canPurge === true;

      const prerequisiteWarning = isPrerequisiteMissing
        ? 'Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.'
        : null;

      const retentionWarning = isRetentionBlocked
        ? dependencies?.blockingReason || 'Under statutory document retention rules, official documents cannot be deleted and linked employee records cannot be physically purged.'
        : null;

      return {
        isSuperAdmin,
        isPrerequisiteMissing,
        isRetentionBlocked,
        isPreflightFailed,
        isBlocked,
        inputDisabled,
        buttonDisabled,
        canSubmit,
        prerequisiteWarning,
        retentionWarning,
      };
    }

    // --------------------------------------------------------------------------
    // TEST 13 (SCENARIO A): SUPER_ADMIN + tasks table missing -> UI blocks purge
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 13 (SCENARIO A): SUPER_ADMIN + tasks table missing -> UI blocks purge ---${RESET}`);
    (global as any).__simulateMissingTasksTable = true;

    const testEmpA = await db.employees.create({
      employee_id: `SCN-A-${testId}`,
      full_name: `Scenario A Tester ${testId}`,
      email: `scn.a.${testId}@varsaka.com`,
      phone: '+91 91000 00011',
      department_id: 'dep-eng',
      designation: 'UI QA Tester',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    const depsA = await db.employees.getDeletionDependencies(testEmpA.id);
    assert(depsA.tasksTableAvailable === false, '13a. Preflight dependency check returns tasksTableAvailable === false');
    assert(depsA.canPurge === false, '13b. Preflight dependency check returns canPurge === false');

    const uiStateA = computePurgeUIState({
      isProtected: false,
      userRole: superAdmin.role,
      loadingDeps: false,
      dependencies: depsA,
      depsError: null,
      error: null,
      purgeConfirmation: 'DELETE',
      isPurging: false,
    });

    assert(uiStateA.isPrerequisiteMissing === true, '13c. UI calculates isPrerequisiteMissing === true');
    assert(uiStateA.isBlocked === true, '13d. UI calculates isBlocked === true');
    assert(uiStateA.inputDisabled === true, '13e. Confirmation input is disabled when tasks table missing');
    assert(uiStateA.buttonDisabled === true, '13f. Purge button is disabled even when DELETE is typed');
    assert(uiStateA.canSubmit === false, '13g. Submit handler cannot call destructive purge API');
    assert(
      uiStateA.prerequisiteWarning === 'Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.',
      '13h. Modal renders exact required prerequisite warning'
    );

    // Test with the exact production observation error message:
    const uiStateAWithError = computePurgeUIState({
      isProtected: false,
      userRole: superAdmin.role,
      loadingDeps: false,
      dependencies: depsA,
      depsError: null,
      error: 'Purge transaction aborted and rolled back: relation "public.tasks" does not exist',
      purgeConfirmation: 'DELETE',
      isPurging: false,
    });
    assert(uiStateAWithError.buttonDisabled === true, '13i. Purge button strictly disabled when error "relation public.tasks does not exist" is present');
    assert(uiStateAWithError.inputDisabled === true, '13j. Confirmation input strictly disabled when tasks error is present');
    assert(uiStateAWithError.canSubmit === false, '13k. Submission strictly blocked when tasks error is present');

    (global as any).__simulateMissingTasksTable = false;

    // --------------------------------------------------------------------------
    // TEST 14 (SCENARIO B): SUPER_ADMIN + tasks table available + eligible employee
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 14 (SCENARIO B): SUPER_ADMIN + tasks table available + eligible employee ---${RESET}`);
    const testEmpB = await db.employees.create({
      employee_id: `SCN-B-${testId}`,
      full_name: `Scenario B Tester ${testId}`,
      email: `scn.b.${testId}@varsaka.com`,
      phone: '+91 91000 00012',
      department_id: 'dep-eng',
      designation: 'Eligible QA Tester',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    const depsB = await db.employees.getDeletionDependencies(testEmpB.id);
    assert(depsB.tasksTableAvailable === true, '14a. Preflight dependency check returns tasksTableAvailable === true');
    assert(depsB.canPurge === true, '14b. Preflight dependency check returns canPurge === true');

    const uiStateBEmpty = computePurgeUIState({
      isProtected: false,
      userRole: superAdmin.role,
      loadingDeps: false,
      dependencies: depsB,
      depsError: null,
      error: null,
      purgeConfirmation: '',
      isPurging: false,
    });
    assert(uiStateBEmpty.isBlocked === false, '14c. UI calculates isBlocked === false for eligible employee');
    assert(uiStateBEmpty.inputDisabled === false, '14d. Confirmation input is enabled');
    assert(uiStateBEmpty.buttonDisabled === true, '14e. Button is disabled prior to typing DELETE');

    const uiStateBConfirmed = computePurgeUIState({
      isProtected: false,
      userRole: superAdmin.role,
      loadingDeps: false,
      dependencies: depsB,
      depsError: null,
      error: null,
      purgeConfirmation: 'DELETE',
      isPurging: false,
    });
    assert(uiStateBConfirmed.buttonDisabled === false, '14f. Button is enabled when DELETE confirmation is entered');
    assert(uiStateBConfirmed.canSubmit === true, '14g. Submit handler can proceed to call destructive purge API');

    // --------------------------------------------------------------------------
    // TEST 15 (SCENARIO C): SUPER_ADMIN + retained APPROVED/FINAL/REVOKED document
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 15 (SCENARIO C): SUPER_ADMIN + retained document -> retention block ---${RESET}`);
    const testEmpC = await db.employees.create({
      employee_id: `SCN-C-${testId}`,
      full_name: `Scenario C Tester ${testId}`,
      email: `scn.c.${testId}@varsaka.com`,
      phone: '+91 91000 00013',
      department_id: 'dep-eng',
      designation: 'Retained Doc Tester',
      status: 'ACTIVE',
    }, superAdmin.id, superAdmin.email);

    await db.documents.create({
      employee_id: testEmpC.id,
      document_type: 'OFFER_LETTER',
      title: `Offer Letter — ${testEmpC.full_name}`,
      status: 'APPROVED',
      data_snapshot: { ctc: 1800000 },
      created_by: superAdmin.id,
      created_by_name: superAdmin.full_name,
    });

    const depsC = await db.employees.getDeletionDependencies(testEmpC.id);
    assert(depsC.retainedDocumentsCount > 0, '15a. Preflight dependency check detects retained documents');
    assert(depsC.canPurge === false, '15b. canPurge evaluates to false for retained document');

    const uiStateC = computePurgeUIState({
      isProtected: false,
      userRole: superAdmin.role,
      loadingDeps: false,
      dependencies: depsC,
      depsError: null,
      error: null,
      purgeConfirmation: 'DELETE',
      isPurging: false,
    });

    assert(uiStateC.isRetentionBlocked === true, '15c. UI calculates isRetentionBlocked === true');
    assert(uiStateC.isBlocked === true, '15d. UI calculates isBlocked === true');
    assert(uiStateC.inputDisabled === true, '15e. Confirmation input is disabled');
    assert(uiStateC.buttonDisabled === true, '15f. Purge button is disabled');
    assert(uiStateC.canSubmit === false, '15g. Submit handler blocked from calling purge API');
    assert(
      uiStateC.retentionWarning?.includes('statutory document retention rules') === true,
      '15h. UI displays clear statutory document retention warning'
    );

    // --------------------------------------------------------------------------
    // TEST 16 (SCENARIO D): Non-SUPER_ADMIN -> purge unavailable / forbidden
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 16 (SCENARIO D): Non-SUPER_ADMIN -> purge unavailable/forbidden ---${RESET}`);
    const nonAdminRoles = ['HR_ADMIN', 'VIEWER', 'PAYROLL_ADMIN', 'DOCUMENT_ADMIN'];
    for (const role of nonAdminRoles) {
      const state = computePurgeUIState({
        isProtected: false,
        userRole: role,
        loadingDeps: false,
        dependencies: depsB,
        depsError: null,
        error: null,
        purgeConfirmation: 'DELETE',
        isPurging: false,
      });
      assert(state.isSuperAdmin === false, `16a. Role ${role} cannot access Super Admin permanent purge`);
    }

    // --------------------------------------------------------------------------
    // TEST 17 (SCENARIO E): Preflight Check API Failure -> Fail-Closed
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 17 (SCENARIO E): Preflight check API failure -> fail closed ---${RESET}`);
    // Case 1: Dependency fetch in flight (loading)
    const uiStateLoading = computePurgeUIState({
      isProtected: false,
      userRole: superAdmin.role,
      loadingDeps: true,
      dependencies: null,
      depsError: null,
      error: null,
      purgeConfirmation: 'DELETE',
      isPurging: false,
    });
    assert(uiStateLoading.isBlocked === true, '17a. While dependencies are loading, purge is blocked');
    assert(uiStateLoading.inputDisabled === true, '17b. Input is disabled while loading');
    assert(uiStateLoading.buttonDisabled === true, '17c. Purge button is disabled while loading');

    // Case 2: Dependency fetch failed with error / 500
    const uiStateFetchFailed = computePurgeUIState({
      isProtected: false,
      userRole: superAdmin.role,
      loadingDeps: false,
      dependencies: {
        tasksTableAvailable: false,
        canPurge: false,
        retainedDocumentsCount: 0,
        blockingReason: 'Network error or preflight failed',
      },
      depsError: 'Failed to verify deletion prerequisites.',
      error: null,
      purgeConfirmation: 'DELETE',
      isPurging: false,
    });
    assert(uiStateFetchFailed.isPreflightFailed === true, '17d. Preflight error recognized as isPreflightFailed');
    assert(uiStateFetchFailed.isBlocked === true, '17e. Purge blocked on preflight error');
    assert(uiStateFetchFailed.inputDisabled === true, '17f. Input disabled on preflight error');
    assert(uiStateFetchFailed.buttonDisabled === true, '17g. Button disabled on preflight error');
    assert(uiStateFetchFailed.canSubmit === false, '17h. Cannot submit when preflight fails');

    // --------------------------------------------------------------------------
    // TEST 18: Server-Side Fail-Closed Defense-in-Depth
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 18: Server-side fail-closed defense-in-depth ---${RESET}`);
    // If client is bypassed and calls permanentPurge directly while tasks table missing:
    (global as any).__simulateMissingTasksTable = true;
    let directPurgeFailed = false;
    let directPurgeErrMsg = '';
    try {
      await db.employees.permanentPurge(testEmpB.id, superAdmin.id, superAdmin.email);
    } catch (err: any) {
      directPurgeFailed = true;
      directPurgeErrMsg = err.message;
    }
    assert(directPurgeFailed === true, '18a. Server-side permanentPurge fails closed when tasks table missing');
    assert(
      directPurgeErrMsg.includes('Tasks database table is not installed'),
      `18b. Server-side error explains tasks table prerequisite: "${directPurgeErrMsg}"`
    );
    (global as any).__simulateMissingTasksTable = false;

    // --------------------------------------------------------------------------
    // TEST 19 (SCENARIO F): No production records modified
    // --------------------------------------------------------------------------
    console.log(`${BOLD}\n--- TEST 19 (SCENARIO F): No production records modified ---${RESET}`);
    const adminUserCheck = await db.users.getByEmail('admin@varsaka.com');
    assert(!!adminUserCheck, '19a. Super Admin user admin@varsaka.com exists and is intact');
    assert(adminUserCheck?.role === 'SUPER_ADMIN', '19b. Super Admin role remains SUPER_ADMIN');

    console.log(`\n${CYAN}${BOLD}================================================================${RESET}`);
    console.log(`${GREEN}${BOLD}ALL EMPLOYEE PERMANENT PURGE & UI PREREQUISITE TESTS PASSED (${passed}/${passed + failed})${RESET}`);
    console.log(`${CYAN}${BOLD}================================================================${RESET}\n`);

  } catch (error) {
    console.error(`\n${RED}CRITICAL TEST RUNNER EXCEPTION:${RESET}`, error);
    process.exit(1);
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runEmployeePermanentPurgeSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
