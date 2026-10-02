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

async function inspect() {
  const supabase = getSupabaseAdminClient();

  console.log('--- 1. AUTH.USERS ---');
  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
  if (authErr) {
    console.error('Error listing auth.users:', authErr);
  } else {
    console.log(`Total auth.users: ${authData.users.length}`);
    authData.users.forEach((u) => {
      console.log(`- ID: ${u.id}, Email: ${u.email}, Confirmed: ${u.email_confirmed_at ? 'YES' : 'NO'}, Created: ${u.created_at}`);
    });
  }

  console.log('\n--- 2. PUBLIC.USERS ---');
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id, auth_user_id, email, full_name, is_active, created_at');
  if (usersErr) {
    console.error('Error listing public.users:', usersErr);
  } else {
    console.log(`Total public.users: ${users?.length}`);
    users?.forEach((u) => {
      console.log(`- ID: ${u.id}, auth_user_id: ${u.auth_user_id}, Email: ${u.email}, Active: ${u.is_active}, Name: ${u.full_name}`);
    });
  }

  console.log('\n--- 3. PUBLIC.USER_CREDENTIALS ---');
  const { data: creds, error: credsErr } = await supabase
    .from('user_credentials')
    .select('id, user_id, session_version, must_change_password, failed_attempts, created_at, updated_at');
  if (credsErr) {
    console.error('Error listing user_credentials:', credsErr);
  } else {
    console.log(`Total user_credentials: ${creds?.length}`);
    creds?.forEach((c) => {
      console.log(`- ID: ${c.id}, user_id: ${c.user_id}, session_version: ${c.session_version}, must_change: ${c.must_change_password}`);
    });
  }

  console.log('\n--- 4. PUBLIC.USER_ROLES ---');
  const { data: userRoles, error: userRolesErr } = await supabase
    .from('user_roles')
    .select('id, user_id, role_id, roles(code, name)');
  if (userRolesErr) {
    console.error('Error listing user_roles:', userRolesErr);
  } else {
    console.log(`Total user_roles: ${userRoles?.length}`);
    userRoles?.forEach((ur) => {
      console.log(`- ID: ${ur.id}, user_id: ${ur.user_id}, role: ${(ur.roles as any)?.code}`);
    });
  }

  console.log('\n--- 5. SYSTEM_SETTINGS (user_meta) ---');
  const { data: meta, error: metaErr } = await supabase
    .from('system_settings')
    .select('key, value')
    .like('key', 'user_meta_%');
  if (metaErr) {
    console.error('Error listing user_meta:', metaErr);
  } else {
    console.log(`Total user_meta settings: ${meta?.length}`);
    meta?.forEach((m) => {
      console.log(`- Key: ${m.key}, has_password_hash: ${Boolean(m.value?.password_hash)}`);
    });
  }
}

inspect().catch(console.error);
