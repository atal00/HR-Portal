-- ==============================================================================
-- VARSAKA HR DOCUMENT & VERIFICATION PORTAL
-- SUPABASE PRODUCTION SECURITY HARDENING — FINAL REFINED SCRIPT
-- File: supabase_security_hardening_final_review.sql
-- ==============================================================================
-- ⚠️ IMPORTANT NOTICE & SAFETY WARNING:
-- THIS SCRIPT IS STRICTLY FOR HUMAN REVIEW AND EVALUATION.
-- DO NOT EXECUTE AUTOMATICALLY VIA CI/CD OR UNATTENDED SCRIPTS.
--
-- REFINED SCOPE:
-- This script contains EXCLUSIVELY true security hardening statements.
-- All feature schema migrations (tasks, overrides, cert requests, sequences)
-- have been REMOVED and DEFERRED to separate feature release cycles.
--
-- ARCHITECTURAL INTEGRITY:
-- This script PRESERVES the server-side mediated Supabase Storage architecture:
--   Browser -> Next.js API Route -> RBAC -> Service Role -> Private Storage
-- It does NOT broaden direct browser/authenticated client access to storage buckets.
--
-- SAFETY ASSURANCES:
-- - ZERO DROP TABLE statements
-- - ZERO TRUNCATE statements
-- - ZERO DELETE statements
-- - ZERO mass UPDATE statements
-- - ZERO unexpected INSERT statements
-- - ZERO feature migrations
-- - ZERO permission broadening
-- - ZERO salary access broadening
-- - ZERO document access broadening
-- - ZERO RBAC bypasses
--
-- TARGET DATABASE: Supabase PostgreSQL (Production)
-- EXECUTION STATUS: PROPOSED ONLY — UNEXECUTED
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SECTION 1: SEARCH PATH HARDENING FOR TRIGGER & SECURITY DEFINER FUNCTIONS
-- ==============================================================================
-- Finding: Functions protect_super_admin_role() and protect_super_admin_user()
-- were defined without explicit "SET search_path = public, pg_temp;".
-- In PostgreSQL, trigger functions executing without a pinned search_path are
-- vulnerable to search-path hijacking attacks in privileged sessions.
--
-- Remediation: Recreate both functions with explicit search_path and SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS TRIGGER AS $$
DECLARE
    target_email TEXT;
BEGIN
    SELECT email INTO target_email FROM public.users WHERE id = OLD.user_id;
    IF target_email = 'admin@varsaka.com' THEN
        RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Cannot delete or downgrade role for protected Super Administrator (admin@varsaka.com)';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.protect_super_admin_user()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.email = 'admin@varsaka.com' THEN
        IF NEW.is_active = FALSE THEN
            RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Cannot deactivate protected Super Administrator (admin@varsaka.com)';
        END IF;
        IF NEW.deletion_status IS NOT NULL AND NEW.deletion_status != 'NONE' THEN
            RAISE EXCEPTION 'CRITICAL SECURITY VIOLATION: Cannot delete protected Super Administrator (admin@varsaka.com)';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Idempotently bind triggers to target tables
DROP TRIGGER IF EXISTS trg_protect_super_admin_role ON public.user_roles;
CREATE TRIGGER trg_protect_super_admin_role
    BEFORE DELETE OR UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_super_admin_role();

DROP TRIGGER IF EXISTS trg_protect_super_admin_user ON public.users;
CREATE TRIGGER trg_protect_super_admin_user
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_super_admin_user();

-- ==============================================================================
-- SECTION 2: AUDIT & TELEMETRY LOG INSERTION INTEGRITY HARDENING
-- ==============================================================================
-- Finding: audit_logs and security_logs RLS policies used "WITH CHECK (TRUE)"
-- for authenticated users. This allowed an authenticated client connecting
-- directly via PostgREST to spoof the user_id field.
--
-- Remediation: Tighten the WITH CHECK clause so an authenticated user can ONLY
-- insert log entries where user_id matches their own app identity or is NULL.
-- Note: Server-side logging in Next.js uses the service_role client, which bypasses
-- RLS and remains completely unaffected.

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id IS NULL OR user_id = public.current_app_user_id()
    );

DROP POLICY IF EXISTS security_logs_insert_policy ON public.security_logs;
CREATE POLICY security_logs_insert_policy ON public.security_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id IS NULL OR user_id = public.current_app_user_id()
    );

-- ==============================================================================
-- SECTION 3: POSTGRESQL DEFAULT PRIVILEGE & PUBLIC SCHEMA HARDENING
-- ==============================================================================
-- Finding: Standard PostgreSQL configurations grant CREATE on schema public to PUBLIC.
-- Remediation: Revoke CREATE on schema public from PUBLIC to prevent unauthorized
-- schema pollution. Legitimate administrative migrations run under the postgres role
-- and are unaffected.

REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- ==============================================================================
-- SECTION 4: STORAGE HARDENING — PRESERVING SERVER-ONLY ARCHITECTURE
-- ==============================================================================
-- Finding: Anonymous listing calls (anon.storage.from('hr-documents').list(''))
-- returned HTTP 200 OK because storage.objects lacked an explicit denial policy
-- for the anon role.
--
-- Architectural Principle:
-- The Varsaka HR Portal architecture NEVER performs direct browser-to-storage operations.
-- All uploads, downloads, and signed URL generations occur server-side:
--   Browser -> Next.js API (/api/documents/[id]/download) -> RBAC -> Service Role -> Storage
--
-- Remediation:
-- 1. Ensure RLS is active on storage.objects.
-- 2. Explicitly DENY all operations by role 'anon' on storage.objects.
-- 3. DO NOT grant direct client 'authenticated' policies. Direct client operations
--    remain blocked.
-- 4. The server-side service_role client possesses PostgreSQL BYPASSRLS and retains
--    uninterrupted access to upload documents and generate time-limited signed URLs.

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "storage_block_anon_access" ON storage.objects;
CREATE POLICY "storage_block_anon_access" ON storage.objects
    FOR ALL
    TO anon
    USING (false)
    WITH CHECK (false);

-- ==============================================================================
-- SECTION 5: RELOAD POSTGREST SCHEMA CACHE
-- ==============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ==============================================================================
-- END OF FINAL SECURITY HARDENING SCRIPT
-- ==============================================================================
