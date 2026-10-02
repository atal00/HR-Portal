-- ==============================================================================
-- VARSAKA LABS - HR DOCUMENT MANAGEMENT & VERIFICATION PORTAL
-- Production Hardening & Workflow Expansion Schema Migration
-- (DO NOT EXECUTE AUTOMATICALLY - STRICTLY FOR MANUAL ADMIN RUN)
-- ==============================================================================

-- 1. Employee Lifecycle & Deletion Workflow Extensions
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_status VARCHAR(30) DEFAULT 'NONE';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS deletion_approved_at TIMESTAMPTZ;

-- 2. Employee Financial & Statutory Attributes
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pf_number VARCHAR(50);

-- Also add to employee_salary for payroll-bound storage
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20);
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100);
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50);
ALTER TABLE public.employee_salary ADD COLUMN IF NOT EXISTS pf_number VARCHAR(50);

-- 3. System User Directory & Governance Extensions
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_status VARCHAR(30) DEFAULT 'NONE';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 4. Granular Explicit User Permission Overrides Table
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    permission_code VARCHAR(100) NOT NULL,
    is_granted BOOLEAN NOT NULL DEFAULT TRUE, -- TRUE = explicit grant, FALSE = explicit denial
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
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
            AND r.code = 'SUPER_ADMIN'
        )
    );

DROP POLICY IF EXISTS "user_permissions_read_own" ON public.user_permission_overrides;
CREATE POLICY "user_permissions_read_own" ON public.user_permission_overrides
    FOR SELECT
    TO authenticated
    USING (
        user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- 5. Certificate Access Requests Table
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
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
            AND r.code = 'SUPER_ADMIN'
        )
    );

DROP POLICY IF EXISTS "cert_req_user_insert_own" ON public.certificate_access_requests;
CREATE POLICY "cert_req_user_insert_own" ON public.certificate_access_requests
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

DROP POLICY IF EXISTS "cert_req_user_view_own" ON public.certificate_access_requests;
CREATE POLICY "cert_req_user_view_own" ON public.certificate_access_requests
    FOR SELECT
    TO authenticated
    USING (
        user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
    );

-- 6. Sequential Employee Sequence Tracker Table
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
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
            AND r.code IN ('SUPER_ADMIN', 'HR_ADMIN')
        )
    );

-- 7. Database-Level Protection for Super Administrator Account & Role
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_super_admin_role ON public.user_roles;
CREATE TRIGGER trg_protect_super_admin_role
    BEFORE DELETE OR UPDATE ON public.user_roles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_super_admin_role();

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_super_admin_user ON public.users;
CREATE TRIGGER trg_protect_super_admin_user
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_super_admin_user();
