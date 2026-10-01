-- ==============================================================================
-- DEVELOPMENT ONLY — NEVER RUN AGAINST PRODUCTION!
-- ==============================================================================
--
-- WARNING: This script drops all tables, types, and data in the public schema.
-- It is designed strictly for local development environments and test sandbox resets.
--
-- NEVER EXECUTE THIS SCRIPT AGAINST 'varsaka-hr-production' OR ANY PRODUCTION ENVIRONMENT.
--
-- ==============================================================================

-- 1. Drop all application tables with CASCADE
DROP TABLE IF EXISTS verification_logs CASCADE;
DROP TABLE IF EXISTS security_logs CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS approvals CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS template_versions CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS employee_salary CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;

-- 2. Drop triggers and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
DROP FUNCTION IF EXISTS public.current_app_user_id();
DROP FUNCTION IF EXISTS public.has_permission(UUID, VARCHAR);
DROP FUNCTION IF EXISTS public.is_super_admin(UUID);

-- 3. Drop custom enums
DROP TYPE IF EXISTS document_status_enum CASCADE;
DROP TYPE IF EXISTS template_status_enum CASCADE;
DROP TYPE IF EXISTS document_type_enum CASCADE;
DROP TYPE IF EXISTS employee_status CASCADE;

-- Notice to Developer
DO $$ BEGIN
    RAISE NOTICE 'Development database clean teardown completed successfully. Execute supabase_schema.production.sql to rebuild schema.';
END $$;
