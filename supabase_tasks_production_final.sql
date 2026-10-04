-- ==============================================================================
-- VARSAKA HR PORTAL — FINAL PRODUCTION TASKS MIGRATION
-- File: supabase_tasks_production_final.sql
-- Target: public.tasks & system_settings.tasks_store backfill
--
-- STATUS: PROPOSED FOR DBA / HUMAN REVIEW — UNEXECUTED
-- DO NOT RUN IN CI/CD OR DEV AUTOMATION WITHOUT EXPLICIT DBA CONFIRMATION.
--
-- STRICT INVARIANTS ENFORCED:
-- 1. ZERO DATA LOSS & ZERO REGRESSION:
--    - Creates public.tasks table idempotently (IF NOT EXISTS).
--    - Preserves exact 2 legitimate operational tasks currently in fallback tasks_store.
--    - ZERO test/QA tasks migrated (no Aditi Sharma, no Test Delete Recipient, no purge tests).
--    - system_settings.tasks_store is left 100% UNTOUCHED as an archival safety net.
--
-- 2. RBAC & ROW-LEVEL SECURITY (RLS) HARDENING:
--    - Strict RLS enabled with explicit policies for Super Admin, Assignee, and Creator.
--    - Full integration with public.is_super_admin() and public.has_permission().
--    - Anonymous (anon) and public access strictly REVOKED.
--    - service_role granted unrestricted backend access.
--
-- 3. EMPLOYEE ATOMIC PURGE COMPATIBILITY:
--    - Schema matches public.permanent_purge_employee() RPC requirements.
--    - Supports: UPDATE public.tasks SET document_id = NULL WHERE document_id = ANY(...)
--    - Supports: DELETE FROM public.tasks WHERE employee_id = $1
--    - Satisfies to_regclass('public.tasks') IS NOT NULL prerequisite.
--
-- 4. NON-DESTRUCTIVE & FULLY IDEMPOTENT:
--    - No DROP, TRUNCATE, or ALTER on existing tables.
--    - Safe to re-run multiple times without duplicate keys or schema conflicts.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. MATERIALIZE public.tasks TABLE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to UUID NOT NULL,
    created_by UUID NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' 
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    status VARCHAR(20) NOT NULL DEFAULT 'TODO' 
        CHECK (status IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED')),
    due_date TIMESTAMPTZ,
    employee_id UUID,
    document_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Explicit Foreign Key Constraints matching PostgREST join aliases in db.ts:
    -- (assigned_user:users!tasks_assigned_to_fkey, created_user:users!tasks_created_by_fkey)
    CONSTRAINT tasks_assigned_to_fkey 
        FOREIGN KEY (assigned_to) 
        REFERENCES public.users(id) 
        ON DELETE RESTRICT,
        
    CONSTRAINT tasks_created_by_fkey 
        FOREIGN KEY (created_by) 
        REFERENCES public.users(id) 
        ON DELETE RESTRICT,
        
    CONSTRAINT tasks_employee_id_fkey 
        FOREIGN KEY (employee_id) 
        REFERENCES public.employees(id) 
        ON DELETE SET NULL,
        
    CONSTRAINT tasks_document_id_fkey 
        FOREIGN KEY (document_id) 
        REFERENCES public.documents(id) 
        ON DELETE SET NULL
);

-- Documentation comments on catalog
COMMENT ON TABLE public.tasks IS 'Internal HR operational workflow tasks and document verification queue.';
COMMENT ON COLUMN public.tasks.id IS 'Primary key UUID for the task record.';
COMMENT ON COLUMN public.tasks.title IS 'Summary task title.';
COMMENT ON COLUMN public.tasks.description IS 'Detailed task instructions or notes.';
COMMENT ON COLUMN public.tasks.assigned_to IS 'Target public.users ID assigned to complete the task.';
COMMENT ON COLUMN public.tasks.created_by IS 'Creator public.users ID who initiated the task.';
COMMENT ON COLUMN public.tasks.priority IS 'Priority level: LOW, MEDIUM, HIGH, URGENT.';
COMMENT ON COLUMN public.tasks.status IS 'Workflow lifecycle: TODO, IN_PROGRESS, BLOCKED, COMPLETED, CANCELLED.';
COMMENT ON COLUMN public.tasks.due_date IS 'Optional deadline timestamp for task resolution.';
COMMENT ON COLUMN public.tasks.employee_id IS 'Optional linked employee record for HR onboarding/offboarding tasks.';
COMMENT ON COLUMN public.tasks.document_id IS 'Optional linked document for verification/signature tasks.';


-- ------------------------------------------------------------------------------
-- 2. HIGH-PERFORMANCE INDEXES
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to 
    ON public.tasks(assigned_to);

CREATE INDEX IF NOT EXISTS idx_tasks_created_by 
    ON public.tasks(created_by);

CREATE INDEX IF NOT EXISTS idx_tasks_status 
    ON public.tasks(status);

CREATE INDEX IF NOT EXISTS idx_tasks_priority 
    ON public.tasks(priority);

CREATE INDEX IF NOT EXISTS idx_tasks_employee_id 
    ON public.tasks(employee_id) 
    WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_document_id 
    ON public.tasks(document_id) 
    WHERE document_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_created_at_desc 
    ON public.tasks(created_at DESC);


-- ------------------------------------------------------------------------------
-- 3. ROW-LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- ------------------------------------------------------------------------------

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- 3.1 Super Admin Unrestricted Policy
DROP POLICY IF EXISTS "tasks_super_admin_all" ON public.tasks;
CREATE POLICY "tasks_super_admin_all" ON public.tasks
    FOR ALL
    TO authenticated
    USING (public.is_super_admin(public.current_app_user_id()))
    WITH CHECK (public.is_super_admin(public.current_app_user_id()));

-- 3.2 Select Policy: Assignee, Creator, or Authorized Personnel
DROP POLICY IF EXISTS "tasks_select_policy" ON public.tasks;
CREATE POLICY "tasks_select_policy" ON public.tasks
    FOR SELECT
    TO authenticated
    USING (
        assigned_to = public.current_app_user_id() OR
        created_by = public.current_app_user_id() OR
        public.has_permission(public.current_app_user_id(), 'task.view') OR
        public.has_permission(public.current_app_user_id(), 'employee.view')
    );

-- 3.3 Insert Policy: Creator Must Be Current User with task.create or Super Admin
DROP POLICY IF EXISTS "tasks_insert_policy" ON public.tasks;
CREATE POLICY "tasks_insert_policy" ON public.tasks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        created_by = public.current_app_user_id() AND (
            public.has_permission(public.current_app_user_id(), 'task.create') OR
            public.is_super_admin(public.current_app_user_id())
        )
    );

-- 3.4 Update Policy: Assignee, Creator, or Super Admin
DROP POLICY IF EXISTS "tasks_update_policy" ON public.tasks;
CREATE POLICY "tasks_update_policy" ON public.tasks
    FOR UPDATE
    TO authenticated
    USING (
        assigned_to = public.current_app_user_id() OR
        created_by = public.current_app_user_id() OR
        public.is_super_admin(public.current_app_user_id())
    )
    WITH CHECK (
        assigned_to = public.current_app_user_id() OR
        created_by = public.current_app_user_id() OR
        public.is_super_admin(public.current_app_user_id())
    );

-- 3.5 Delete Policy: Creator with task.delete Permission or Super Admin
DROP POLICY IF EXISTS "tasks_delete_policy" ON public.tasks;
CREATE POLICY "tasks_delete_policy" ON public.tasks
    FOR DELETE
    TO authenticated
    USING (
        (created_by = public.current_app_user_id() AND public.has_permission(public.current_app_user_id(), 'task.delete')) OR
        public.is_super_admin(public.current_app_user_id())
    );

-- 3.6 Strict Access Grants Defense-in-Depth
REVOKE ALL ON TABLE public.tasks FROM anon;
REVOKE ALL ON TABLE public.tasks FROM public;
GRANT ALL ON TABLE public.tasks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tasks TO authenticated;


-- ------------------------------------------------------------------------------
-- 4. CONTROLLED BACKFILL OF CONFIRMED LEGITIMATE OPERATIONAL TASKS
-- ------------------------------------------------------------------------------
-- Strictly backfills ONLY the two verified canonical administrative tasks:
-- Task 1: "Self-Assigned Security Audit Review" (ID: 3c58b957-d4b5-4f92-a3fc-f77d7770cd28)
-- Task 2: "Verify Engineering Relieving Credentials" (ID: ed9a09f1-c6ba-4515-8233-275b442e4c43)
--
-- Safety Guarantees:
-- - Hard-coded canonical UUIDs prevent importation of ANY test/QA remnants.
-- - Validates that Super Administrator ('05cbe54d-7267-4b91-a006-b2c2ccc952f8') exists in public.users.
-- - Uses ON CONFLICT (id) DO NOTHING for idempotent execution.
-- - system_settings.tasks_store remains untouched as an archival fallback.

DO $$
DECLARE
    v_admin_id CONSTANT UUID := '05cbe54d-7267-4b91-a006-b2c2ccc952f8'::UUID;
    v_backfilled_count INT := 0;
BEGIN
    -- 1. Precondition Check: Super Administrator must exist in public.users
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_admin_id) THEN
        RAISE EXCEPTION 'PRECONDITION_FAILED: Target Super Administrator % does not exist in public.users.', v_admin_id;
    END IF;

    -- 2. Backfill Canonical Task 1: "Self-Assigned Security Audit Review"
    INSERT INTO public.tasks (
        id,
        title,
        description,
        assigned_to,
        created_by,
        priority,
        status,
        due_date,
        employee_id,
        document_id,
        created_at,
        updated_at
    )
    VALUES (
        '3c58b957-d4b5-4f92-a3fc-f77d7770cd28'::UUID,
        'Self-Assigned Security Audit Review',
        NULL,
        v_admin_id,
        v_admin_id,
        'URGENT',
        'TODO',
        NULL,
        NULL,
        NULL,
        '2026-10-03T17:01:15.006Z'::TIMESTAMPTZ,
        '2026-10-03T17:01:15.006Z'::TIMESTAMPTZ
    )
    ON CONFLICT (id) DO NOTHING;

    -- 3. Backfill Canonical Task 2: "Verify Engineering Relieving Credentials"
    INSERT INTO public.tasks (
        id,
        title,
        description,
        assigned_to,
        created_by,
        priority,
        status,
        due_date,
        employee_id,
        document_id,
        created_at,
        updated_at
    )
    VALUES (
        'ed9a09f1-c6ba-4515-8233-275b442e4c43'::UUID,
        'Verify Engineering Relieving Credentials',
        'Check certificate against central registry for batch 2026',
        v_admin_id,
        v_admin_id,
        'HIGH',
        'COMPLETED',
        NULL,
        NULL,
        NULL,
        '2026-10-03T17:01:13.746Z'::TIMESTAMPTZ,
        '2026-10-03T17:01:17.960Z'::TIMESTAMPTZ
    )
    ON CONFLICT (id) DO NOTHING;

    -- 4. Post-Backfill Integrity Audit
    SELECT COUNT(*) INTO v_backfilled_count
    FROM public.tasks
    WHERE id IN (
        '3c58b957-d4b5-4f92-a3fc-f77d7770cd28'::UUID,
        'ed9a09f1-c6ba-4515-8233-275b442e4c43'::UUID
    );

    IF v_backfilled_count < 2 THEN
        RAISE EXCEPTION 'POSTCONDITION_FAILED: Expected 2 tasks in public.tasks, found %.', v_backfilled_count;
    END IF;

    RAISE NOTICE 'SUCCESS: public.tasks successfully created, RLS enforced, and 2 legitimate tasks backfilled.';
END $$;


-- ------------------------------------------------------------------------------
-- 5. RELOAD POSTGREST SCHEMA CACHE
-- ------------------------------------------------------------------------------
-- Instructs PostgREST to refresh its schema cache immediately so that the
-- application's native queries to public.tasks succeed without waiting for TTL.
NOTIFY pgrst, 'reload schema';

COMMIT;
