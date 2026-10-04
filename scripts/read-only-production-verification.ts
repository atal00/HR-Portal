import { createClient } from '@supabase/supabase-js';
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runReadOnlyVerification() {
  console.log('====================================================');
  console.log('HR PORTAL — READ-ONLY PRODUCTION STATE VERIFICATION');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // 1. POSTGREST SCHEMA INSPECTION (HTTP GET /rest/v1/)
  // --------------------------------------------------------------------------
  console.log('--- 1. POSTGREST OPENAPI SCHEMA INSPECTION ---');
  let openApiSchema: any = null;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
    if (res.ok) {
      openApiSchema = await res.json();
      console.log('Successfully fetched OpenAPI schema from PostgREST.');
    } else {
      console.log(`Failed to fetch OpenAPI schema: ${res.status} ${res.statusText}`);
    }
  } catch (err: any) {
    console.log('Error fetching OpenAPI schema:', err.message);
  }

  const exposedDefinitions = openApiSchema?.definitions ? Object.keys(openApiSchema.definitions) : [];
  const exposedPaths = openApiSchema?.paths ? Object.keys(openApiSchema.paths) : [];

  console.log('Exposed tables/views count:', exposedDefinitions.length);
  console.log('Exposed definitions:', exposedDefinitions);
  console.log('Exposed paths count:', exposedPaths.length);

  const rpcPaths = exposedPaths.filter(p => p.startsWith('/rpc/'));
  console.log('Exposed RPCs:', rpcPaths);

  // --------------------------------------------------------------------------
  // 2. CHECK public.tasks TABLE
  // --------------------------------------------------------------------------
  console.log('\n--- 2. TASKS TABLE & STORE INSPECTION ---');
  const { count: tasksTableCount, error: tasksTableError } = await supabase
    .from('tasks')
    .select('*', { count: 'exact', head: true });

  let tasksTableStatus = 'MISSING';
  let tasksTableRowCount = 0;
  if (!tasksTableError) {
    tasksTableStatus = 'EXISTS';
    tasksTableRowCount = tasksTableCount || 0;
    console.log(`public.tasks: EXISTS (row count: ${tasksTableRowCount})`);
  } else {
    console.log(`public.tasks: MISSING (Code: ${tasksTableError.code}, Message: ${tasksTableError.message})`);
  }

  // Check system_settings tasks_store
  const { data: tasksStoreSetting, error: tasksStoreErr } = await supabase
    .from('system_settings')
    .select('key, value, description, updated_at')
    .eq('key', 'tasks_store')
    .maybeSingle();

  let tasksStoreStatus = 'NOT ACTIVE';
  let tasksStoreCount = 0;
  if (!tasksStoreErr && tasksStoreSetting && Array.isArray(tasksStoreSetting.value)) {
    tasksStoreStatus = 'ACTIVE';
    tasksStoreCount = tasksStoreSetting.value.length;
    console.log(`system_settings.tasks_store: ACTIVE (item count: ${tasksStoreCount}, updated_at: ${tasksStoreSetting.updated_at})`);
    console.log('Active tasks in tasks_store:');
    tasksStoreSetting.value.forEach((t: any, idx: number) => {
      console.log(`  [${idx + 1}] ID: ${t.id} | Title: "${t.title}" | Status: ${t.status} | Priority: ${t.priority} | Assigned: ${t.assigned_to}`);
    });
  } else {
    console.log(`system_settings.tasks_store: NOT ACTIVE or missing`);
  }

  // --------------------------------------------------------------------------
  // 3. DOCUMENT NUMBER SEQUENCE INSPECTION
  // --------------------------------------------------------------------------
  console.log('\n--- 3. DOCUMENT NUMBER SEQUENCE INSPECTION ---');

  // Query all documents
  const { data: allDocs, error: docsError } = await supabase
    .from('documents')
    .select('id, document_number, document_type, title, status, issue_date, created_at');

  if (docsError) {
    console.error('Error querying documents table:', docsError.message);
  }

  const documents = allDocs || [];
  console.log(`Total documents in public.documents: ${documents.length}`);

  const canonicalTypes = [
    { type: 'OFFER_LETTER', prefix: 'VAR-OFF' },
    { type: 'EXPERIENCE_LETTER', prefix: 'VAR-EXP' },
    { type: 'RELIEVING_LETTER', prefix: 'VAR-REL' },
    { type: 'SALARY_SLIP', prefix: 'VAR-SAL' },
    { type: 'CERTIFICATE', prefix: 'VAR-CERT' },
  ];

  const highestExistingByPrefix: Record<string, { maxNumber: number; docNumbers: string[]; count: number }> = {};

  for (const { type, prefix } of canonicalTypes) {
    const matchingDocs = documents.filter(d => d.document_type === type || (d.document_number && d.document_number.startsWith(prefix)));
    const docNumbers = matchingDocs.map(d => d.document_number).filter(Boolean);
    const parsedSeqs = docNumbers.map(dn => {
      const match = dn.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });

    const maxNumber = parsedSeqs.length > 0 ? Math.max(...parsedSeqs) : 0;
    highestExistingByPrefix[prefix] = {
      maxNumber,
      docNumbers,
      count: matchingDocs.length,
    };

    console.log(`Document Type: ${type} (${prefix}):`);
    console.log(`  Count: ${matchingDocs.length}`);
    console.log(`  Highest extracted sequence number: ${maxNumber === 0 ? 'None (0 documents)' : maxNumber}`);
    if (docNumbers.length > 0) {
      console.log(`  Existing document numbers: ${docNumbers.join(', ')}`);
    }
  }

  // Check any other documents outside canonical types
  const otherDocs = documents.filter(d => !canonicalTypes.some(c => c.type === d.document_type || (d.document_number && d.document_number.startsWith(c.prefix))));
  if (otherDocs.length > 0) {
    console.log('Other documents found:', otherDocs.map(d => `${d.document_type}: ${d.document_number}`));
  } else {
    console.log('No non-canonical documents exist.');
  }

  // Inspect system_settings for numbering sequences or counters
  const { data: allSettings, error: settingsErr } = await supabase
    .from('system_settings')
    .select('key, value, description');

  console.log('\n--- 4. SYSTEM_SETTINGS INSPECTION ---');
  if (settingsErr) {
    console.error('Error querying system_settings:', settingsErr.message);
  } else {
    const settings = allSettings || [];
    console.log(`Total settings keys: ${settings.length}`);
    settings.forEach(s => {
      if (typeof s.value === 'object' && s.value !== null) {
        console.log(`  Key: "${s.key}" => ${JSON.stringify(s.value).substring(0, 100)}...`);
      } else {
        console.log(`  Key: "${s.key}" => ${s.value}`);
      }
    });
  }

  // Check if native sequences or RPC exist
  console.log('\n--- 5. NATIVE POSTGRESQL SEQUENCES & RPC CHECK ---');
  const hasNextDocSeqRpc = rpcPaths.includes('/rpc/next_document_sequence');
  console.log(`RPC next_document_sequence exposed in PostgREST: ${hasNextDocSeqRpc ? 'YES' : 'NO'}`);

  const hasPurgeRpc = rpcPaths.includes('/rpc/permanent_purge_employee');
  console.log(`RPC permanent_purge_employee exposed in PostgREST: ${hasPurgeRpc ? 'YES' : 'NO'}`);

  // Summary object
  console.log('\n====================================================');
  console.log('VERIFICATION SUMMARY');
  console.log('====================================================');
  console.log('DOCUMENT SEQUENCES:');
  for (const { prefix } of canonicalTypes) {
    const info = highestExistingByPrefix[prefix];
    console.log(`- ${prefix}: Existing Max = ${info.maxNumber}, Total = ${info.count}`);
  }
  console.log(`- Tasks table: ${tasksTableStatus}`);
  console.log(`- tasks_store fallback: ${tasksStoreStatus}`);
  console.log('====================================================');
}

runReadOnlyVerification().catch(console.error);
