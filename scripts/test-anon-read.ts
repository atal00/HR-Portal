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

import { getSupabaseClient } from '../src/lib/supabase';

async function testAnonRead() {
  const anon = getSupabaseClient();
  const tables = ['users', 'roles', 'permissions', 'departments', 'templates', 'template_versions', 'system_settings', 'audit_logs', 'security_logs', 'employees', 'employee_salary', 'documents'];

  for (const t of tables) {
    const { data, error } = await anon.from(t).select('*').limit(3);
    if (error) {
      console.log(`Table ${t}: BLOCKED by RLS/Grants (${error.code}: ${error.message})`);
    } else {
      console.log(`Table ${t}: READ SUCCESS! Rows returned: ${data?.length}`);
      if (data && data.length > 0) {
        console.log(`   Sample keys:`, Object.keys(data[0]));
      }
    }
  }
}

testAnonRead().catch(console.error);
