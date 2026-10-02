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

import { db } from '../src/lib/db';
import { getSupabaseAdminClient } from '../src/lib/supabase';

async function main() {
  const adminUserId = '05cbe54d-7267-4b91-a006-b2c2ccc952f8';
  console.log(`Clearing temporary lock state for Admin: ${adminUserId}...`);
  await db.userCredentials.resetFailedAttempts(adminUserId);

  const sb = getSupabaseAdminClient();
  const { data, error } = await sb
    .from('user_credentials')
    .select('id, user_id, failed_attempts, locked_until, session_version, must_change_password')
    .eq('user_id', adminUserId)
    .single();

  if (error) {
    console.error('Error fetching user_credentials:', error);
  } else {
    console.log('Successfully cleared lock state. Current metadata:', data);
  }
}

main().catch(console.error);
