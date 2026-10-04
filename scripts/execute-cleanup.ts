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

const PROTECTED_ADMIN_EMAIL = 'admin@in.varsaka.com';

async function executeCleanup() {
  const supabase = getSupabaseAdminClient();

  console.log('================================================================');
  console.log('VARSAKA HR PORTAL — MASTER DATA CLEANUP EXECUTION');
  console.log('PROTECTED ADMINISTRATIVE ACCOUNT:', PROTECTED_ADMIN_EMAIL);
  console.log('================================================================\n');

  // STEP 1: Verify and lock down the protected admin account
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    throw new Error(`Failed to list auth users: ${authErr.message}`);
  }
  const authUsers = authData?.users || [];
  const protectedAuthUser = authUsers.find(
    (u) => u.email?.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase()
  );

  if (!protectedAuthUser) {
    throw new Error(`CRITICAL ABORT: Protected admin ${PROTECTED_ADMIN_EMAIL} was NOT found in auth.users! Aborting cleanup immediately.`);
  }

  const { data: appUsers, error: appErr } = await supabase.from('users').select('*');
  if (appErr) {
    throw new Error(`Failed to list public.users: ${appErr.message}`);
  }
  const protectedAppUser = (appUsers || []).find(
    (u) => u.email?.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase()
  );

  if (!protectedAppUser) {
    throw new Error(`CRITICAL ABORT: Protected admin ${PROTECTED_ADMIN_EMAIL} was NOT found in public.users! Aborting cleanup immediately.`);
  }

  console.log('✅ CONFIRMED PROTECTED ADMIN ACCOUNT:');
  console.log(`   - Email: ${protectedAppUser.email}`);
  console.log(`   - Public User ID: ${protectedAppUser.id}`);
  console.log(`   - Auth User ID:   ${protectedAuthUser.id}`);
  console.log(`   - Active Status:  ${protectedAppUser.is_active}`);

  // Check initial sequence values to ensure we can assert they are NOT altered
  const { data: initSequences } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['numbering_sequences', 'employee_sequence_counter']);
  console.log('\n🔒 CURRENT SEQUENCES (WILL BE PRESERVED WITHOUT MODIFICATION):');
  initSequences?.forEach((s) => console.log(`   - ${s.key}:`, JSON.stringify(s.value)));

  // STEP 2: Gather records to delete, strictly excluding protected admin
  const nonAdminAppUsers = (appUsers || []).filter(
    (u) => u.email?.trim().toLowerCase() !== PROTECTED_ADMIN_EMAIL.toLowerCase()
  );
  const nonAdminAppUserIds = nonAdminAppUsers.map((u) => u.id);

  const nonAdminAuthUsers = authUsers.filter(
    (u) => u.email?.trim().toLowerCase() !== PROTECTED_ADMIN_EMAIL.toLowerCase()
  );
  const nonAdminAuthUserIds = nonAdminAuthUsers.map((u) => u.id);

  const { data: employees } = await supabase.from('employees').select('id, employee_id, full_name, email');
  const employeesToDelete = (employees || []).filter(
    (e) => e.email?.trim().toLowerCase() !== PROTECTED_ADMIN_EMAIL.toLowerCase()
  );
  const employeeIdsToDelete = employeesToDelete.map((e) => e.id);

  console.log(`\n📋 AUDIT TARGETS TO CLEAN:`);
  console.log(`   - Public users to delete: ${nonAdminAppUserIds.length}`);
  console.log(`   - Auth users to delete:   ${nonAdminAuthUserIds.length}`);
  console.log(`   - Employees to delete:    ${employeeIdsToDelete.length}`);

  // STEP 3: Clean Approvals
  console.log('\n--- Step 3: Deleting Document Approvals ---');
  const { data: approvals, error: aprErr } = await supabase.from('approvals').select('id');
  if (!aprErr && approvals && approvals.length > 0) {
    const { error: delAprErr } = await supabase.from('approvals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delAprErr) console.warn('Warning deleting approvals:', delAprErr.message);
    else console.log(`Deleted ${approvals.length} approvals.`);
  } else {
    console.log('No approvals to delete.');
  }

  // STEP 4: Clean Document Versions
  console.log('\n--- Step 4: Deleting Document Versions ---');
  const { data: docVersions, error: dvErr } = await supabase.from('document_versions').select('id');
  if (!dvErr && docVersions && docVersions.length > 0) {
    const { error: delDvErr } = await supabase.from('document_versions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delDvErr) console.warn('Warning deleting document_versions:', delDvErr.message);
    else console.log(`Deleted ${docVersions.length} document versions.`);
  } else {
    console.log('No document versions to delete.');
  }

  // STEP 5: Unlink Verification Logs
  console.log('\n--- Step 5: Unlinking Verification Logs ---');
  const { error: unhookVlErr } = await supabase
    .from('verification_logs')
    .update({ document_id: null })
    .not('document_id', 'is', null);
  if (unhookVlErr) {
    console.warn('Warning unlinking verification_logs:', unhookVlErr.message);
  } else {
    console.log('Unlinked verification logs from test documents.');
  }

  // STEP 6: Delete Documents
  console.log('\n--- Step 6: Deleting Documents ---');
  const { data: documents } = await supabase.from('documents').select('id, document_number, employee_id');
  if (documents && documents.length > 0) {
    const { error: delDocsErr } = await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delDocsErr) {
      console.warn('Warning deleting documents:', delDocsErr.message);
    } else {
      console.log(`Deleted ${documents.length} test documents.`);
    }
  } else {
    console.log('No documents to delete.');
  }

  // STEP 7: Delete Employee Salaries
  console.log('\n--- Step 7: Deleting Employee Salaries ---');
  const { data: salaries } = await supabase.from('employee_salary').select('id, employee_id');
  if (salaries && salaries.length > 0) {
    const { error: delSalErr } = await supabase.from('employee_salary').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delSalErr) {
      console.warn('Warning deleting employee_salary:', delSalErr.message);
    } else {
      console.log(`Deleted ${salaries.length} employee salary records.`);
    }
  } else {
    console.log('No salary records to delete.');
  }

  // STEP 8: Delete Tasks (native table if exists)
  console.log('\n--- Step 8: Deleting Operational / Test Tasks ---');
  const { error: tErr } = await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (tErr && tErr.code !== 'PGRST205') {
    console.warn('Warning deleting native tasks:', tErr.message);
  }

  // Also clean tasks_store in system_settings
  const { data: taskStoreRecord } = await supabase.from('system_settings').select('*').eq('key', 'tasks_store').maybeSingle();
  if (taskStoreRecord && Array.isArray(taskStoreRecord.value)) {
    // Retain only tasks created by protected admin that are not attached to deleted employees
    const remainingTasks = taskStoreRecord.value.filter((t: any) => {
      if (t.employee_id && employeeIdsToDelete.includes(t.employee_id)) return false;
      if (t.created_by && nonAdminAppUserIds.includes(t.created_by)) return false;
      return true;
    });
    await supabase.from('system_settings').update({ value: remainingTasks, updated_at: new Date().toISOString() }).eq('key', 'tasks_store');
    console.log(`Updated tasks_store in system_settings: ${taskStoreRecord.value.length} -> ${remainingTasks.length} tasks.`);
  }

  // STEP 9: Delete Employees
  console.log('\n--- Step 9: Deleting Employees ---');
  if (employeeIdsToDelete.length > 0) {
    const { error: delEmpErr } = await supabase
      .from('employees')
      .delete()
      .in('id', employeeIdsToDelete);
    if (delEmpErr) {
      console.warn('Warning deleting employees:', delEmpErr.message);
    } else {
      console.log(`Deleted ${employeeIdsToDelete.length} employee records.`);
    }
  } else {
    console.log('No employees to delete.');
  }

  // STEP 10: Clean Permission Overrides & Certificate Access Requests in system_settings
  console.log('\n--- Step 10: Cleaning Permission Overrides & Certificate Access Requests ---');
  const { data: certReqRecord } = await supabase.from('system_settings').select('*').eq('key', 'certificate_access_requests').maybeSingle();
  if (certReqRecord && Array.isArray(certReqRecord.value)) {
    const remainingCertRequests = certReqRecord.value.filter(
      (r: any) => r.user_email?.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase() ||
                  r.user_id === protectedAppUser.id
    );
    await supabase.from('system_settings').update({ value: remainingCertRequests, updated_at: new Date().toISOString() }).eq('key', 'certificate_access_requests');
    console.log(`Cleaned certificate_access_requests: ${certReqRecord.value.length} -> ${remainingCertRequests.length} requests.`);
  }

  // Delete non-admin user_perm_overrides_* keys from system_settings
  const { data: allSettings } = await supabase.from('system_settings').select('key');
  const settingsKeysToDelete = (allSettings || []).filter((s) => {
    if (s.key.startsWith('emp_meta_')) return true;
    if (s.key.startsWith('sal_meta_')) return true;
    if (s.key.startsWith('user_perm_overrides_')) {
      const uid = s.key.replace('user_perm_overrides_', '');
      return uid !== protectedAppUser.id;
    }
    if (s.key.startsWith('user_meta_')) {
      const uid = s.key.replace('user_meta_', '');
      return uid !== protectedAppUser.id;
    }
    return false;
  }).map((s) => s.key);

  if (settingsKeysToDelete.length > 0) {
    const { error: delSetErr } = await supabase.from('system_settings').delete().in('key', settingsKeysToDelete);
    if (delSetErr) console.warn('Warning deleting metadata settings:', delSetErr.message);
    else console.log(`Deleted ${settingsKeysToDelete.length} stale metadata entries from system_settings.`);
  }

  // STEP 11: Clean User Credentials for non-admin users
  console.log('\n--- Step 11: Cleaning User Credentials ---');
  const { error: delCredErr } = await supabase
    .from('user_credentials')
    .delete()
    .neq('user_id', protectedAppUser.id);
  if (delCredErr) console.warn('Warning deleting user_credentials:', delCredErr.message);
  else console.log('Cleaned non-admin user credentials.');

  // STEP 12: Clean User Roles for non-admin users
  console.log('\n--- Step 12: Cleaning User Roles ---');
  const { error: delRolesErr } = await supabase
    .from('user_roles')
    .delete()
    .neq('user_id', protectedAppUser.id);
  if (delRolesErr) console.warn('Warning deleting user_roles:', delRolesErr.message);
  else console.log('Cleaned non-admin user roles.');

  // STEP 13: Delete Public Users (Strictly non-admin)
  console.log('\n--- Step 13: Deleting Non-Admin Public Users ---');
  if (nonAdminAppUserIds.length > 0) {
    const { error: delAppUsrErr } = await supabase
      .from('users')
      .delete()
      .in('id', nonAdminAppUserIds);
    if (delAppUsrErr) {
      console.warn('Warning deleting non-admin public users:', delAppUsrErr.message);
    } else {
      console.log(`Deleted ${nonAdminAppUserIds.length} non-admin public users.`);
    }
  }

  // STEP 14: Delete Auth Users (Strictly non-admin)
  console.log('\n--- Step 14: Deleting Non-Admin Auth Users ---');
  let authDeleted = 0;
  for (const authUser of nonAdminAuthUsers) {
    if (authUser.email?.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase()) {
      console.error(`CRITICAL SAFETY CHECK: Skipping delete on ${authUser.email}`);
      continue;
    }
    const { error: delAuthErr } = await supabase.auth.admin.deleteUser(authUser.id);
    if (delAuthErr) {
      console.warn(`Could not delete auth user ${authUser.email} (${authUser.id}):`, delAuthErr.message);
    } else {
      authDeleted++;
    }
  }
  console.log(`Successfully deleted ${authDeleted} of ${nonAdminAuthUsers.length} non-admin auth users.`);

  // STEP 15: Clean Local JSON Store (.system_data/db_store.json) for consistency
  console.log('\n--- Step 15: Syncing Local Datastore State ---');
  const localStorePath = path.resolve(process.cwd(), '.system_data/db_store.json');
  if (fs.existsSync(localStorePath)) {
    try {
      const localStore = JSON.parse(fs.readFileSync(localStorePath, 'utf-8'));
      // Keep only admin in users
      localStore.users = (localStore.users || []).filter(
        (u: any) => u.email?.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase()
      );
      // Keep only admin in credentials
      localStore.user_credentials = (localStore.user_credentials || []).filter(
        (c: any) => c.user_id === protectedAppUser.id || c.user_id === localStore.users[0]?.id
      );
      localStore.employees = [];
      localStore.employee_salary = [];
      localStore.documents = [];
      localStore.tasks = [];
      fs.writeFileSync(localStorePath, JSON.stringify(localStore, null, 2), 'utf-8');
      console.log('Synchronized .system_data/db_store.json with clean master state.');
    } catch (e: any) {
      console.warn('Could not update .system_data/db_store.json:', e.message);
    }
  }

  // STEP 16: FINAL POST-CLEANUP INTEGRITY AUDIT
  console.log('\n================================================================');
  console.log('POST-CLEANUP VERIFICATION AUDIT');
  console.log('================================================================');

  // 1. Verify Auth Users
  const { data: finalAuthData } = await supabase.auth.admin.listUsers();
  const finalAuthUsers = finalAuthData?.users || [];
  console.log(`1. Auth Users: Total ${finalAuthUsers.length}`);
  finalAuthUsers.forEach((u) => console.log(`   - ${u.email} (ID: ${u.id})`));

  // 2. Verify Public Users
  const { data: finalAppUsers } = await supabase.from('users').select('*');
  console.log(`2. Public Users: Total ${finalAppUsers?.length}`);
  finalAppUsers?.forEach((u) => console.log(`   - ${u.email} (ID: ${u.id}, Active: ${u.is_active})`));

  // 3. Verify Admin Role
  const { data: adminRoles } = await supabase
    .from('user_roles')
    .select('*, roles(code, name)')
    .eq('user_id', protectedAppUser.id);
  console.log(`3. Admin Roles:`, adminRoles?.map((r) => (r as any).roles?.code));

  // 4. Verify Admin Credentials
  const { data: adminCreds } = await supabase
    .from('user_credentials')
    .select('*')
    .eq('user_id', protectedAppUser.id);
  console.log(`4. Admin Credentials: ${adminCreds?.length} found (Hash length: ${adminCreds?.[0]?.password_hash?.length})`);

  // 5. Verify Employee count
  const { count: finalEmpCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });
  console.log(`5. Employees Remaining: ${finalEmpCount}`);

  // 6. Verify Documents count
  const { count: finalDocCount } = await supabase.from('documents').select('*', { count: 'exact', head: true });
  console.log(`6. Documents Remaining: ${finalDocCount}`);

  // 7. Verify Salaries count
  const { count: finalSalCount } = await supabase.from('employee_salary').select('*', { count: 'exact', head: true });
  console.log(`7. Salary Records Remaining: ${finalSalCount}`);

  // 8. Verify Sequence integrity
  const { data: finalSequences } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['numbering_sequences', 'employee_sequence_counter']);
  console.log(`8. Sequences After Cleanup (Unchanged):`);
  finalSequences?.forEach((s) => console.log(`   - ${s.key}:`, JSON.stringify(s.value)));

  // Assertions
  const isAuthOk = finalAuthUsers.length === 1 && finalAuthUsers[0].email === PROTECTED_ADMIN_EMAIL;
  const isAppOk = (finalAppUsers?.length === 1) && finalAppUsers[0].email === PROTECTED_ADMIN_EMAIL;
  const isRoleOk = (adminRoles?.length ?? 0) >= 1 && (adminRoles?.[0] as any)?.roles?.code === 'SUPER_ADMIN';
  const isCredOk = (adminCreds?.length ?? 0) === 1;

  if (isAuthOk && isAppOk && isRoleOk && isCredOk) {
    console.log('\n🎉 ALL MASTER DATA CLEANUP INTEGRITY CHECKS PASSED PERFECTLY!');
  } else {
    console.error('\n❌ INTEGRITY AUDIT WARNING: One or more checks did not match expectations.');
    process.exit(1);
  }
}

executeCleanup().catch((err) => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
