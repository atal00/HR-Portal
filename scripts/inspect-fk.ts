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

async function main() {
  const supabase = getSupabaseAdminClient();

  // Test tables that might have employee_id
  const tables = [
    'documents',
    'employee_salary',
    'salaries',
    'tasks',
    'certificate_requests',
    'certificate_access_requests',
    'audit_logs',
    'security_logs',
    'verification_logs',
    'document_versions',
    'employees',
  ];

  console.log('=== CHECKING COLUMNS IN PUBLIC TABLES ===');
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table "${table}": NOT ACCESSIBLE / DOES NOT EXIST (${error.message})`);
    } else {
      const cols = data && data[0] ? Object.keys(data[0]) : '(empty table - querying rpc/count)';
      console.log(`Table "${table}": EXISTS. Sample columns:`, cols);
    }
  }

  process.exit(0);
}

main().catch(console.error);
