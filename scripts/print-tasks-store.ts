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

async function printTasksStore() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .eq('key', 'tasks_store')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('EXACT_TASKS_STORE_JSON_START');
  console.log(JSON.stringify(data.value, null, 2));
  console.log('EXACT_TASKS_STORE_JSON_END');
}

printTasksStore().catch(console.error);
