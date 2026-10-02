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

import { getSupabaseAdminClient } from '../src/lib/supabase';

async function main() {
  const sb = getSupabaseAdminClient();

  console.log('=== USERS IN public.users ===');
  const { data: users, error: uErr } = await sb
    .from('users')
    .select('id, email, full_name, is_active, created_at');
  if (uErr) console.error('Error fetching users:', uErr);
  console.log('Users found:', users?.length);
  users?.forEach(u => console.log(` - ID: ${u.id}, Email: ${u.email}, Active: ${u.is_active}`));

  console.log('\n=== USER_META IN public.system_settings ===');
  const { data: metas, error: mErr } = await sb
    .from('system_settings')
    .select('key, value, description, updated_at')
    .like('key', 'user_meta_%');
  if (mErr) console.error('Error fetching metas:', mErr);
  console.log('User metas found:', metas?.length);
  metas?.forEach(m => {
    const v: any = m.value;
    console.log(` - Key: ${m.key}`);
    console.log(`   Has password_hash: ${!!v?.password_hash}, Hash preview: ${v?.password_hash ? v.password_hash.substring(0, 15) + '...' : 'none'}`);
    console.log(`   must_change_password: ${v?.must_change_password}, temp_expires: ${v?.temp_password_expires_at}`);
  });

  console.log('\n=== CHECK IF public.user_credentials EXISTS ===');
  const { data: creds, error: cErr } = await sb
    .from('user_credentials')
    .select('*')
    .limit(1);
  if (cErr) {
    console.log('user_credentials check:', cErr.code, cErr.message);
  } else {
    console.log('user_credentials exists! Sample:', creds);
  }
}

main().catch(console.error);
