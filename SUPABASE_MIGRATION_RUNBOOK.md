# SUPABASE PRODUCTION MIGRATION RUNBOOK
## Varsaka HR Document Management & Verification Portal

**Target Supabase Project:** `varsaka-hr-production`  
**Canonical Repository Path:** `D:\19.Website\HR_Portal`  
**Migration Artifact:** `supabase_schema.production.sql`  
**Status:** **READY FOR HUMAN REVIEW (Pre-Execution Verification Completed)**

---

## 1. PRE-MIGRATION BACKUP & SAFETY CHECK

Before applying any migration to the production instance:
1. Log in to the [Supabase Management Console](https://supabase.com/dashboard).
2. Select the `varsaka-hr-production` project.
3. Navigate to **Project Settings** → **Database** → **Backups**.
4. Confirm automated backups are enabled and create an on-demand snapshot if available.
5. Verify that `D:\19.Website\Varsaka` is completely detached and untouched:
   ```bash
   cd D:\19.Website\Varsaka
   git status
   # Expected: On branch main, working tree clean
   ```

---

## 2. TARGET PROJECT VERIFICATION

Confirm project identity in Supabase CLI or SQL Editor:
```sql
SELECT current_database(), current_user, version();
```
* **Expected Database Name:** `postgres`
* **Target Project ID:** Verify project URL corresponds to `varsaka-hr-production`.
* **Table Pre-Check:** Confirm the public schema has zero pre-existing application tables:
  ```sql
  SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
  ```

---

## 3. PRODUCTION MIGRATION EXECUTION

Apply the non-destructive production schema:
1. Open the Supabase SQL Editor for `varsaka-hr-production`.
2. Load the contents of [supabase_schema.production.sql](file:///d:/19.Website/HR_Portal/supabase_schema.production.sql).
3. Review the SQL query in the editor window.
4. Execute the script.
5. Verify all 17 tables are created:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
   **Expected Tables:**
   * `approvals`
   * `audit_logs`
   * `departments`
   * `document_versions`
   * `documents`
   * `employee_salary`
   * `employees`
   * `permissions`
   * `role_permissions`
   * `roles`
   * `security_logs`
   * `system_settings`
   * `template_versions`
   * `templates`
   * `user_roles`
   * `users`
   * `verification_logs`

---

## 4. AUTHENTICATION USER SYNCHRONIZATION BOOTSTRAP

The migration includes an automated event trigger `on_auth_user_created` which automatically creates a matching `public.users` row when a user authenticates in Supabase Auth.

To create the primary administrator:
1. In the Supabase Dashboard, navigate to **Authentication** → **Users**.
2. Click **Add User** → **Create User**.
3. Enter the corporate administrator email (e.g., `admin@varsaka.com`) and a strong temporary password.
4. Confirm user creation.
5. Verify that the auth trigger successfully populated `public.users`:
   ```sql
   SELECT id, email, full_name, auth_user_id, is_active 
   FROM public.users 
   WHERE email = 'admin@varsaka.com';
   ```

---

## 5. SUPER ADMIN ROLE ASSIGNMENT

Once `public.users` contains the administrator record, assign the `SUPER_ADMIN` system role:
```sql
INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id 
FROM public.users u, public.roles r
WHERE u.email = 'admin@varsaka.com' 
  AND r.code = 'SUPER_ADMIN'
ON CONFLICT (user_id, role_id) DO NOTHING;
```

Verify assignment:
```sql
SELECT u.email, r.code AS role_code, r.name AS role_name
FROM public.users u
JOIN public.user_roles ur ON u.id = ur.user_id
JOIN public.roles r ON ur.role_id = r.id
WHERE u.email = 'admin@varsaka.com';
```
* **Expected Result:** `admin@varsaka.com | SUPER_ADMIN | Super Administrator`

---

## 6. ROW LEVEL SECURITY (RLS) VERIFICATION

Verify RLS is active on all 17 public tables:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
```
* **Required Result:** Every table must display `rowsecurity = true`.

Verify helper functions are hardened:
```sql
SELECT proname, prosecdef, proconfig 
FROM pg_proc 
WHERE proname IN ('current_app_user_id', 'has_permission', 'is_super_admin', 'handle_new_auth_user');
```
* **Required Result:** `prosecdef = true` and `proconfig = {search_path=public,pg_temp}` for all 4 functions.

---

## 7. RELIEVING LETTER & ENUM INTEGRITY VERIFICATION

1. Verify `document_type_enum` contains all 5 supported types:
   ```sql
   SELECT enumlabel 
   FROM pg_enum 
   JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
   WHERE pg_type.typname = 'document_type_enum' 
   ORDER BY enumsortorder;
   ```
   **Expected Enum Values:**
   * `OFFER_LETTER`
   * `EXPERIENCE_LETTER`
   * `RELIEVING_LETTER`
   * `SALARY_SLIP`
   * `CERTIFICATE`

2. Verify Relieving Letter permissions in the system:
   ```sql
   SELECT code, name, module 
   FROM public.permissions 
   WHERE code LIKE 'document.relieving.%';
   ```
   **Expected Permissions:**
   * `document.relieving.create`
   * `document.relieving.view`
   * `document.relieving.download`
   * `document.relieving.approve`

3. Verify role mappings:
   ```sql
   SELECT r.code, p.code 
   FROM public.roles r
   JOIN public.role_permissions rp ON r.id = rp.role_id
   JOIN public.permissions p ON rp.permission_id = p.id
   WHERE p.code LIKE 'document.relieving.%'
   ORDER BY r.code, p.code;
   ```
   * **`SUPER_ADMIN`:** All 4 permissions
   * **`HR_ADMIN`:** All 4 permissions
   * **`DOCUMENT_ADMIN`:** All 4 permissions
   * **`VIEWER`:** `document.relieving.view` only
   * **`PAYROLL_ADMIN`:** 0 permissions (excluded by design)

---

## 8. SALARY ISOLATION VERIFICATION

Verify non-payroll access restrictions:
1. Query `employee_salary` policy definition:
   ```sql
   SELECT policyname, qual 
   FROM pg_policies 
   WHERE tablename = 'employee_salary';
   ```
   * Must contain `salary.view` and `salary.update` checks exclusively.
2. Confirm `documents_select_policy` restricts `SALARY_SLIP`:
   ```sql
   SELECT policyname, qual 
   FROM pg_policies 
   WHERE tablename = 'documents' AND policyname = 'documents_select_policy';
   ```
   * Must require `salary.view` or `document.salary.view` for `document_type = 'SALARY_SLIP'`.
   * Must NOT contain `employee.view`.

---

## 9. STORAGE BUCKET CONFIGURATION

If document PDFs are stored in Supabase Storage:
1. In the Supabase Console, navigate to **Storage** → **Buckets**.
2. Create private bucket: `hr-documents`.
3. Set **Public Bucket** to `OFF`.
4. Configure bucket RLS policies restricting file downloads to authorized roles or service role generation.

---

## 10. POST-MIGRATION SMOKE TESTING & API VERIFICATION

Update application `.env.local` with live credentials:
```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
STORAGE_MODE=supabase
```

Run test suite:
```bash
npm run test:security
```
* **Verify:**
  1. Login with Super Admin → 200 OK.
  2. Anonymous request to `/api/employees` → 401 Unauthorized.
  3. `HR_ADMIN` request to `/api/salary/emp-test-001` → 403 Forbidden.
  4. Public verification lookup for valid certificate → 200 OK with sanitized metadata.
  5. Public verification lookup for non-existent ID → 200 OK with `NOT_FOUND` status.
  6. Rate limiting on `/api/auth/login` triggers 429 after 5 failed attempts.

---

## 11. ROLLBACK CONSIDERATIONS

If a critical flaw is discovered during pre-production smoke testing:
* **Empty Database Rollback:**
  Execute [supabase_reset_dev.sql](file:///d:/19.Website/HR_Portal/supabase_reset_dev.sql) to tear down all schema objects.
* **Populated Database Rollback:**
  Do NOT run `supabase_reset_dev.sql`. Restore from the automated snapshot created in Step 1.
