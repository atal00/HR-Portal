-- ==============================================================================
-- VARSAKA HR PORTAL — PRODUCTION MIGRATION
-- Atomic Employee Permanent Purge (PostgreSQL Transaction-Safe RPC)
-- ==============================================================================

-- 1. Ensure is_system_protected column exists on public.employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_system_protected BOOLEAN DEFAULT FALSE;

-- 2. Create or replace the atomic purge function
CREATE OR REPLACE FUNCTION public.permanent_purge_employee(
  p_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp RECORD;
  v_draft_doc_ids UUID[];
  v_retained_docs_count INT;
  v_purged_code TEXT;
  v_purged_name TEXT;
  v_jwt_claims JSONB;
  v_caller_role TEXT;
BEGIN
  -- Strict Authorization Defense-in-Depth:
  -- The function must only be executable via service_role (the backend server API).
  -- Direct calls by regular end-users or anonymous clients are rejected at database level.
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_caller_role := COALESCE(v_jwt_claims->>'role', current_user);

  IF v_caller_role NOT IN ('service_role', 'postgres', 'supabase_admin') AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ACCESS: permanent_purge_employee can only be invoked by service_role.';
  END IF;

  -- 1. Row-level exclusive lock to prevent concurrent modification during purge
  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'EMPLOYEE_NOT_FOUND: Employee record % does not exist.', p_employee_id;
  END IF;

  -- 2. System-Protection Guard (Enforced inside the DB engine as defense-in-depth)
  -- Checks both employees.is_system_protected column (via JSON conversion) and system_settings metadata store
  IF COALESCE((to_jsonb(v_emp)->>'is_system_protected')::boolean, FALSE) = TRUE OR EXISTS (
    SELECT 1 FROM public.system_settings 
    WHERE key = 'emp_meta_' || p_employee_id::TEXT 
      AND (value->>'is_system_protected')::boolean = TRUE
  ) THEN
    RAISE EXCEPTION 'CRITICAL_SECURITY_VIOLATION: System-protected employee records cannot be permanently purged.';
  END IF;

  v_purged_code := v_emp.employee_id;
  v_purged_name := v_emp.full_name;

  -- 3. Materialized Tasks Table Prerequisite Check:
  -- Destructive purge must not silently skip or bypass operational tasks.
  -- The native public.tasks table must exist before employee purge can execute.
  IF to_regclass('public.tasks') IS NULL THEN
    RAISE EXCEPTION 'PRECONDITION_FAILED: Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.';
  END IF;

  -- 4. Document Legal Retention Guard:
  -- Official documents (APPROVED, FINAL, REVOKED) represent immutable statutory records.
  -- Official documents cannot be deleted and linked employees cannot be physically purged.
  SELECT COUNT(*) INTO v_retained_docs_count
  FROM public.documents
  WHERE employee_id = p_employee_id
    AND status::text IN ('APPROVED', 'FINAL', 'REVOKED');

  IF v_retained_docs_count > 0 THEN
    RAISE EXCEPTION 'LEGAL_RETENTION_VIOLATION: Employee purge is blocked: Employee % has % official document(s) in APPROVED, FINAL, or REVOKED status. Under statutory document retention rules, official documents cannot be deleted and linked employee records cannot be physically purged.', v_purged_code, v_retained_docs_count;
  END IF;

  -- 5. Gather only unapproved draft/pending document IDs owned by this employee
  SELECT COALESCE(ARRAY_AGG(id), '{}') INTO v_draft_doc_ids
  FROM public.documents
  WHERE employee_id = p_employee_id
    AND status::text NOT IN ('APPROVED', 'FINAL', 'REVOKED');

  -- 6. Execute cascading cleanup of draft documents in verified foreign key dependency order
  IF ARRAY_LENGTH(v_draft_doc_ids, 1) > 0 THEN
    -- Unlink verification logs for draft items if any
    UPDATE public.verification_logs
    SET document_id = NULL
    WHERE document_id = ANY(v_draft_doc_ids);

    -- Unlink tasks referencing these draft documents
    EXECUTE 'UPDATE public.tasks SET document_id = NULL WHERE document_id = ANY($1)' USING v_draft_doc_ids;

    -- Delete document versions & approvals for draft documents
    DELETE FROM public.document_versions
    WHERE document_id = ANY(v_draft_doc_ids);

    DELETE FROM public.approvals
    WHERE document_id = ANY(v_draft_doc_ids);

    -- Delete draft documents
    DELETE FROM public.documents
    WHERE id = ANY(v_draft_doc_ids);
  END IF;

  -- 7. Delete employee-owned salary record
  DELETE FROM public.employee_salary
  WHERE employee_id = p_employee_id;

  -- 8. Delete operational tasks assigned to or created for the employee
  EXECUTE 'DELETE FROM public.tasks WHERE employee_id = $1' USING p_employee_id;

  -- 9. Delete employee metadata in system_settings key-value store
  DELETE FROM public.system_settings
  WHERE key = 'emp_meta_' || p_employee_id::TEXT;

  -- 10. Permanently delete employee master record
  DELETE FROM public.employees
  WHERE id = p_employee_id;

  -- ATOMICITY GUARANTEE:
  -- PL/pgSQL executes inside the caller's transaction context.
  -- Any exception will cause PostgreSQL to automatically abort the entire
  -- transaction, rolling back all deletions and leaving the database 100% intact.

  RETURN jsonb_build_object(
    'success', true,
    'purged_id', p_employee_id::TEXT,
    'employee_id', v_purged_code,
    'full_name', v_purged_name,
    'purged_at', NOW()
  );
END;
$$;

-- 3. SECURITY DEFINER HARDENING & ACCESS CONTROL
-- Revoke all execution privileges from public, anonymous, and standard authenticated users
REVOKE ALL ON FUNCTION public.permanent_purge_employee(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.permanent_purge_employee(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.permanent_purge_employee(UUID) FROM authenticated;

-- Grant execute EXCLUSIVELY to service_role (Used by authenticated server-side API only)
GRANT EXECUTE ON FUNCTION public.permanent_purge_employee(UUID) TO service_role;

COMMENT ON FUNCTION public.permanent_purge_employee(UUID) IS
'Atomic permanent purge of an employee and their dependent operational records with full transactional rollback. Strictly restricted to service_role execution.';

-- 4. IMMEDIATELY RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
