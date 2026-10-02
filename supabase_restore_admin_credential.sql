-- ==============================================================================
-- VARSAKA HR PORTAL — RESTORE ADMIN CREDENTIAL FROM AUTH.USERS
-- Synchronize the authentic pre-migration password hash from Supabase Auth
-- into the authoritative public.user_credentials table.
-- ==============================================================================

-- 1. Update public.user_credentials with the real Bcrypt hash from auth.users
UPDATE public.user_credentials uc
SET 
    password_hash = au.encrypted_password,
    password_updated_at = NOW(),
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = NOW()
FROM auth.users au
JOIN public.users u ON u.auth_user_id = au.id
WHERE uc.user_id = u.id
  AND au.id = '6a89ced6-451d-422e-82e9-74d71e815eaf';

-- 2. Notify PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 3. Verification Query (Safe metadata inspection — does NOT expose plaintext)
SELECT 
    uc.id AS credential_id,
    uc.user_id,
    u.email AS user_email,
    au.email AS auth_email,
    LENGTH(uc.password_hash) AS hash_length,
    SUBSTRING(uc.password_hash FROM 1 FOR 7) AS hash_prefix,
    uc.failed_attempts,
    uc.locked_until,
    (uc.password_hash = au.encrypted_password) AS hash_restored_from_auth_users
FROM public.user_credentials uc
JOIN public.users u ON u.id = uc.user_id
JOIN auth.users au ON au.id = u.auth_user_id
WHERE au.id = '6a89ced6-451d-422e-82e9-74d71e815eaf';
