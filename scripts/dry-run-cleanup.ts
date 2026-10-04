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

async function dryRun() {
  const supabase = getSupabaseAdminClient();

  console.log('====================================================');
  console.log('DATABASE CLEANUP DRY-RUN AUDIT');
  console.log('PROTECTED ADMIN EMAIL:', PROTECTED_ADMIN_EMAIL);
  console.log('====================================================\n');

  // 1. Auth Users
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error('Error fetching auth.users:', authErr);
    process.exit(1);
  }
  const authUsers = authData?.users || [];
  const protectedAuthUser = authUsers.find(u => u.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase());
  const authUsersToDelete = authUsers.filter(u => u.email?.toLowerCase() !== PROTECTED_ADMIN_EMAIL.toLowerCase());

  console.log(`[AUTH.USERS] Total: ${authUsers.length}`);
  console.log(` - Protected Admin Auth User: ${protectedAuthUser ? `${protectedAuthUser.email} (ID: ${protectedAuthUser.id})` : 'NOT FOUND!'}`);
  console.log(` - Auth Users to Delete: ${authUsersToDelete.length}`);
  authUsersToDelete.forEach(u => console.log(`   * ${u.email} (ID: ${u.id})`));

  // 2. Public Users
  const { data: appUsers, error: appErr } = await supabase.from('users').select('*');
  if (appErr) {
    console.error('Error fetching public.users:', appErr);
    process.exit(1);
  }
  const protectedAppUser = (appUsers || []).find(u => u.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase());
  const appUsersToDelete = (appUsers || []).filter(u => u.email?.toLowerCase() !== PROTECTED_ADMIN_EMAIL.toLowerCase());

  console.log(`\n[PUBLIC.USERS] Total: ${appUsers?.length}`);
  console.log(` - Protected Admin Public User: ${protectedAppUser ? `${protectedAppUser.email} (ID: ${protectedAppUser.id})` : 'NOT FOUND!'}`);
  console.log(` - Public Users to Delete: ${appUsersToDelete.length}`);
  appUsersToDelete.forEach(u => console.log(`   * ${u.email} (ID: ${u.id})`));

  const deleteAppUserIds = appUsersToDelete.map(u => u.id);

  // 3. User Roles
  const { data: userRoles } = await supabase.from('user_roles').select('*, roles(code, name)');
  const protectedUserRole = (userRoles || []).filter(ur => ur.user_id === protectedAppUser?.id);
  const deleteUserRoles = (userRoles || []).filter(ur => ur.user_id !== protectedAppUser?.id);
  console.log(`\n[USER_ROLES] Total: ${userRoles?.length}`);
  console.log(` - Protected Admin Roles: ${protectedUserRole.map(r => (r as any).roles?.code || r.role_id).join(', ')}`);
  console.log(` - User Roles to Delete: ${deleteUserRoles.length}`);

  // 4. User Credentials
  const { data: userCreds } = await supabase.from('user_credentials').select('*');
  const protectedCreds = (userCreds || []).filter(c => c.user_id === protectedAppUser?.id);
  const deleteCreds = (userCreds || []).filter(c => c.user_id !== protectedAppUser?.id);
  console.log(`\n[USER_CREDENTIALS] Total: ${userCreds?.length}`);
  console.log(` - Protected Admin Credential: ${protectedCreds.length}`);
  console.log(` - User Credentials to Delete: ${deleteCreds.length}`);

  // 5. User Metadata / Settings
  const { data: settings } = await supabase.from('system_settings').select('*');
  const userMetaSettingsToDelete = (settings || []).filter(s => {
    if (!s.key.startsWith('user_meta_')) return false;
    const userId = s.key.replace('user_meta_', '');
    return userId !== protectedAppUser?.id;
  });
  console.log(`\n[SYSTEM_SETTINGS - USER_META]`);
  console.log(` - Non-admin user_meta entries to clean: ${userMetaSettingsToDelete.length}`);

  // 6. Employees
  const { data: employees, error: empErr } = await supabase.from('employees').select('*');
  if (empErr) {
    console.error('Error fetching employees:', empErr);
    process.exit(1);
  }
  // Are any employees associated with admin@in.varsaka.com?
  const adminEmployee = (employees || []).find(e => e.email?.toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase());
  const employeesToDelete = (employees || []).filter(e => e.email?.toLowerCase() !== PROTECTED_ADMIN_EMAIL.toLowerCase());

  console.log(`\n[EMPLOYEES] Total: ${employees?.length}`);
  console.log(` - Admin Employee Record: ${adminEmployee ? `${adminEmployee.full_name} (${adminEmployee.employee_id})` : 'None (Admin is purely a system user)'}`);
  console.log(` - Employees to Delete: ${employeesToDelete.length}`);
  employeesToDelete.forEach(e => console.log(`   * ${e.employee_id}: ${e.full_name} (${e.email})`));

  const deleteEmployeeIds = employeesToDelete.map(e => e.id);

  // 7. Salary Records
  const { data: salaries, error: salErr } = await supabase.from('employee_salary').select('*');
  if (salErr) {
    console.error('Error fetching employee_salary:', salErr);
  }
  const deleteSalaries = (salaries || []).filter(s => !adminEmployee || s.employee_id !== adminEmployee.id);
  console.log(`\n[EMPLOYEE_SALARY] Total: ${salaries?.length}`);
  console.log(` - Salary Records to Delete: ${deleteSalaries.length}`);
  deleteSalaries.forEach(s => console.log(`   * Salary record for employee_id: ${s.employee_id}, CTC: ${s.annual_ctc}`));

  // 8. Documents & Document Versions
  const { data: docs, error: docErr } = await supabase.from('documents').select('*');
  if (docErr) console.error('Error fetching documents:', docErr);
  
  // Documents generated for or by non-admin
  // Note: PART 1 specifies:
  // "non-admin generated documents"
  // "document versions/attachments"
  // Let's check who created them and which employee they belong to
  console.log(`\n[DOCUMENTS] Total: ${docs?.length}`);
  docs?.forEach(d => {
    console.log(`   * ${d.document_number} [${d.status}] Type: ${d.document_type}, EmpID: ${d.employee_id}, CreatedBy: ${d.created_by}`);
  });

  const { data: docVersions, error: dvErr } = await supabase.from('document_versions').select('*');
  if (dvErr && dvErr.code !== 'PGRST205') console.error('Error fetching doc versions:', dvErr);
  console.log(`\n[DOCUMENT_VERSIONS] Total: ${docVersions?.length || 0}`);

  // 9. Tasks
  const { data: tasks, error: tErr } = await supabase.from('tasks').select('*');
  if (tErr && tErr.code !== 'PGRST205') console.log('Tasks table query result:', tErr.message);
  console.log(`\n[TASKS] Total: ${tasks?.length || 0}`);

  // 10. Permission Overrides
  const { data: overrides, error: oErr } = await supabase.from('user_permission_overrides').select('*');
  if (oErr && oErr.code !== 'PGRST205') console.log('Overrides query result:', oErr.message);
  console.log(`\n[USER_PERMISSION_OVERRIDES] Total: ${overrides?.length || 0}`);

  // 11. Certificate Access Requests
  const { data: certReqs, error: crErr } = await supabase.from('certificate_access_requests').select('*');
  if (crErr && crErr.code !== 'PGRST205') console.log('Cert requests query result:', crErr.message);
  console.log(`\n[CERTIFICATE_ACCESS_REQUESTS] Total: ${certReqs?.length || 0}`);

  // 12. Storage Objects
  const { data: storageObjects } = await supabase.storage.from('hr-documents').list('', { limit: 100 });
  console.log(`\n[STORAGE OBJECTS in 'hr-documents'] Total: ${storageObjects?.length || 0}`);
  storageObjects?.forEach(o => console.log(`   * ${o.name}`));

  console.log('\n====================================================');
  console.log('DRY-RUN SUMMARY');
  console.log('====================================================');
  console.log(`Protected Admin: ${PROTECTED_ADMIN_EMAIL}`);
  console.log(`Auth users to delete: ${authUsersToDelete.length}`);
  console.log(`Public users to delete: ${appUsersToDelete.length}`);
  console.log(`Employees to delete: ${employeesToDelete.length}`);
  console.log(`Salary records to delete: ${deleteSalaries.length}`);
  console.log(`Documents to delete/cleanup: ${docs?.length || 0}`);
  console.log(`Document versions to delete: ${docVersions?.length || 0}`);
  console.log(`Tasks to delete: ${tasks?.length || 0}`);
  console.log(`Permission overrides to delete: ${overrides?.length || 0}`);
  console.log(`Certificate requests to delete: ${certReqs?.length || 0}`);
  console.log('====================================================');
}

dryRun().catch(console.error);
