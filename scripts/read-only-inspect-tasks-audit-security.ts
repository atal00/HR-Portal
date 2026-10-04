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

  console.log('================================================================');
  console.log('READ-ONLY INSPECTION: TASKS, AUDIT LOGS, AND SECURITY LOGS');
  console.log('================================================================\n');

  // 1. TASKS
  console.log('--- 1. TASKS STORE ---');
  const { data: taskRecord, error: tErr } = await supabase
    .from('system_settings')
    .select('*')
    .eq('key', 'tasks_store')
    .maybeSingle();

  if (tErr) console.error('Error fetching tasks_store:', tErr);
  const tasks: any[] = (taskRecord && Array.isArray(taskRecord.value)) ? taskRecord.value : [];
  console.log(`Total Tasks in tasks_store: ${tasks.length}`);
  tasks.forEach((t, i) => {
    console.log(`[Task ${i + 1}] ID: ${t.id} | Title: "${t.title}" | Status: ${t.status} | Priority: ${t.priority} | Created: ${t.created_at} | CreatedBy: ${t.created_by} | AssignedTo: ${t.assigned_to} | EmpID: ${t.employee_id} | DocID: ${t.document_id} | Desc: "${t.description || ''}"`);
  });

  // Check if native tasks table has anything
  const { data: nativeTasks, error: ntErr } = await supabase.from('tasks').select('*');
  if (ntErr) {
    console.log(`Native 'tasks' table status: ${ntErr.code} (${ntErr.message})`);
  } else {
    console.log(`Native 'tasks' table count: ${nativeTasks?.length}`);
  }

  // 2. AUDIT LOGS
  console.log('\n--- 2. AUDIT LOGS ---');
  const { data: auditLogs, error: aErr, count: auditCount } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (aErr) console.error('Error fetching audit_logs:', aErr);
  console.log(`Total Audit Logs in public.audit_logs: ${auditLogs?.length} (count: ${auditCount})`);
  auditLogs?.forEach((a, i) => {
    console.log(`[Audit ${i + 1}] ID: ${a.id} | Action: ${a.action} | User: ${a.user_email || a.user_id} | Resource: ${a.resource_type}:${a.resource_id} | Date: ${a.created_at} | IP: ${a.ip_address} | Meta: ${JSON.stringify(a.metadata)}`);
  });

  // 3. SECURITY LOGS
  console.log('\n--- 3. SECURITY LOGS ---');
  const { data: secLogs, error: sErr, count: secCount } = await supabase
    .from('security_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (sErr) console.error('Error fetching security_logs:', sErr);
  console.log(`Total Security Logs in public.security_logs: ${secLogs?.length} (count: ${secCount})`);
  secLogs?.forEach((s, i) => {
    console.log(`[Security ${i + 1}] ID: ${s.id} | EventType: ${s.event_type} | Severity: ${s.severity} | User: ${s.user_id} | Date: ${s.created_at} | IP: ${s.ip_address} | Desc: "${s.description}" | Meta: ${JSON.stringify(s.metadata)}`);
  });
}

main().catch(console.error);
