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

async function updateAdminAuthEmail() {
  const supabase = getSupabaseAdminClient();
  const targetUid = '6a89ced6-451d-422e-82e9-74d71e815eaf';
  const targetEmail = 'admin@in.varsaka.com';

  console.log(`Updating auth.users UID ${targetUid} to ${targetEmail}...`);

  const { data, error } = await supabase.auth.admin.updateUserById(targetUid, {
    email: targetEmail,
    email_confirm: true,
  });

  if (error) {
    console.error('Failed to update Supabase Auth email:', error);
    process.exit(1);
  }

  console.log('Update successful! Result:');
  console.log({
    id: data.user.id,
    email: data.user.email,
    email_confirmed_at: data.user.email_confirmed_at,
    updated_at: data.user.updated_at,
  });
}

updateAdminAuthEmail().catch(console.error);
