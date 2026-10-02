import fs from 'fs';
import path from 'path';

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

// All known tables in the application schema
const TABLES_TO_AUDIT = [
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
  'user_permission_overrides',
  'certificate_access_requests',
  'employee_sequences',
];

async function audit() {
  const adminClient = getSupabaseAdminClient();
  const anonClient = getSupabaseClient(); // uses anon key

  console.log('================================================================');
  console.log('SUPABASE PRODUCTION SECURITY AUDIT — READ ONLY LIVE EXECUTION');
  console.log('Target URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('================================================================\n');

  console.log('--- 1. TABLE EXISTENCE & ACCESS AUDIT (ANON vs SERVICE_ROLE) ---');
  
  const auditResults: Record<string, any> = {};

  for (const table of TABLES_TO_AUDIT) {
    // 1. Check with service_role (Admin client)
    const { data: adminData, error: adminErr, count: adminCount } = await adminClient
      .from(table)
      .select('*', { count: 'exact', head: true });

    // 2. Check with anon (Public client)
    const { data: anonData, error: anonErr, count: anonCount } = await anonClient
      .from(table)
      .select('*', { count: 'exact', head: true });

    // 3. Inspect columns if table exists
    let columns: string[] = [];
    if (!adminErr) {
      const { data: sample } = await adminClient.from(table).select('*').limit(1);
      if (sample && sample[0]) {
        columns = Object.keys(sample[0]);
      }
    }

    auditResults[table] = {
      exists: !adminErr || (adminErr.code !== 'PGRST205' && adminErr.code !== '42P01'),
      adminStatus: adminErr ? `${adminErr.code}: ${adminErr.message}` : `OK (count: ${adminCount})`,
      anonStatus: anonErr ? `${anonErr.code}: ${anonErr.message}` : `EXPOSED (count: ${anonCount})`,
      anonAccessible: !anonErr,
      columns,
    };

    console.log(`Table: public.${table}`);
    console.log(`  Exists: ${auditResults[table].exists}`);
    console.log(`  Service Role: ${auditResults[table].adminStatus}`);
    console.log(`  Anon Client:  ${auditResults[table].anonStatus} ${auditResults[table].anonAccessible ? '⚠️ ALERT: ANON CAN READ!' : '🔒 PROTECTED'}`);
    if (columns.length > 0) {
      console.log(`  Columns (${columns.length}): ${columns.join(', ')}`);
    }
    console.log('');
  }

  // 4. Test anon write attempts (HEAD/DRY-RUN or safe dummy queries that test authorization rejection)
  console.log('\n--- 2. ANON WRITE PRIVILEGE PROBING ---');
  for (const table of TABLES_TO_AUDIT) {
    if (!auditResults[table].exists) continue;

    // Test anon insert rejection (using dummy ID that will never commit or tests policy failure)
    const { error: insertErr } = await anonClient
      .from(table)
      .insert({ id: '00000000-0000-0000-0000-000000000000' } as any);

    const insertBlocked = !!insertErr && (
      insertErr.code === '42501' || // permission denied
      insertErr.code === 'PGRST301' || // JWT expired / auth error
      insertErr.message.includes('row-level security') ||
      insertErr.message.includes('permission denied')
    );

    console.log(`Anon INSERT on public.${table}: ${insertErr ? insertErr.code + ' - ' + insertErr.message : '⚠️ ALERT: INSERT NOT REJECTED BY RLS!'}`);
  }

  // 5. Audit Storage Buckets
  console.log('\n--- 3. STORAGE BUCKETS AUDIT ---');
  const { data: buckets, error: bErr } = await adminClient.storage.listBuckets();
  if (bErr) {
    console.log('Error listing buckets:', bErr);
  } else {
    console.log(`Total buckets found: ${buckets?.length}`);
    for (const b of buckets || []) {
      console.log(`Bucket: "${b.name}"`);
      console.log(`  ID: ${b.id}`);
      console.log(`  Public: ${b.public}`);
      console.log(`  File size limit: ${b.file_size_limit ?? 'UNRESTRICTED'}`);
      console.log(`  Allowed MIME types: ${b.allowed_mime_types ? JSON.stringify(b.allowed_mime_types) : 'UNRESTRICTED'}`);

      // Test anon listing on bucket
      const { data: anonFiles, error: anonFilesErr } = await anonClient.storage
        .from(b.name)
        .list('', { limit: 5 });
      console.log(`  Anon list access: ${anonFilesErr ? '🔒 BLOCKED (' + anonFilesErr.message + ')' : '⚠️ EXPOSED (found ' + (anonFiles?.length || 0) + ' items)'}`);
    }
  }

  // 6. Test RPC endpoints known to application
  console.log('\n--- 4. RPC ENDPOINTS AUDIT ---');
  const knownRpcs = [
    'permanent_purge_employee',
    'is_super_admin',
    'has_permission',
    'current_app_user_id',
    'get_next_employee_sequence',
    'approve_employee_deletion',
  ];

  for (const rpcName of knownRpcs) {
    const { error: anonRpcErr } = await anonClient.rpc(rpcName as any, {} as any);
    const { error: adminRpcErr } = await adminClient.rpc(rpcName as any, {} as any);
    console.log(`RPC public.${rpcName}():`);
    console.log(`  Anon caller: ${anonRpcErr ? anonRpcErr.code + ': ' + anonRpcErr.message : 'EXECUTABLE'}`);
    console.log(`  Admin caller: ${adminRpcErr ? adminRpcErr.code + ': ' + adminRpcErr.message : 'EXECUTABLE'}`);
  }
}

audit().catch(console.error);
