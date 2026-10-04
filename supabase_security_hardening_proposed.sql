-- ==============================================================================
-- VARSAKA HR DOCUMENT & VERIFICATION PORTAL
-- PROPOSED SUPABASE PRODUCTION SECURITY HARDENING SCRIPT
-- File: supabase_security_hardening_proposed.sql
-- ==============================================================================
-- ⚠️ IMPORTANT NOTICE & SAFETY WARNING:
-- THIS SCRIPT IS STRICTLY FOR HUMAN REVIEW AND EVALUATION.
-- DO NOT EXECUTE AUTOMATICALLY VIA CI/CD OR UNATTENDED SCRIPTS.
--
-- This script contains the complete, non-destructive proposed database hardening
-- statements identified during the Supabase Production Security Audit.
-- Every statement has been designed with defensive idempotent guards
-- (IF EXISTS / IF NOT EXISTS) and least-privilege security principles.
--
-- TARGET DATABASE: Supabase PostgreSQL (Production)
-- EXECUTION STATUS: PROPOSED ONLY — UNEXECUTED
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- SECTION 1: SEARCH PATH HARDENING FOR TRIGGER & SECURITY DEFINER FUNCTIONS
-- ==============================================================================
-- Finding: protect_super_admin_role() and protect_super_admin_user() were created
-- without an explicit "SET search_path = public, pg_temp;", posing a search path
-- manipulation risk if triggered in privileged sessions.

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

-- Re-attach triggers idempotently
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
-- SECTION 2: STORAGE RLS HARDENING (hr-documents and hr-assets)
-- ==============================================================================
-- Finding: Storage buckets "hr-documents" and "hr-assets" allowed anonymous
-- listing calls via PostgREST/Storage API because bucket-specific RLS policies
-- were not yet active on storage.objects.

-- 2.1 Ensure RLS is active on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2.2 Clean existing conflicting policies on storage.objects
DROP POLICY IF EXISTS "hr_documents_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "hr_documents_delete_policy" ON storage.objects;
DROP POLICY IF EXISTS "hr_assets_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "hr_assets_mutation_policy" ON storage.objects;
DROP POLICY IF EXISTS "storage_block_anon_access" ON storage.objects;

-- 2.3 Explicitly block anonymous role from any operations on private storage
CREATE POLICY "storage_block_anon_access" ON storage.objects
    FOR ALL
    TO anon
    USING (false)
    WITH CHECK (false);

-- 2.4 Least-Privilege Read Policy for "hr-documents"
-- Grants access ONLY to:
--   a) Super Administrators, OR
--   b) The employee who owns the document (resolved via employees.email = users.email), OR
--   c) Users with granular document download/view permissions for that specific document category.
CREATE POLICY "hr_documents_select_policy" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'hr-documents' AND (
            public.is_super_admin(public.current_app_user_id()) OR
            EXISTS (
                SELECT 1 
                FROM public.documents d
                JOIN public.employees e ON d.employee_id = e.id
                WHERE d.file_path = storage.objects.name
                  AND (
                    e.email = (
                        SELECT u.email 
                        FROM public.users u 
                        WHERE u.id = public.current_app_user_id()
                    ) OR
                    (d.document_type = 'SALARY_SLIP' AND (
                        public.has_permission(public.current_app_user_id(), 'salary.view') OR 
                        public.has_permission(public.current_app_user_id(), 'document.salary.download')
                    )) OR
                    (d.document_type = 'OFFER_LETTER' AND public.has_permission(public.current_app_user_id(), 'document.offer.download')) OR
                    (d.document_type = 'EXPERIENCE_LETTER' AND public.has_permission(public.current_app_user_id(), 'document.experience.download')) OR
                    (d.document_type = 'RELIEVING_LETTER' AND public.has_permission(public.current_app_user_id(), 'document.relieving.download')) OR
                    (d.document_type = 'CERTIFICATE' AND public.has_permission(public.current_app_user_id(), 'document.certificate.download'))
                  )
            )
        )
    );

-- 2.5 Authorized Creation / Upload Policy for "hr-documents"
CREATE POLICY "hr_documents_insert_policy" ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'hr-documents' AND (
            public.is_super_admin(public.current_app_user_id()) OR
            public.has_permission(public.current_app_user_id(), 'document.offer.create') OR
            public.has_permission(public.current_app_user_id(), 'document.experience.create') OR
            public.has_permission(public.current_app_user_id(), 'document.relieving.create') OR
            public.has_permission(public.current_app_user_id(), 'document.salary.create') OR
            public.has_permission(public.current_app_user_id(), 'document.certificate.create')
        )
    );

-- 2.6 Authorized Update Policy for "hr-documents"
CREATE POLICY "hr_documents_update_policy" ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'hr-documents' AND (
            public.is_super_admin(public.current_app_user_id()) OR
            public.has_permission(public.current_app_user_id(), 'document.approve') OR
            public.has_permission(public.current_app_user_id(), 'document.revoke')
        )
    );

-- 2.7 Super Admin Exclusive Deletion Policy for "hr-documents"
CREATE POLICY "hr_documents_delete_policy" ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'hr-documents' AND (
            public.is_super_admin(public.current_app_user_id())
        )
    );

-- 2.8 Policies for "hr-assets" (Logos, Signatures, Seals)
CREATE POLICY "hr_assets_select_policy" ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'hr-assets');

CREATE POLICY "hr_assets_mutation_policy" ON storage.objects
    FOR ALL
    TO authenticated
    USING (
        bucket_id = 'hr-assets' AND (
            public.is_super_admin(public.current_app_user_id()) OR
            public.has_permission(public.current_app_user_id(), 'template.update')
        )
    );

-- ==============================================================================
-- SECTION 3: AUDIT & TELEMETRY LOG INSERTION INTEGRITY HARDENING
-- ==============================================================================
-- Finding: audit_logs and security_logs insert policies used WITH CHECK (TRUE)
-- for authenticated users, which allows an authenticated client to spoof user_id
-- or inject fabricated audit entries directly via PostgREST.

DROP POLICY IF EXISTS audit_logs_insert_policy ON public.audit_logs;
CREATE POLICY audit_logs_insert_policy ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- User can only log events attributed to their own authenticated app user identity
        user_id IS NULL OR user_id = public.current_app_user_id()
    );

DROP POLICY IF EXISTS security_logs_insert_policy ON public.security_logs;
CREATE POLICY security_logs_insert_policy ON public.security_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id IS NULL OR user_id = public.current_app_user_id()
    );

-- Ensure verification_logs table allows insert for telemetry, but disallows update or delete
DROP POLICY IF EXISTS verification_logs_public_insert ON public.verification_logs;
CREATE POLICY verification_logs_public_insert ON public.verification_logs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

-- Prevent any modification or deletion of verification audit logs
REVOKE UPDATE, DELETE ON public.verification_logs FROM anon, authenticated, PUBLIC;

-- ==============================================================================
-- SECTION 4: POSTGRESQL DEFAULT PRIVILEGES & SCHEMA HARDENING
-- ==============================================================================
-- Finding: Default PostgreSQL privileges on the public schema permit object
-- creation by PUBLIC if not restricted.

-- Restrict public schema creation
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- Re-grant execute on safe helper functions to authenticated
GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated;

-- Ensure default privileges for future tables maintain least-privilege
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- ==============================================================================
-- SECTION 5: MATERIALIZATION OF TASKS & WORKFLOW TABLES
-- ==============================================================================
-- Finding: The "tasks", "user_permission_overrides", "certificate_access_requests",
-- and "employee_sequences" tables returned PGRST205 (schema cache missing / not created).

-- 5.1 Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(20) NOT NULL DEFAULT 'TODO' CHECK (status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')),
    due_date TIMESTAMPTZ,
    employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_super_admin_all" ON public.tasks;
CREATE POLICY "tasks_super_admin_all" ON public.tasks
    FOR ALL
    TO authenticated
    USING (public.is_super_admin(public.current_app_user_id()));

DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
CREATE POLICY "tasks_select_policy" ON public.tasks
    FOR SELECT
    TO authenticated
    USING (
        assigned_to = public.current_app_user_id() OR
        created_by = public.current_app_user_id() OR
        public.has_permission(public.current_app_user_id(), 'employee.view')
    );

DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
CREATE POLICY "tasks_insert_policy" ON public.tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = public.current_app_user_id()
    );

DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
CREATE POLICY "tasks_update_policy" ON public.tasks
    FOR UPDATE
    TO authenticated
    USING (
        assigned_to = public.current_app_user_id() OR
        created_by = public.current_app_user_id() OR
        public.is_super_admin(public.current_app_user_id())
    );

-- 5.2 User Permission Overrides Table
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    permission_code VARCHAR(100) NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT TRUE,
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_permission_override UNIQUE(user_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user ON public.user_permission_overrides(user_id);
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_permissions_super_admin_all" ON public.user_permission_overrides;
CREATE POLICY "user_permissions_super_admin_all" ON public.user_permission_overrides
    FOR ALL
    TO authenticated
    USING (public.is_super_admin(public.current_app_user_id()));

DROP POLICY IF EXISTS "user_permissions_read_own" ON public.user_permission_overrides;
CREATE POLICY "user_permissions_read_own" ON public.user_permission_overrides
    FOR SELECT
    TO authenticated
    USING (user_id = public.current_app_user_id());

-- 5.3 Certificate Access Requests Table
CREATE TABLE IF NOT EXISTS public.certificate_access_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    user_email TEXT NOT NULL,
    department TEXT,
    requested_permission TEXT NOT NULL DEFAULT 'document.certificate.create',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cert_req_user ON public.certificate_access_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_cert_req_status ON public.certificate_access_requests(status);
ALTER TABLE public.certificate_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cert_req_super_admin_all" ON public.certificate_access_requests;
CREATE POLICY "cert_req_super_admin_all" ON public.certificate_access_requests
    FOR ALL
    TO authenticated
    USING (public.is_super_admin(public.current_app_user_id()));

DROP POLICY IF EXISTS "cert_req_user_insert_own" ON public.certificate_access_requests;
CREATE POLICY "cert_req_user_insert_own" ON public.certificate_access_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = public.current_app_user_id());

DROP POLICY IF EXISTS "cert_req_user_view_own" ON public.certificate_access_requests;
CREATE POLICY "cert_req_user_view_own" ON public.certificate_access_requests
    FOR SELECT
    TO authenticated
    USING (user_id = public.current_app_user_id());

-- 5.4 Sequential Employee Sequence Tracker Table
CREATE TABLE IF NOT EXISTS public.employee_sequences (
    prefix VARCHAR(20) PRIMARY KEY,
    current_value INTEGER NOT NULL DEFAULT 1000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.employee_sequences (prefix, current_value)
VALUES ('EMP-VL', 1000)
ON CONFLICT (prefix) DO NOTHING;

ALTER TABLE public.employee_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_sequences_super_admin_all" ON public.employee_sequences;
CREATE POLICY "employee_sequences_super_admin_all" ON public.employee_sequences
    FOR ALL
    TO authenticated
    USING (
        public.is_super_admin(public.current_app_user_id()) OR
        public.has_permission(public.current_app_user_id(), 'employee.create')
    );

-- ==============================================================================
-- SECTION 6: RELOAD POSTGREST SCHEMA CACHE
-- ==============================================================================
NOTIFY pgrst, 'reload schema';

COMMIT;
-- ==============================================================================
-- END OF PROPOSED HARDENING SCRIPT
-- ==============================================================================
