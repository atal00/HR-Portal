import fs from 'fs';
import path from 'path';

// Load local environment variables safely
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        process.env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
      }
    }
  });
}

import { getSupabaseAdminClient, getSupabaseClient } from '../src/lib/supabase';

const ALL_TABLES = [
  'users',
  'roles',
  'permissions',
  'user_roles',
  'role_permissions',
  'departments',
  'employees',
  'employee_salary',
  'templates',
  'template_versions',
  'documents',
  'document_versions',
  'approvals',
  'audit_logs',
  'security_logs',
  'verification_logs',
  'system_settings',
  'tasks',
  'user_credentials',
  'user_mfa',
  'user_permission_overrides',
  'certificate_access_requests',
  'employee_sequences',
];

async function runReadOnlyProbe() {
  console.log('================================================================');
  console.log('SUPABASE LIVE PRODUCTION SECURITY AUDIT — STRICT READ-ONLY PROBE');
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('================================================================\n');

  const adminClient = getSupabaseAdminClient();
  const anonClient = getSupabaseClient();

  console.log('--- 1. TABLE INVENTORY & PER-TABLE ACCESS MATRIX ---');
  
  for (const table of ALL_TABLES) {
    // Admin client (service_role)
    const { count: adminCount, error: adminErr } = await adminClient
      .from(table)
      .select('*', { count: 'exact', head: true });

    // Anon client (public anon key)
    const { count: anonCount, error: anonErr, data: anonData } = await anonClient
      .from(table)
      .select('*')
      .limit(1);

    const exists = !adminErr || (adminErr.code !== 'PGRST205' && adminErr.code !== '42P01');

    let colNames: string[] = [];
    if (exists && !adminErr) {
      const { data: sample } = await adminClient.from(table).select('*').limit(1);
      if (sample && sample[0]) {
        colNames = Object.keys(sample[0]);
      }
    }

    const anonRowsReturned = anonData?.length || 0;
    const isAnonExposed = !anonErr && anonRowsReturned > 0;
    const isAnonQueryAllowed = !anonErr; // if no error, PostgREST allowed the query (RLS returned 0 rows or rows)

    console.log(`Table: [public.${table}]`);
    console.log(`  Table Exists:      ${exists ? 'YES' : 'NO (Not in database)'}`);
    if (exists) {
      console.log(`  Row Count (Admin): ${adminCount ?? 'Error: ' + adminErr?.message}`);
      console.log(`  Anon Read Query:   ${anonErr ? 'ERROR: ' + anonErr.code + ' - ' + anonErr.message : 'HTTP 200 OK (Rows returned: ' + anonRowsReturned + ')'}`);
      console.log(`  Anon Exposure:     ${isAnonExposed ? 'CRITICAL LEAK: Anon retrieved real rows!' : (isAnonQueryAllowed ? 'RLS filtered (0 rows returned)' : 'Hard Rejected')}`);
      console.log(`  Columns (${colNames.length}):    ${colNames.join(', ')}`);
    }
    console.log('');
  }

  console.log('\n--- 2. STORAGE BUCKETS & ANONYMOUS ACCESS PROBE ---');
  const { data: buckets, error: bErr } = await adminClient.storage.listBuckets();
  if (bErr) {
    console.log('Error listing buckets:', bErr);
  } else {
    console.log(`Total Storage Buckets: ${buckets?.length || 0}`);
    for (const b of buckets || []) {
      console.log(`\nBucket: "${b.name}" (ID: ${b.id})`);
      console.log(`  Public Status:     ${b.public ? 'PUBLIC (Warning!)' : 'PRIVATE'}`);
      console.log(`  Size Limit:        ${b.file_size_limit ? b.file_size_limit + ' bytes' : 'UNRESTRICTED'}`);
      console.log(`  Allowed MIME:      ${b.allowed_mime_types ? JSON.stringify(b.allowed_mime_types) : 'UNRESTRICTED'}`);

      // Check contents with admin
      const { data: adminFiles } = await adminClient.storage.from(b.name).list('', { limit: 10 });
      console.log(`  File Count (Admin): ${adminFiles?.length || 0}`);

      // Probe anon list
      const { data: anonFiles, error: aListErr } = await anonClient.storage.from(b.name).list('', { limit: 5 });
      console.log(`  Anon List Result:   ${aListErr ? 'BLOCKED (' + aListErr.message + ')' : 'ALLOWED (Returned ' + (anonFiles?.length || 0) + ' items)'}`);

      // Probe anon download on dummy/test path
      const { error: aDownErr } = await anonClient.storage.from(b.name).download('nonexistent-audit-probe.pdf');
      console.log(`  Anon Download Probe: ${aDownErr ? aDownErr.message : 'SUCCESS (Exposed)'}`);
    }
  }

  console.log('\n--- 3. RPC ENDPOINTS READ-ONLY CALL PROBE ---');
  const rpcs = [
    'is_super_admin',
    'has_permission',
    'current_app_user_id',
    'get_next_employee_sequence',
    'permanent_purge_employee',
  ];

  for (const rpc of rpcs) {
    const { error: anonRpcErr } = await anonClient.rpc(rpc as any, {} as any);
    const { error: adminRpcErr } = await adminClient.rpc(rpc as any, {} as any);
    console.log(`Function public.${rpc}():`);
    console.log(`  Anon RPC response:  ${anonRpcErr ? anonRpcErr.code + ' - ' + anonRpcErr.message : 'EXECUTED'}`);
    console.log(`  Admin RPC response: ${adminRpcErr ? adminRpcErr.code + ' - ' + adminRpcErr.message : 'EXECUTED'}`);
  }
}

runReadOnlyProbe().catch(console.error);
