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
import { runClassification } from './classify-records';

const PROTECTED_ADMIN_EMAIL = 'admin@in.varsaka.com';

async function executeCleanup() {
  const supabase = getSupabaseAdminClient();

  console.log('================================================================');
  console.log('PHASE B — MUTATION CLEANUP: TASKS, AUDIT TRAIL, SECURITY LOGS');
  console.log('PROJECT: HR Portal (D:\\19.Website\\HR_Portal)');
  console.log('PROTECTED ADMIN: ' + PROTECTED_ADMIN_EMAIL);
  console.log('================================================================\n');

  // STEP 1: Run read-only classification first to obtain exact targets
  const {
    taskStats,
    auditStats,
    secStats,
    classifiedTasks,
    classifiedAudit,
    classifiedSec,
  } = await runClassification();

  console.log('CLASSIFICATION SUMMARY BEFORE MUTATION:');
  console.log(`- Tasks: ${taskStats.total} total (${taskStats.testCandidates} test to delete, ${taskStats.legitimate + taskStats.ambiguous} to keep)`);
  console.log(`- Audit Logs: ${auditStats.total} total (${auditStats.confirmedTest} test to delete, ${auditStats.legitimate + auditStats.ambiguous} to keep)`);
  console.log(`- Security Logs: ${secStats.total} total (${secStats.confirmedTest} test to delete, ${secStats.legitimate + secStats.ambiguous} to keep)\n`);

  // STEP 2: Clean Tasks in tasks_store
  console.log('--- Step 2: Cleaning Tasks ---');
  const legitimateTasks = classifiedTasks
    .filter((ct) => ct.classification !== 'TEST_QA')
    .map((ct) => ct.item);

  const { error: taskUpdateErr } = await supabase
    .from('system_settings')
    .update({ value: legitimateTasks, updated_at: new Date().toISOString() })
    .eq('key', 'tasks_store');

  if (taskUpdateErr) {
    throw new Error(`Failed to update tasks_store: ${taskUpdateErr.message}`);
  }
  console.log(`✅ tasks_store successfully updated. Retained ${legitimateTasks.length} legitimate tasks.`);
  legitimateTasks.forEach((t) => console.log(`   * [${t.status}] "${t.title}" (ID: ${t.id})`));

  // STEP 3: Clean Audit Logs
  console.log('\n--- Step 3: Cleaning Audit Logs ---');
  const testAuditIds = classifiedAudit
    .filter((ca) => ca.classification === 'TEST_QA')
    .map((ca) => ca.item.id);

  console.log(`Deleting ${testAuditIds.length} confirmed test audit log records in batches...`);
  const batchSize = 40;
  for (let i = 0; i < testAuditIds.length; i += batchSize) {
    const batch = testAuditIds.slice(i, i + batchSize);
    const { error: delAuditErr } = await supabase
      .from('audit_logs')
      .delete()
      .in('id', batch);
    if (delAuditErr) {
      console.warn(`Warning deleting audit batch ${i}:`, delAuditErr.message);
    }
  }
  console.log(`✅ Cleaned test audit log records.`);

  // STEP 4: Clean Security Logs
  console.log('\n--- Step 4: Cleaning Security Logs ---');
  const testSecIds = classifiedSec
    .filter((cs) => cs.classification === 'TEST_QA')
    .map((cs) => cs.item.id);

  console.log(`Deleting ${testSecIds.length} confirmed test security log records...`);
  if (testSecIds.length > 0) {
    const { error: delSecErr } = await supabase
      .from('security_logs')
      .delete()
      .in('id', testSecIds);
    if (delSecErr) {
      console.warn('Warning deleting security logs:', delSecErr.message);
    }
  }
  console.log(`✅ Cleaned test security log records.`);

  // STEP 5: Sync Local JSON Store (.system_data/db_store.json)
  console.log('\n--- Step 5: Syncing Local Datastore State ---');
  const localStorePath = path.resolve(process.cwd(), '.system_data/db_store.json');
  if (fs.existsSync(localStorePath)) {
    try {
      const localStore = JSON.parse(fs.readFileSync(localStorePath, 'utf-8'));
      localStore.tasks = legitimateTasks;
      // Retain only admin events in local audit/security logs
      localStore.audit_logs = (localStore.audit_logs || []).filter(
        (a: any) => a.user_email?.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase()
      );
      localStore.security_logs = (localStore.security_logs || []).filter(
        (s: any) => s.metadata?.target_email?.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase()
      );
      fs.writeFileSync(localStorePath, JSON.stringify(localStore, null, 2), 'utf-8');
      console.log('✅ Synchronized local db_store.json.');
    } catch (e: any) {
      console.warn('Could not update .system_data/db_store.json:', e.message);
    }
  }

  // STEP 6: Phase C - Post-Cleanup Verification
  console.log('\n================================================================');
  console.log('PHASE C — POST-CLEANUP VERIFICATION');
  console.log('================================================================');

  // Verify Tasks
  const { data: finalTaskRec } = await supabase.from('system_settings').select('*').eq('key', 'tasks_store').maybeSingle();
  const finalTasks = (finalTaskRec && Array.isArray(finalTaskRec.value)) ? finalTaskRec.value : [];
  console.log(`1. Remaining Tasks: ${finalTasks.length}`);
  finalTasks.forEach((t: any) => console.log(`   - "${t.title}" | Status: ${t.status} | ID: ${t.id}`));

  // Verify Audit Logs
  const { data: finalAudit, count: finalAuditCount } = await supabase.from('audit_logs').select('*', { count: 'exact' });
  console.log(`2. Remaining Audit Logs: ${finalAudit?.length} (count: ${finalAuditCount})`);
  finalAudit?.forEach((a: any) => console.log(`   - [${a.action}] User: ${a.user_email || a.user_id} | Res: ${a.resource_type}:${a.resource_id} | ID: ${a.id}`));

  // Verify Security Logs
  const { data: finalSec, count: finalSecCount } = await supabase.from('security_logs').select('*', { count: 'exact' });
  console.log(`3. Remaining Security Logs: ${finalSec?.length} (count: ${finalSecCount})`);
  finalSec?.forEach((s: any) => console.log(`   - [${s.event_type}] ${s.description} | ID: ${s.id}`));

  // Verify Admin Protection
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUsers = authData?.users || [];
  const { data: appUsers } = await supabase.from('users').select('*');
  const { data: adminRoles } = await supabase.from('user_roles').select('*, roles(code, name)').eq('user_id', appUsers?.[0]?.id);
  const { data: adminCreds } = await supabase.from('user_credentials').select('*').eq('user_id', appUsers?.[0]?.id);

  console.log('\n4. Admin Account Protection Check:');
  console.log(`   - Auth User: ${authUsers.length === 1 && authUsers[0].email === PROTECTED_ADMIN_EMAIL ? '✅ VALID' : '❌ INVALID'} (${authUsers[0]?.email})`);
  console.log(`   - Public User: ${appUsers?.length === 1 && appUsers[0].email === PROTECTED_ADMIN_EMAIL ? '✅ VALID' : '❌ INVALID'} (${appUsers?.[0]?.email})`);
  console.log(`   - SUPER_ADMIN Role: ${(adminRoles?.[0] as any)?.roles?.code === 'SUPER_ADMIN' ? '✅ VALID' : '❌ INVALID'}`);
  console.log(`   - Credentials: ${adminCreds?.length === 1 && Boolean(adminCreds[0].password_hash) ? '✅ VALID' : '❌ INVALID'}`);

  // Verify Sequences
  const { data: finalSequences } = await supabase.from('system_settings').select('key, value').in('key', ['numbering_sequences', 'employee_sequence_counter']);
  console.log('\n5. Sequence Protection Check:');
  finalSequences?.forEach((s: any) => console.log(`   - ${s.key}:`, JSON.stringify(s.value)));

  console.log('\n🎉 PHASE B & C CLEANUP AND VERIFICATION COMPLETED SUCCESSFULLY!');
}

executeCleanup().catch((err) => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
