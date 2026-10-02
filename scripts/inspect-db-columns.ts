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

  // 1. Inspect public.users columns & values
  const { data: userData, error: uErr } = await sb
    .from('users')
    .select('*')
    .eq('id', '05cbe54d-7267-4b91-a006-b2c2ccc952f8');

  console.log('--- PUBLIC.USERS FOR ADMIN ---');
  if (userData && userData[0]) {
    const u = { ...userData[0] };
    if ('password_hash' in u) {
      console.log('password_hash in public.users:', Boolean(u.password_hash), 'length:', u.password_hash?.length);
      delete u.password_hash;
    }
    console.log('User fields:', Object.keys(userData[0]));
    console.log('User data (sanitized):', u);
  } else {
    console.log('No user found!', uErr);
  }

  // 2. Inspect public.user_credentials for admin
  const { data: credData, error: cErr } = await sb
    .from('user_credentials')
    .select('*')
    .eq('user_id', '05cbe54d-7267-4b91-a006-b2c2ccc952f8');

  console.log('\n--- PUBLIC.USER_CREDENTIALS FOR ADMIN ---');
  if (credData && credData[0]) {
    const c = credData[0];
    const hash = c.password_hash;
    console.log('Credentials fields:', Object.keys(c));
    console.log('Credential metadata:', {
      id: c.id,
      user_id: c.user_id,
      hash_exists: Boolean(hash),
      hash_length: hash ? hash.length : 0,
      hash_prefix: hash ? hash.substring(0, 7) : null,
      failed_attempts: c.failed_attempts,
      locked_until: c.locked_until,
      session_version: c.session_version,
      must_change_password: c.must_change_password,
      temp_password_expires_at: c.temp_password_expires_at,
      created_at: c.created_at,
      updated_at: c.updated_at,
    });

    // Check if the hash matches the fallback hash in migration step 5
    const fallbackHash = '$2b$10$nzHHNrMFzRGrzcT36DBhd.P5yIPq7OQOCaOcVqd3Wcx0GRnncVcHS';
    console.log('Is hash EQUAL to migration step 5 fallback hash?', hash === fallbackHash);
  } else {
    console.log('No credentials found!', cErr);
  }
}

main().catch(console.error);
