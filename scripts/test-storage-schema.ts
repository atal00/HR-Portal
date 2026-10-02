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

async function testStorageSchema() {
  try {
    const { data, error } = await admin.schema('storage' as any).from('objects').select('*').limit(5);
    console.log('storage.objects query result:', { data, error });
  } catch (e) {
    console.error('schema error:', e);
  }

  try {
    const { data: bData, error: bError } = await admin.schema('storage' as any).from('buckets').select('*');
    console.log('storage.buckets query result:', { data: bData, error: bError });
  } catch (e) {
    console.error('buckets error:', e);
  }
}

testStorageSchema().catch(console.error);
