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

async function probeTasks() {
  console.log('Probing supabase.from("tasks").select("*")...');
  const res1 = await supabase.from('tasks').select('*');
  console.log('res1 (select *):', {
    hasData: !!res1.data,
    dataLen: res1.data?.length,
    error: res1.error,
  });

  const res2 = await supabase.from('tasks').select('id', { count: 'exact', head: true }).limit(0);
  console.log('res2 (select id head:true):', {
    count: res2.count,
    error: res2.error,
  });

  // Also check if public.tasks is a table in information_schema or if there's any RPC to check to_regclass
  // Note: We MUST NOT mutate! We only do read-only probe.
}

probeTasks().catch(console.error);
