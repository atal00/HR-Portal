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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function probeStorageApi() {
  console.log('--- 1. POST /storage/v1/object/list/hr-documents with Anon Key ---');
  const resAnon = await fetch(`${supabaseUrl}/storage/v1/object/list/hr-documents`, {
    method: 'POST',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix: '', limit: 10, offset: 0 }),
  });
  console.log('Anon status:', resAnon.status, resAnon.statusText);
  const anonBody = await resAnon.text();
  console.log('Anon body:', anonBody);

  console.log('\n--- 2. POST /storage/v1/object/list/hr-documents with NO Auth ---');
  const resNoAuth = await fetch(`${supabaseUrl}/storage/v1/object/list/hr-documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix: '', limit: 10, offset: 0 }),
  });
  console.log('No-auth status:', resNoAuth.status, resNoAuth.statusText);
  const noAuthBody = await resNoAuth.text();
  console.log('No-auth body:', noAuthBody);

  console.log('\n--- 3. POST /storage/v1/object/list/hr-documents with Service Role ---');
  const resAdmin = await fetch(`${supabaseUrl}/storage/v1/object/list/hr-documents`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prefix: '', limit: 10, offset: 0 }),
  });
  console.log('Admin status:', resAdmin.status, resAdmin.statusText);
  const adminBody = await resAdmin.text();
  console.log('Admin body:', adminBody);
}

probeStorageApi().catch(console.error);
