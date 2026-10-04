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

async function dump() {
  const supabase = getSupabaseAdminClient();

  // Tasks from tasks_store
  const { data: taskRecord } = await supabase.from('system_settings').select('*').eq('key', 'tasks_store').maybeSingle();
  const tasks = (taskRecord && Array.isArray(taskRecord.value)) ? taskRecord.value : [];

  // Audit Logs
  const { data: auditLogs } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });

  // Security Logs
  const { data: securityLogs } = await supabase.from('security_logs').select('*').order('created_at', { ascending: false });

  const outDir = path.resolve(process.cwd(), '.system_data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  fs.writeFileSync(path.join(outDir, 'dump_tasks.json'), JSON.stringify(tasks, null, 2));
  fs.writeFileSync(path.join(outDir, 'dump_audit_logs.json'), JSON.stringify(auditLogs || [], null, 2));
  fs.writeFileSync(path.join(outDir, 'dump_security_logs.json'), JSON.stringify(securityLogs || [], null, 2));

  console.log(`Dumped:`);
  console.log(`- Tasks: ${tasks.length}`);
  console.log(`- Audit Logs: ${auditLogs?.length}`);
  console.log(`- Security Logs: ${securityLogs?.length}`);
}

dump().catch(console.error);
