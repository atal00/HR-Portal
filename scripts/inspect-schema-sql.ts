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

async function main() {
  const supabase = getSupabaseAdminClient();

  // 1. Check document_versions columns
  // Insert a dummy then rollback or inspect
  // Or check if we can select columns from information_schema
  const { data: cols, error: colsErr } = await supabase
    .from('document_versions')
    .select('*')
    .limit(0);
  console.log('document_versions select test:', { cols, colsErr });

  // 2. Check all tables by inspecting migrations in the repo
  console.log('Inspecting local migrations for foreign keys...');
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir);
    for (const f of files) {
      if (f.endsWith('.sql')) {
        const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf-8');
        console.log(`\n--- MIGRATION: ${f} ---`);
        const lines = sql.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes('foreign key') || line.toLowerCase().includes('references') || line.toLowerCase().includes('create table')) {
            console.log(line.trim());
          }
        }
      }
    }
  }

  // 3. Check root sql files
  const rootFiles = fs.readdirSync(process.cwd());
  for (const f of rootFiles) {
    if (f.endsWith('.sql')) {
      const sql = fs.readFileSync(path.join(process.cwd(), f), 'utf-8');
      console.log(`\n--- ROOT SQL: ${f} ---`);
      const lines = sql.split('\n');
      for (const line of lines) {
        if (line.toLowerCase().includes('foreign key') || line.toLowerCase().includes('references') || line.toLowerCase().includes('create table')) {
          console.log(line.trim());
        }
      }
    }
  }

  process.exit(0);
}

main().catch(console.error);
