/**
 * Supabase Client Integration Layer
 * 
 * Provides authenticated client instances for PostgreSQL database,
 * Row Level Security (RLS) enforcement, and private storage buckets.
 * 
 * SECURITY RULES:
 * 1. SUPABASE_SERVICE_ROLE_KEY is SERVER-ONLY and must NEVER be exposed to browser bundles.
 * 2. In production (NODE_ENV === 'production' or STORAGE_MODE === 'supabase'), missing
 *    or placeholder Supabase credentials immediately throw a fatal error.
 *    Silent fallback to local JSON is strictly forbidden in production.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

export function getSupabaseAnonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
}

export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return false;
  if (
    url.includes('placeholder') ||
    url.includes('your-project-id') ||
    anonKey.includes('your-supabase') ||
    anonKey.includes('placeholder') ||
    anonKey.trim() === ''
  ) {
    return false;
  }
  return true;
}

export function isProductionEnv(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.STORAGE_MODE === 'supabase' ||
    process.env.NEXT_PUBLIC_APP_URL?.includes('varsaka.com') === true
  );
}

// Client-safe anonymous Supabase client (respects RLS)
let publicClient: SupabaseClient | null = null;
export function getSupabaseClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!isSupabaseConfigured() || !url || !anonKey) {
    if (isProductionEnv()) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: Production environment requires valid Supabase credentials (NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_PUBLISHABLE_KEY). Placeholder or missing keys are prohibited in production.'
      );
    }
    throw new Error('Supabase client is not configured with live credentials.');
  }

  if (!publicClient) {
    publicClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return publicClient;
}

// Server-only administrative Supabase client (Service Role - bypasses RLS for system operations)
let adminClient: SupabaseClient | null = null;
export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('CRITICAL SECURITY VIOLATION: getSupabaseAdminClient() called from client bundle!');
  }

  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!isSupabaseConfigured() || !url || !serviceRoleKey || serviceRoleKey.includes('placeholder') || serviceRoleKey.trim() === '') {
    if (isProductionEnv()) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: Production environment requires SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY. Refusing fallback in production.'
      );
    }
    throw new Error('Supabase Admin client is not configured with live credentials.');
  }

  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return adminClient;
}
