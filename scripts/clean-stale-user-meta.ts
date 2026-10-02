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

async function cleanStaleMeta() {
  const supabase = getSupabaseAdminClient();
  const staleKeys = [
    'user_meta_c373de57-953e-4f77-80ec-2d8ec7225dc5',
    'user_meta_42789fb0-ff87-4c09-8b31-bc4dc8971d9d',
    'user_meta_a4709903-8763-40e4-ba28-d448e397752b',
    'user_meta_574d60a5-2f40-4931-a79e-2053a0869fb3',
  ];

  console.log('Cleaning up stale user_meta keys from system_settings:', staleKeys);
  const { error } = await supabase
    .from('system_settings')
    .delete()
    .in('key', staleKeys);

  if (error) {
    console.error('Error cleaning stale user_meta:', error);
  } else {
    console.log('Successfully cleaned up stale user_meta keys.');
  }

  const { data: remainingMeta } = await supabase
    .from('system_settings')
    .select('key')
    .like('key', 'user_meta_%');
  console.log('Remaining user_meta keys in system_settings:', remainingMeta);
}

cleanStaleMeta().catch(console.error);
