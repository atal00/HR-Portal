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
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

import { getSupabaseAdminClient } from '../src/lib/supabase';

async function checkHrData() {
  const supabase = getSupabaseAdminClient();
  const { count: empCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });
  const { count: docCount } = await supabase.from('documents').select('*', { count: 'exact', head: true });
  const { count: salaryCount } = await supabase.from('employee_salary').select('*', { count: 'exact', head: true });
  const { count: auditCount } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true });
  const { count: secCount } = await supabase.from('security_logs').select('*', { count: 'exact', head: true });

  console.log('HR & Business Data Counts:');
  console.log('- employees:', empCount);
  console.log('- documents:', docCount);
  console.log('- employee_salary:', salaryCount);
  console.log('- audit_logs:', auditCount);
  console.log('- security_logs:', secCount);
}

checkHrData().catch(console.error);
