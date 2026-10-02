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

async function checkCounts() {
  const { count: docCount } = await admin.from('documents').select('*', { count: 'exact', head: true });
  const { count: empCount } = await admin.from('employees').select('*', { count: 'exact', head: true });
  const { count: usrCount } = await admin.from('users').select('*', { count: 'exact', head: true });
  const { data: objects } = await admin.storage.from('hr-documents').list('', { limit: 100 });
  console.log('Live Verification Counts:');
  console.log('Documents count:', docCount);
  console.log('Employees count:', empCount);
  console.log('Users count:', usrCount);
  console.log('hr-documents storage objects count:', objects?.length);
}

checkCounts().catch(console.error);
