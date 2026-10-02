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
  const adminAuthUid = '6a89ced6-451d-422e-82e9-74d71e815eaf';
  const adminPublicUserId = '05cbe54d-7267-4b91-a006-b2c2ccc952f8';

  console.log('=== READ-ONLY LIVE DATABASE VERIFICATION ===\n');

  // 1. Verify auth.users row exists for Admin UID
  const { data: authUserRes, error: authErr } = await sb.auth.admin.getUserById(adminAuthUid);
  console.log('1. AUTH.USERS CHECK:');
  if (authErr) {
    console.log('   Error fetching auth user:', authErr.message);
  } else if (authUserRes?.user) {
    const u = authUserRes.user;
    console.log('   Found Auth User:');
    console.log('   - ID:', u.id);
    console.log('   - Email:', u.email);
    console.log('   - Confirmed:', Boolean(u.email_confirmed_at));
    console.log('   - Created At:', u.created_at);
    console.log('   - Updated At:', u.updated_at);
  } else {
    console.log('   No user found in auth.users for UID:', adminAuthUid);
  }

  // 2. Verify public.users row exists for auth_user_id = Admin UID
  console.log('\n2. PUBLIC.USERS CHECK:');
  const { data: publicUsers, error: pubErr } = await sb
    .from('users')
    .select('id, auth_user_id, email, full_name, is_active, created_at, updated_at')
    .eq('auth_user_id', adminAuthUid);

  if (pubErr) {
    console.log('   Error querying public.users:', pubErr.message);
  } else {
    console.log('   Rows found matching auth_user_id:', publicUsers?.length);
    publicUsers?.forEach((pu) => {
      console.log('   - ID:', pu.id);
      console.log('   - auth_user_id:', pu.auth_user_id);
      console.log('   - Email:', pu.email);
      console.log('   - is_active:', pu.is_active);
      console.log('   - ID matches expected adminPublicUserId (05cbe54d...)?', pu.id === adminPublicUserId);
    });
  }

  // Also check if public.users has any other row with ID = adminPublicUserId
  const { data: userById, error: idErr } = await sb
    .from('users')
    .select('id, auth_user_id, email, is_active')
    .eq('id', adminPublicUserId);
  console.log('   Direct lookup by public.users.id:', userById, idErr ? idErr.message : '');

  // 3. Verify public.user_credentials row exists for Admin public.users.id
  console.log('\n3. PUBLIC.USER_CREDENTIALS CHECK:');
  const { data: creds, error: credErr } = await sb
    .from('user_credentials')
    .select('id, user_id, password_hash, failed_attempts, locked_until, session_version, must_change_password, updated_at')
    .eq('user_id', adminPublicUserId);

  if (credErr) {
    console.log('   Error querying user_credentials:', credErr.message);
  } else if (!creds || creds.length === 0) {
    console.log('   No credential row found for user_id:', adminPublicUserId);
  } else {
    console.log('   Credential rows found:', creds.length);
    const c = creds[0];
    const hash = c.password_hash;
    
    // 4. Verify password_hash is non-null
    console.log('   - Credential ID:', c.id);
    console.log('   - User ID:', c.user_id);
    console.log('   - Password hash is non-null:', Boolean(hash));
    
    // 5. Verify hash length/prefix only; NEVER print the actual password hash
    console.log('   - Hash length:', hash ? hash.length : 0);
    console.log('   - Hash prefix (first 7 chars):', hash ? hash.substring(0, 7) : 'null');
    console.log('   - Is valid bcrypt format ($2a$/$2b$/$2y$):', /^\$2[aby]\$\d{2}\$/.test(hash ? hash.substring(0, 7) : ''));

    // Check if the hash matches the Step 5 fallback hash
    const fallbackHash = '$2b$10$nzHHNrMFzRGrzcT36DBhd.P5yIPq7OQOCaOcVqd3Wcx0GRnncVcHS';
    console.log('   - Is hash still equal to Step 5 fallback hash?', hash === fallbackHash);

    // 7. Verify failed_attempts and locked_until
    console.log('   - failed_attempts:', c.failed_attempts);
    console.log('   - locked_until:', c.locked_until);
    console.log('   - session_version:', c.session_version);
    console.log('   - must_change_password:', c.must_change_password);
    console.log('   - updated_at:', c.updated_at);
  }
}

main().catch(console.error);
