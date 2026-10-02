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

async function main() {
  const admin = getSupabaseAdminClient();
  const { data: users, error: uErr } = await admin.from('users').select('id, email, full_name, is_active');
  console.log('USERS IN DB (count=' + (users?.length || 0) + '):', users, uErr);

  const { data: settings, error: sErr } = await admin.from('system_settings').select('key, value').like('key', 'user_meta_%');
  console.log('USER META SETTINGS IN DB:', settings?.map(s => ({
    key: s.key,
    has_hash: !!s.value?.password_hash,
    hash_prefix: s.value?.password_hash?.substring(0, 10),
    must_change: s.value?.must_change_password
  })), sErr);

  const { data: creds, error: cErr } = await admin.from('user_credentials').select('*').limit(5);
  console.log('USER_CREDENTIALS:', { creds, cErr });
}

main().catch(console.error);
