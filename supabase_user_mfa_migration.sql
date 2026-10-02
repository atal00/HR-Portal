-- ==============================================================================
-- VARSAKA HR DOCUMENT & VERIFICATION PORTAL
-- PRODUCTION-GRADE TOTP AUTHENTICATOR MFA SCHEMA MIGRATION
-- Table: public.user_mfa
-- ==============================================================================
-- IMPORTANT SAFETY & COMPLIANCE RULES:
-- 1. DO NOT execute this file automatically in production.
-- 2. Validate thoroughly before running in Supabase SQL Editor.
-- 3. RLS is explicitly ENABLED.
-- 4. Direct access from anon and authenticated roles is STRICTLY REVOKED.
-- 5. Only server-side service_role and postgres superuser have access.
-- 6. Existing user data (public.users, user_credentials, etc.) is NEVER modified.
-- ==============================================================================

-- 1. Create public.user_mfa table
CREATE TABLE IF NOT EXISTS public.user_mfa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    method TEXT NOT NULL DEFAULT 'totp',
    secret_encrypted TEXT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    recovery_codes_hashes TEXT[] NOT NULL DEFAULT '{}',
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    last_used_at TIMESTAMPTZ NULL,
    current_challenge_nonce TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure column exists if table was previously created
ALTER TABLE public.user_mfa ADD COLUMN IF NOT EXISTS current_challenge_nonce TEXT NULL;

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_mfa ENABLE ROW LEVEL SECURITY;

-- 3. Revoke all permissions from anon, authenticated, and public
REVOKE ALL ON TABLE public.user_mfa FROM PUBLIC;
REVOKE ALL ON TABLE public.user_mfa FROM anon;
REVOKE ALL ON TABLE public.user_mfa FROM authenticated;

-- 4. Grant access strictly to server-side service_role and postgres
GRANT ALL ON TABLE public.user_mfa TO service_role;
GRANT ALL ON TABLE public.user_mfa TO postgres;

-- 5. Add explicit service_role bypass policy
DROP POLICY IF EXISTS user_mfa_service_role_policy ON public.user_mfa;
CREATE POLICY user_mfa_service_role_policy
    ON public.user_mfa
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.user_mfa IS 'Authoritative storage for TOTP MFA secrets (AES-256-GCM encrypted) and single-use recovery code hashes.';
