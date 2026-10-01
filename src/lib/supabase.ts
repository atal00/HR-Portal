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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  if (
    supabaseUrl.includes('placeholder') ||
    supabaseUrl.includes('your-project-id') ||
    supabaseAnonKey.includes('your-supabase') ||
    supabaseAnonKey.includes('placeholder')
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
  if (!isSupabaseConfigured()) {
    if (isProductionEnv()) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: Production environment requires valid Supabase credentials (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY). Placeholder or missing keys are prohibited in production.'
      );
    }
    throw new Error('Supabase client is not configured with live credentials.');
  }

  if (!publicClient) {
    publicClient = createClient(supabaseUrl!, supabaseAnonKey!, {
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

  if (!isSupabaseConfigured() || !supabaseServiceRoleKey || supabaseServiceRoleKey.includes('placeholder')) {
    if (isProductionEnv()) {
      throw new Error(
        'FATAL CONFIGURATION ERROR: Production environment requires SUPABASE_SERVICE_ROLE_KEY. Refusing fallback in production.'
      );
    }
    throw new Error('Supabase Admin client is not configured with live credentials.');
  }

  if (!adminClient) {
    adminClient = createClient(supabaseUrl!, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return adminClient;
}
