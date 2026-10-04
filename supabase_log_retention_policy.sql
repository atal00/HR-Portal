-- ==============================================================================
-- VARSAKA HR PORTAL — ARCHIVED / DEPRECATED SQL REFERENCE
-- [DEPRECATED] DO NOT APPLY TO ACTIVE RUNTIME
--
-- Notice: pg_cron is not installed or enabled in the live Supabase project.
-- The authoritative production log retention architecture is the Single
-- Authoritative Throttled Retention Engine implemented in:
--   - Engine: db.logRetention.executePolicy(7) in src/lib/db.ts
--   - Trigger: POST /api/internal/retention (protected by CRON_SECRET)
--   - Telemetry: public.system_settings ('log_retention_status')
--   - Scheduler: vercel.json cron (0 2 * * *) / Server cron
--
-- This SQL file is retained for reference only and must not be used to configure
-- duplicate or competing database-level cron workers.
-- ==============================================================================

-- 1. Ensure timestamp indexes exist for optimal targeted deletion performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_logs_created ON public.security_logs(created_at DESC);

-- 2. Create the targeted retention purge function
CREATE OR REPLACE FUNCTION public.purge_expired_audit_and_security_logs(
  p_retention_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_claims JSONB;
  v_caller_role TEXT;
  v_cutoff TIMESTAMPTZ;
  v_audit_deleted INT := 0;
  v_sec_deleted INT := 0;
BEGIN
  -- Strict Authorization Defense-in-Depth:
  -- Only service_role, postgres, or supabase_admin can execute this function.
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := NULL;
  END;

  v_caller_role := COALESCE(v_jwt_claims->>'role', current_user);

  IF v_caller_role NOT IN ('service_role', 'postgres', 'supabase_admin') AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ACCESS: purge_expired_audit_and_security_logs can only be invoked by service_role.';
  END IF;

  -- Ensure valid positive retention days
  IF p_retention_days < 1 THEN
    RAISE EXCEPTION 'INVALID_ARGUMENT: Retention period must be at least 1 day.';
  END IF;

  -- Database UTC time calculation: NOW() - retention interval
  v_cutoff := NOW() - (p_retention_days || ' days')::INTERVAL;

  -- Targeted DELETE operations ONLY (NEVER TRUNCATE)
  WITH deleted_audit AS (
    DELETE FROM public.audit_logs
    WHERE created_at < v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_audit_deleted FROM deleted_audit;

  WITH deleted_security AS (
    DELETE FROM public.security_logs
    WHERE created_at < v_cutoff
    RETURNING id
  )
  SELECT count(*) INTO v_sec_deleted FROM deleted_security;

  RETURN jsonb_build_object(
    'success', true,
    'policy', '7_DAY_ROLLING_RETENTION',
    'retention_days', p_retention_days,
    'cutoff_timestamp', v_cutoff,
    'audit_logs_deleted', v_audit_deleted,
    'security_logs_deleted', v_sec_deleted,
    'executed_at', NOW()
  );
END;
$$;

-- 3. Restrict permissions
REVOKE ALL ON FUNCTION public.purge_expired_audit_and_security_logs(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_expired_audit_and_security_logs(INT) FROM anon;
REVOKE ALL ON FUNCTION public.purge_expired_audit_and_security_logs(INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_audit_and_security_logs(INT) TO service_role;

COMMENT ON FUNCTION public.purge_expired_audit_and_security_logs(INT) IS
'Automatically purges audit_logs and security_logs older than 7 days based on database UTC timestamp (created_at). Strictly touches no other tables.';

-- 4. Automatically schedule via pg_cron if the extension is enabled in Supabase
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unschedule existing job if already registered to guarantee idempotency
    BEGIN
      PERFORM cron.unschedule('daily-7day-log-retention');
    EXCEPTION WHEN OTHERS THEN
      -- Job does not exist yet; proceed
    END;

    -- Schedule daily cleanup at 02:00 UTC
    PERFORM cron.schedule(
      'daily-7day-log-retention',
      '0 2 * * *',
      'SELECT public.purge_expired_audit_and_security_logs(7);'
    );
  END IF;
END $$;
