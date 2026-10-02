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

async function checkUserRoles() {
  const supabase = getSupabaseAdminClient();
  const { data: userRoles, error: urErr } = await supabase
    .from('user_roles')
    .select('user_id, role_id, roles(id, code, name)');
  console.log('user_roles:', { count: userRoles?.length, userRoles, urErr });

  const { data: roles } = await supabase.from('roles').select('*');
  console.log('roles available:', roles?.map(r => ({ id: r.id, code: r.code })));

  // Check if any user_permission_overrides table exists
  const { data: overrides, error: ovErr } = await supabase.from('user_permission_overrides').select('*');
  console.log('user_permission_overrides:', { count: overrides?.length, ovErr });
}

checkUserRoles().catch(console.error);
