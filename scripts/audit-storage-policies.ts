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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const admin = createClient(supabaseUrl, serviceRoleKey);
const anon = createClient(supabaseUrl, anonKey);

async function inspectStorage() {
  console.log('--- Inspecting Buckets ---');
  const { data: buckets, error: bErr } = await admin.storage.listBuckets();
  if (bErr) {
    console.error('listBuckets error:', bErr);
  } else {
    console.log('Buckets:', JSON.stringify(buckets, null, 2));
  }

  console.log('\n--- Testing Admin Listing on hr-documents ---');
  const { data: adminList, error: admListErr } = await admin.storage.from('hr-documents').list('', { limit: 10 });
  console.log('Admin list result:', { count: adminList?.length, items: adminList, error: admListErr });

  console.log('\n--- Testing Anon Listing on hr-documents ---');
  const { data: anonList, error: aErr } = await anon.storage.from('hr-documents').list('', { limit: 10 });
  console.log('Anon list result:', { data: anonList, error: aErr });

  console.log('\n--- Testing Anon Download on hr-documents ---');
  const { data: anonDown, error: adErr } = await anon.storage.from('hr-documents').download('dummy.pdf');
  console.log('Anon download result:', { error: adErr });

  console.log('\n--- Testing Anon Upload on hr-documents ---');
  const { data: anonUp, error: auErr } = await anon.storage.from('hr-documents').upload('test-anon.txt', Buffer.from('test'));
  console.log('Anon upload result:', { error: auErr });

  console.log('\n--- Testing Anon Delete on hr-documents ---');
  const { data: anonDel, error: adelErr } = await anon.storage.from('hr-documents').remove(['test-anon.txt']);
  console.log('Anon delete result:', { error: adelErr });
}

inspectStorage().catch(console.error);
