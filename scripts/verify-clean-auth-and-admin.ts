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

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

async function verify() {
  const supabase = getSupabaseAdminClient();
  let passed = 0;
  let failed = 0;

  function check(condition: boolean, title: string, details?: any) {
    if (condition) {
      console.log(`${GREEN}✅ PASS:${RESET} ${title}`);
      if (details) console.log(`   ${JSON.stringify(details)}`);
      passed++;
    } else {
      console.error(`${RED}❌ FAIL:${RESET} ${title}`);
      if (details) console.error(`   ${JSON.stringify(details)}`);
      failed++;
    }
  }

  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   DATABASE VERIFICATION: AUTH CLEANUP & ADMIN SYNC             ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // A. Auth users
  const { data: authData } = await supabase.auth.admin.listUsers();
  const authUsers = authData?.users || [];
  check(
    authUsers.length === 1 &&
      authUsers[0].id === '6a89ced6-451d-422e-82e9-74d71e815eaf' &&
      authUsers[0].email === 'admin@in.varsaka.com',
    'A. Exactly ONE Auth user exists: 6a89ced6-451d-422e-82e9-74d71e815eaf (admin@in.varsaka.com)',
    authUsers.map((u) => ({ id: u.id, email: u.email }))
  );

  // B. Application users
  const { data: users } = await supabase.from('users').select('*');
  const appUsers = users || [];
  check(
    appUsers.length === 1 && appUsers[0].email === 'admin@in.varsaka.com',
    'B. Exactly ONE login/application user exists in public.users: admin@in.varsaka.com',
    appUsers.map((u) => ({ id: u.id, email: u.email, is_active: u.is_active, auth_user_id: u.auth_user_id }))
  );

  // C. Credentials
  const { data: creds } = await supabase.from('user_credentials').select('*');
  const credentials = creds || [];
  check(
    credentials.length === 1 && credentials[0].user_id === appUsers[0]?.id,
    'C. Exactly ONE credential row exists, belonging strictly to the Admin',
    credentials.map((c) => ({
      id: c.id,
      user_id: c.user_id,
      session_version: c.session_version,
      has_hash: Boolean(c.password_hash),
    }))
  );

  // D. Admin linkage
  check(
    appUsers[0]?.auth_user_id === authUsers[0]?.id &&
      appUsers[0]?.auth_user_id === '6a89ced6-451d-422e-82e9-74d71e815eaf',
    'D. Admin Linkage: auth.users.id === public.users.auth_user_id (6a89ced6-451d-422e-82e9-74d71e815eaf)',
    { auth_id: authUsers[0]?.id, app_auth_id: appUsers[0]?.auth_user_id }
  );

  // E. Admin active status
  check(
    appUsers[0]?.is_active === true,
    'E. Admin active status: public.users.is_active === true',
    { is_active: appUsers[0]?.is_active }
  );

  // F. Admin credential exists
  check(
    credentials.length > 0 && credentials[0].user_id === appUsers[0]?.id,
    'F. Admin credential exists in public.user_credentials',
    { credential_user_id: credentials[0]?.user_id, app_user_id: appUsers[0]?.id }
  );

  // G. No legacy password hashes remain
  const { data: metaHashes } = await supabase
    .from('system_settings')
    .select('key, value')
    .like('key', 'user_meta_%');
  const remainingLegacyHashes = (metaHashes || []).filter((m) => m.value && m.value.password_hash);
  check(
    remainingLegacyHashes.length === 0,
    'G. No legacy password hashes remain in system_settings',
    { legacy_hashes_count: remainingLegacyHashes.length }
  );

  // H. No duplicate Admin accounts exist
  const adminAuthDuplicates = authUsers.filter((u) => u.email?.toLowerCase().includes('admin'));
  const adminAppDuplicates = appUsers.filter((u) => u.email?.toLowerCase().includes('admin'));
  check(
    adminAuthDuplicates.length === 1 && adminAppDuplicates.length === 1,
    'H. No duplicate Admin accounts exist (exactly 1 in auth.users and 1 in public.users)',
    { auth_count: adminAuthDuplicates.length, app_count: adminAppDuplicates.length }
  );

  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${passed === 8 ? GREEN : RED}VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  if (failed > 0) process.exit(1);
}

verify().catch((err) => {
  console.error('Error running verification:', err);
  process.exit(1);
});
