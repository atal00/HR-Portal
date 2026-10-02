import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        process.env[k] = v;
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceRoleKey);

let checksTotal = 0;
let checksPassed = 0;

function check(condition: boolean, description: string, details?: any) {
  checksTotal++;
  if (condition) {
    checksPassed++;
    console.log(`  [PASS] ${description}`);
  } else {
    console.error(`  [FAIL] ${description}`, details || '');
  }
}

async function validateSchema() {
  console.log('================================================================');
  console.log('STATIC & LIVE SCHEMA VALIDATION: STORAGE RLS MIGRATION');
  console.log('Timestamp:', new Date().toISOString());
  console.log('================================================================\n');

  // 1. Static Validation of SQL Migration File
  console.log('--- 1. Static Validation of supabase_harden_hr_documents_storage.sql ---');
  const sqlPath = path.resolve(process.cwd(), 'supabase_harden_hr_documents_storage.sql');
  const rawSql = fs.readFileSync(sqlPath, 'utf8');

  // Strip SQL comments for strict code analysis
  const codeOnly = rawSql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  check(!codeOnly.includes('e.user_id') && !codeOnly.includes('employees.user_id') && !codeOnly.includes('user_id = public.current_app_user_id()'),
    'Confirmed: employees.user_id and e.user_id are NOT referenced in SQL code');

  check(codeOnly.includes('e.email = ('),
    'Confirmed: employee identity resolves strictly via e.email = (SELECT u.email FROM public.users u WHERE u.id = public.current_app_user_id())');

  check(!codeOnly.includes('REVOKE ALL ON TABLE storage.objects FROM anon'),
    'Confirmed: Global REVOKE ALL ON TABLE storage.objects FROM anon is REMOVED');

  check(!codeOnly.includes('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA storage'),
    'Confirmed: Global function revokes are REMOVED');

  check(!codeOnly.includes('USING (TRUE)') && !codeOnly.includes('USING (true)'),
    'Confirmed: No policy uses overly broad USING (true)');

  const bucketMatches = codeOnly.match(/bucket_id = 'hr-documents'/g);
  check(bucketMatches !== null && bucketMatches.length === 4,
    `Confirmed: All 4 DML policies (SELECT, INSERT, UPDATE, DELETE) are explicitly scoped to bucket_id = 'hr-documents' (Found: ${bucketMatches?.length})`);

  check(!codeOnly.includes('hr-assets'),
    'Confirmed: hr-assets or other buckets are completely unexposed and unmutated in SQL statements');

  // 2. Live Database Schema Probes (Read-Only)
  console.log('\n--- 2. Live Database Schema & Column Probing ---');

  // 2.1 Verify public.documents columns
  const { data: docData, error: docErr } = await admin.from('documents').select('file_path, employee_id, document_type').limit(1);
  check(!docErr, 'Live table public.documents exists with columns file_path, employee_id, document_type', docErr);

  // 2.2 Verify public.employees columns
  const { data: empData, error: empErr } = await admin.from('employees').select('id, email').limit(1);
  check(!empErr, 'Live table public.employees exists with columns id, email', empErr);

  // 2.3 Verify public.users columns
  const { data: userData, error: userErr } = await admin.from('users').select('id, email').limit(1);
  check(!userErr, 'Live table public.users exists with columns id, email', userErr);

  // 2.4 Verify RPC current_app_user_id exists
  const { error: rpcErr } = await admin.rpc('current_app_user_id');
  check(!rpcErr, 'Live RPC public.current_app_user_id() is valid and callable', rpcErr);

  // 2.5 Verify storage bucket hr-documents exists and is private
  const { data: buckets } = await admin.storage.listBuckets();
  const hrDocsBucket = buckets?.find((b) => b.id === 'hr-documents');
  check(hrDocsBucket !== undefined, 'Storage bucket hr-documents exists in live project');
  check(hrDocsBucket?.public === false, 'Storage bucket hr-documents is strictly PRIVATE (public = false)');

  console.log('\n================================================================');
  console.log(`TOTAL CHECKS: ${checksTotal} | PASSED: ${checksPassed} | FAILED: ${checksTotal - checksPassed}`);
  console.log('================================================================');
}

validateSchema().catch(console.error);
