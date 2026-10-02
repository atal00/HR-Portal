-- ==============================================================================
-- VARSAKA HR PORTAL — PRODUCTION MIGRATION
-- Authoritative Dedicated User Credentials Schema & Migration
-- ==============================================================================

-- 1. Create dedicated user_credentials table
CREATE TABLE IF NOT EXISTS public.user_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    password_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    session_version INTEGER NOT NULL DEFAULT 1,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    temp_password_expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes for high-performance lookup and lockout verification
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_credentials_user_id ON public.user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_locked_until ON public.user_credentials(locked_until);

-- 3. Row Level Security & Access Hardening
-- Passwords hashes must NEVER be exposed over client queries or anonymous connections
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_credentials FROM PUBLIC;
REVOKE ALL ON TABLE public.user_credentials FROM anon;
REVOKE ALL ON TABLE public.user_credentials FROM authenticated;

-- Grant execution privileges exclusively to trusted backend server-side processes
GRANT ALL ON TABLE public.user_credentials TO service_role;
GRANT ALL ON TABLE public.user_credentials TO postgres;

-- 4. Migrate legitimate existing password hashes from system_settings user_meta
INSERT INTO public.user_credentials (
    user_id,
    password_hash,
    must_change_password,
    temp_password_expires_at,
    session_version,
    created_at,
    updated_at
)
SELECT 
    u.id AS user_id,
    s.value->>'password_hash' AS password_hash,
    COALESCE((s.value->>'must_change_password')::boolean, FALSE) AS must_change_password,
    CASE 
        WHEN s.value->>'temp_password_expires_at' IS NOT NULL AND s.value->>'temp_password_expires_at' != 'null'
        THEN (s.value->>'temp_password_expires_at')::timestamptz 
        ELSE NULL 
    END AS temp_password_expires_at,
    1 AS session_version,
    NOW(),
    NOW()
FROM public.system_settings s
JOIN public.users u ON u.id = SUBSTRING(s.key FROM 11)::uuid
WHERE s.key LIKE 'user_meta_%'
  AND s.value->>'password_hash' IS NOT NULL
  AND LENGTH(s.value->>'password_hash') > 15
ON CONFLICT (user_id) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    must_change_password = EXCLUDED.must_change_password,
    temp_password_expires_at = EXCLUDED.temp_password_expires_at,
    updated_at = NOW();

-- 5. Ensure All Active Users Have an Authoritative Credential Record
-- Default fallback hash for active users without an existing hash: 'Varsaka@Secured2026!'
-- ($2b$10$nzHHNrMFzRGrzcT36DBhd.P5yIPq7OQOCaOcVqd3Wcx0GRnncVcHS)
INSERT INTO public.user_credentials (
    user_id,
    password_hash,
    must_change_password,
    session_version,
    created_at,
    updated_at
)
SELECT 
    u.id,
    '$2b$10$nzHHNrMFzRGrzcT36DBhd.P5yIPq7OQOCaOcVqd3Wcx0GRnncVcHS',
    CASE WHEN u.email IN ('admin@in.varsaka.com', 'admin@varsaka.com') THEN FALSE ELSE TRUE END,
    1,
    NOW(),
    NOW()
FROM public.users u
LEFT JOIN public.user_credentials uc ON uc.user_id = u.id
WHERE u.is_active = TRUE AND uc.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 6. Clean up password_hash from system_settings user_meta records
-- Completely eliminates legacy password credentials from metadata storage
UPDATE public.system_settings
SET value = value - 'password_hash'
WHERE key LIKE 'user_meta_%'
  AND value ? 'password_hash';

-- 7. Immediately reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- MIGRATION VERIFICATION QUERIES
-- Run the following queries to verify the migration status:
-- ==============================================================================

-- Verification 1: Verify Table Structure and Row Counts
SELECT 
    (SELECT COUNT(*) FROM public.users) AS total_users,
    (SELECT COUNT(*) FROM public.users WHERE is_active = TRUE) AS active_users,
    (SELECT COUNT(*) FROM public.user_credentials) AS total_credentials,
    (SELECT COUNT(*) FROM public.system_settings WHERE key LIKE 'user_meta_%' AND value ? 'password_hash') AS legacy_hashes_remaining;

-- Verification 2: Verify Every Active User Has a Credential
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.is_active,
    (uc.id IS NOT NULL) AS has_credential,
    uc.session_version,
    uc.failed_attempts,
    uc.must_change_password
FROM public.users u
LEFT JOIN public.user_credentials uc ON uc.user_id = u.id
ORDER BY u.created_at ASC;

-- Verification 3: Confirm Legacy System Settings Has NO Password Hashes
SELECT key, value 
FROM public.system_settings 
WHERE key LIKE 'user_meta_%' AND value ? 'password_hash';
