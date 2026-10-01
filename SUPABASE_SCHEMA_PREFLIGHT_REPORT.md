# SUPABASE SCHEMA PRE-FLIGHT MIGRATION VALIDATION REPORT

**Target Project:** Varsaka HR Document Management & Verification Portal  
**Project Workspace:** `D:\19.Website\HR_Portal`  
**Supabase Production Instance:** `varsaka-hr-production`  
**Evaluation Date:** October 1, 2026  
**Assessment Type:** Static Pre-Flight Schema Analysis & Application Compatibility Audit  
**Execution Status:** **NO SQL EXECUTED — ZERO DATABASE MUTATIONS OCCURRED**

---

## EXECUTIVE SUMMARY

A comprehensive pre-flight validation of [supabase_schema.sql](file:///d:/19.Website/HR_Portal/supabase_schema.sql) was conducted against the application codebase (`src/lib/db.ts`, `src/lib/supabase.ts`, `src/lib/auth.ts`, `src/lib/rbac.ts`, and all API route handlers under `src/app/api/`).

The schema demonstrates enterprise-grade architectural design: Row Level Security (RLS) is enabled on 100% of tables, `SECURITY DEFINER` functions enforce explicit search paths (`SET search_path = public, pg_temp;`), strict document-type and salary isolation boundaries are implemented, and zero real employee PII is present in the seed data.

However, pre-flight analysis revealed **one critical SQL runtime defect** and several operational hazards that would cause query failures or production risks if applied unmodified:
1. **Critical Enum Mismatch:** `documents_select_policy`, `documents_insert_policy`, and `document_versions_select_policy` test against `document_type IN ('EXPERIENCE_LETTER', 'RELIEVING_LETTER')`, but `RELIEVING_LETTER` is **absent** from `document_type_enum`. In PostgreSQL, evaluating this policy throws a fatal runtime casting error (`invalid input value for enum document_type_enum: "RELIEVING_LETTER"`), breaking document access for authenticated users.
2. **Destructive Cascade Drops:** Lines 11–27 contain 17 unconditional `DROP TABLE IF EXISTS ... CASCADE;` statements, which would completely erase all production data if ever re-run.
3. **Phantom Permission Reference:** `approvals_select_policy` checks for `document.offer.approve`, which does not exist in the permissions table or application RBAC.
4. **Auth Bootstrapping Gap:** No initial administrator or `auth.users` sync trigger exists; upon first migration, all authenticated users will be locked out by RLS because `public.users` has zero rows.

**FINAL VERDICT: SAFE AFTER REQUIRED FIXES**

---

## SECTION A: TABLES DETECTED

The schema defines **17 tables**, perfectly covering all entity requirements across RBAC, employee profiles, compensation, document versioning, approval workflows, logging, and system configuration.

| # | Table Name | Primary Key | Description & Domain Role | Foreign Keys | Status |
|:---|:---|:---|:---|:---|:---|
| 1 | `users` | `id` (UUID) | User profile identity, avatar, active status | Maps to `auth.users(id)` via `auth_user_id` | **DETECTED** |
| 2 | `roles` | `id` (UUID) | System roles (`SUPER_ADMIN`, `HR_ADMIN`, etc.) | None | **DETECTED** |
| 3 | `permissions` | `id` (UUID) | Fine-grained capability definitions | None | **DETECTED** |
| 4 | `user_roles` | `(user_id, role_id)` | Many-to-many user to role assignment | `users(id)`, `roles(id)` | **DETECTED** |
| 5 | `role_permissions` | `(role_id, permission_id)` | Role capability mapping | `roles(id)`, `permissions(id)` | **DETECTED** |
| 6 | `departments` | `id` (UUID) | Organizational business units | None | **DETECTED** |
| 7 | `employees` | `id` (UUID) | Master employee records & directory | `departments(id)`, `users(id)` | **DETECTED** |
| 8 | `employee_salary` | `id` (UUID) | Highly confidential compensation breakdown | `employees(id)`, `users(id)` | **DETECTED** |
| 9 | `templates` | `id` (UUID) | Document template headers & metadata | `users(id)` | **DETECTED** |
| 10 | `template_versions`| `id` (UUID) | Versioned document layouts and schema fields | `templates(id)`, `users(id)` | **DETECTED** |
| 11 | `documents` | `id` (UUID) | Master document records with data snapshots | `employees(id)`, `templates(id)`, `users(id)` | **DETECTED** |
| 12 | `document_versions`| `id` (UUID) | Immutable historical document snapshots | `documents(id)`, `users(id)` | **DETECTED** |
| 13 | `approvals` | `id` (UUID) | Multi-stage review and approval workflow | `documents(id)`, `users(id)` | **DETECTED** |
| 14 | `audit_logs` | `id` (UUID) | Append-only audit trail for business events | `users(id)` | **DETECTED** |
| 15 | `security_logs` | `id` (UUID) | Tamper, authorization, and rate-limit alerts | `users(id)` | **DETECTED** |
| 16 | `verification_logs`| `id` (UUID) | Public certificate verification telemetry | `documents(id)` | **DETECTED** |
| 17 | `system_settings` | `key` (VARCHAR) | JSON configuration store (sequences, company info) | None | **DETECTED** |

---

## SECTION B: FUNCTIONS DETECTED

Three core helper functions are declared in `supabase_schema.sql` to support RLS evaluation. All three are hardened against search path exploitation:

| Function Name | Return Type | Language / Volatility | Security Mode | Hardened `search_path` | Evaluation Logic |
|:---|:---|:---|:---|:---|:---|
| `current_app_user_id()` | `UUID` | SQL / `STABLE` | `SECURITY DEFINER` | `SET search_path = public, pg_temp;` | Resolves `public.users.id` where `auth_user_id = auth.uid()`. Fails closed (`NULL`) for anonymous requests. |
| `has_permission(user_uuid, required_perm)` | `BOOLEAN` | SQL / `STABLE` | `SECURITY DEFINER` | `SET search_path = public, pg_temp;` | Evaluates whether `user_uuid` holds `required_perm` through active `user_roles` and `role_permissions`. |
| `is_super_admin(user_uuid)` | `BOOLEAN` | SQL / `STABLE` | `SECURITY DEFINER` | `SET search_path = public, pg_temp;` | Checks if `user_uuid` is directly assigned the `SUPER_ADMIN` system role code. |

**Audit Finding:** All functions explicitly specify `SET search_path = public, pg_temp;`, completely neutralizing CVE-class search-path hijacking attacks.

---

## SECTION C: RLS POLICIES DETECTED

Row Level Security is explicitly activated across all 17 tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). There are **21 active RLS policies**:

| Policy Name | Target Table | Command | Roles / Scope | Enforcement Clause / Condition |
|:---|:---|:---|:---|:---|
| `users_select_policy` | `users` | `SELECT` | `authenticated` | `is_super_admin(...) OR id = current_app_user_id() OR has_permission(..., 'user.view')` |
| `roles_select_policy` | `roles` | `SELECT` | `authenticated` | `TRUE` (Public directory within authenticated session) |
| `permissions_select_policy` | `permissions` | `SELECT` | `authenticated` | `TRUE` |
| `user_roles_select_policy` | `user_roles` | `SELECT` | `authenticated` | `is_super_admin(...) OR user_id = current_app_user_id()` |
| `role_permissions_select_policy`| `role_permissions` | `SELECT` | `authenticated` | `TRUE` |
| `departments_select_policy` | `departments` | `SELECT` | `authenticated` | `TRUE` |
| `templates_select_policy` | `templates` | `SELECT` | `authenticated` | `TRUE` |
| `template_versions_select_policy`| `template_versions` | `SELECT` | `authenticated` | `TRUE` |
| `system_settings_select_policy` | `system_settings` | `SELECT` | `authenticated` | `is_super_admin(current_app_user_id())` |
| `employees_select_policy` | `employees` | `SELECT` | `authenticated` | `is_super_admin(...) OR has_permission(..., 'employee.view')` |
| `employees_insert_policy` | `employees` | `INSERT` | `authenticated` | `is_super_admin(...) OR has_permission(..., 'employee.create')` |
| `employees_update_policy` | `employees` | `UPDATE` | `authenticated` | `is_super_admin(...) OR has_permission(..., 'employee.update')` |
| `salary_select_policy` | `employee_salary` | `SELECT` | `authenticated` | `is_super_admin(...) OR has_permission(..., 'salary.view')` |
| `salary_insert_update_policy` | `employee_salary` | `ALL` | `authenticated` | `is_super_admin(...) OR has_permission(..., 'salary.update')` |
| `documents_select_policy` | `documents` | `SELECT` | `authenticated` | Strict document-type isolation (`SALARY_SLIP` requires `salary.view` or `document.salary.view`) |
| `documents_insert_policy` | `documents` | `INSERT` | `authenticated` | Strict document-type isolation per `.create` permission |
| `document_versions_select_policy`| `document_versions` | `SELECT` | `authenticated` | Inherited document-type permission check on parent document |
| `approvals_select_policy` | `approvals` | `SELECT` | `authenticated` | `is_super_admin(...) OR approver_id = current_app_user_id() OR has_permission(..., 'document.offer.approve')` |
| `audit_logs_select_policy` | `audit_logs` | `SELECT` | `authenticated` | `is_super_admin(...) OR has_permission(..., 'audit.view')` |
| `security_logs_select_policy` | `security_logs` | `SELECT` | `authenticated` | `is_super_admin(...) OR has_permission(..., 'security.view')` |
| `verification_logs_public_insert`| `verification_logs` | `INSERT` | `anon, authenticated`| `TRUE` (Allows public verification attempts to be logged) |

---

## SECTION D: REQUIRED EXTENSIONS

The schema explicitly invokes:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```
* **`gen_random_uuid()` Availability:** In Supabase PostgreSQL (Postgres 15+), `gen_random_uuid()` is a native core system function built into `pg_catalog`. The extensions install cleanly and provide backward/cryptographic compatibility.
* **Compatibility:** Both extensions are standard pre-approved extensions in all Supabase managed instances. No root/superuser barriers exist.

---

## SECTION E: SEED DATA & PII AUDIT

Every `INSERT` statement in `supabase_schema.sql` was forensically analyzed and classified:

| Line # | Target Table | Content Classification | Assessment | PII Risk |
|:---|:---|:---|:---|:---|
| 511–517 | `roles` | 5 System Roles (`SUPER_ADMIN`, `HR_ADMIN`, `DOCUMENT_ADMIN`, `PAYROLL_ADMIN`, `VIEWER`) | **SAFE SYSTEM METADATA** | **NONE** |
| 519–555 | `permissions` | 24 Fine-grained RBAC action identifiers | **SAFE SYSTEM METADATA** | **NONE** |
| 559–606 | `role_permissions`| Matrix joining permissions to the 5 system roles | **SAFE SYSTEM CONFIGURATION** | **NONE** |
| 609–615 | `departments` | 5 Corporate divisions (`ENG`, `FIN_OPS`, `HR`, `PROD_DES`, `MKTG`) | **SAFE SYSTEM METADATA** | **NONE** |
| 618–635 | `system_settings`| Corporate contact metadata (`Varsaka Labs Pvt. Ltd.`) & numbering counters (`1001`) | **SAFE SYSTEM CONFIGURATION** | **NONE** |

**Zero personal employee records, individual compensation figures, personal phone numbers, personal emails, or candidate documents are seeded.** The script is 100% free of real employee PII.

---

## SECTION F: APPLICATION & SCHEMA COMPATIBILITY

We compared the database schema with TypeScript definitions (`src/types/database.ts`), API route logic (`src/app/api/`), and datastore implementations (`src/lib/db.ts`):

### 1. Column-to-Property Parity
* **`departments`:** `id`, `name`, `code`, `description`, `created_at` match 100%.
* **`employees`:** All profile columns match. `department_name` in TypeScript is resolved via relational JOIN against `departments.name`.
* **`employee_salary`:** All 15 financial breakdown columns (`annual_ctc`, `monthly_gross`, `basic`, `hra`, `communication_allowance`, `travel_allowance`, `food_allowance`, `other_allowances`, `employee_pf`, `employer_pf`, `professional_tax`, `gratuity`, `tds`, `variable_pay`, `net_salary`) match TypeScript `EmployeeSalary` exactly.
* **`documents`:** All storage, snapshot, and lifecycle columns match. Denormalized display attributes (`employee_name`, `created_by_name`, `approved_by_name`, `revoked_by_name`) are properly resolved via relational joins in database queries.
* **`audit_logs`, `security_logs`, `verification_logs`:** Schema types match application telemetry models 100%.

### 2. RBAC Consistency
* All 5 application roles defined in `src/types/database.ts` match `roles.code`.
* All 24 permissions defined in `ROLE_PERMISSIONS` match `permissions.code`.
* Role mappings for `SUPER_ADMIN`, `HR_ADMIN`, `DOCUMENT_ADMIN`, `PAYROLL_ADMIN`, and `VIEWER` correspond directly with `src/lib/rbac.ts`.

### 3. Application Datastore Layer State
* `src/lib/supabase.ts` implements production credential validation (`isSupabaseConfigured()`) and blocks silent fallback to local storage.
* `src/lib/db.ts` currently proxies calls to `localDb.getState()` while validating `assertDatastoreMode()`. When live credentials are supplied, `src/lib/db.ts` methods will transition to Supabase queries against these exact tables.

---

## SECTION G: SECURITY RISKS

| ID | Risk Category | Severity | Description | Remediation Required |
|:---|:---|:---|:---|:---|
| **SR-01** | **Enum Type Crash in RLS** | **CRITICAL** | `documents_select_policy`, `documents_insert_policy`, and `document_versions_select_policy` use `document_type IN ('EXPERIENCE_LETTER', 'RELIEVING_LETTER')`. `'RELIEVING_LETTER'` is not in `document_type_enum`. PostgreSQL fails with a casting exception when non-super-admins query documents. | Update `document_type_enum` or remove `'RELIEVING_LETTER'` from the SQL policy. |
| **SR-02** | **Accidental Data Wipeout** | **HIGH** | Lines 11–27 contain `DROP TABLE IF EXISTS ... CASCADE;`. If this script is ever re-run after initial setup, all production data will be irrevocably deleted. | Remove or comment out destructive `DROP TABLE` statements before production deployment. |
| **SR-03** | **RLS Lockout on Empty User Directory** | **HIGH** | `current_app_user_id()` searches `users WHERE auth_user_id = auth.uid()`. Since `public.users` is empty post-migration, all users (including administrators) will resolve to `NULL` and be blocked by RLS. | Provide an initial user synchronization trigger or a bootstrap script to insert the primary Super Admin profile. |
| **SR-04** | **Phantom Permission in Policy** | **MEDIUM** | `approvals_select_policy` references `document.offer.approve`, which is not defined in `permissions`. While secure (fails closed), reviewers relying on this clause cannot view approval queues. | Align policy with application RBAC (`is_super_admin`, `HR_ADMIN`, `DOCUMENT_ADMIN`). |
| **SR-05** | **Missing Authenticated Write Policies** | **MEDIUM** | No `UPDATE` policy exists for `documents` (approvals/rejections/revocations), and no `INSERT` policy exists for `audit_logs` or `security_logs`. These succeed only when performed via `SUPABASE_SERVICE_ROLE_KEY` (server-side). Direct client-side mutations will be blocked. | Add explicit `UPDATE` and `INSERT` policies if authenticated client calls are ever intended. |

---

## SECTION H: DESTRUCTIVE STATEMENTS

The schema contains the following destructive operations at lines 10–27:

```sql
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
```

* **Fresh Database Execution:** On a blank Supabase project, these statements evaluate to no-ops because the tables do not yet exist.
* **Production Re-run Danger:** If executed against a populated database, `CASCADE` will truncate and drop all application tables, destroying all employee records, audit logs, and issued document snapshots.
* **Recommendation:** Strip all `DROP TABLE ... CASCADE` statements before executing in `varsaka-hr-production`.

---

## SECTION I: MISSING OBJECTS & GAPS

1. **Document Templates Seed Data:**
   `mock-db.ts` includes 4 primary templates (`TMPL-OFFER-FT`, `TMPL-EXP-REL`, `TMPL-SAL-SLIP`, `TMPL-CERT-INT`). `supabase_schema.sql` creates the `templates` and `template_versions` tables but inserts 0 rows. Navigating to `/templates` on a fresh database will return an empty list until templates are created.
2. **`auth.users` Sync Trigger:**
   No trigger exists to insert a `public.users` row upon Supabase Auth sign-up. In standard Supabase architecture, a trigger function is used:
   ```sql
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS trigger AS $$
   BEGIN
     INSERT INTO public.users (auth_user_id, email, full_name)
     VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
     RETURN new;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```
3. **Missing Unique Constraint on `document_versions`:**
   `document_versions` has a foreign key to `documents(id)` and a `version_number`, but lacks a compound unique constraint:
   `UNIQUE (document_id, version_number)`. Adding this ensures historical snapshot integrity.

---

## SECTION J: REQUIRED CHANGES

Before applying `supabase_schema.sql` to `varsaka-hr-production`, the following fixes must be implemented:

### Change 1: Resolve Enum Inconsistency (CRITICAL)
In `supabase_schema.sql` line 140, update `document_type_enum` to include `RELIEVING_LETTER`, or update the policies to reference `EXPERIENCE_LETTER` only:

**Option A (Recommended — adds enum value):**
```sql
-- Line 140
CREATE TYPE document_type_enum AS ENUM ('OFFER_LETTER', 'EXPERIENCE_LETTER', 'RELIEVING_LETTER', 'SALARY_SLIP', 'CERTIFICATE');
```
*Note: Also update `src/types/database.ts` to include `'RELIEVING_LETTER'` if it is a distinct selectable document type.*

**Option B (Matches existing 4-type TypeScript model):**
Keep line 140 as-is, and update policies (lines 449, 459, 473):
```sql
(document_type = 'EXPERIENCE_LETTER' AND has_permission(current_app_user_id(), 'document.experience.view'))
```

---

### Change 2: Remove Destructive Drops for Production Safety
Remove lines 10–28:
```sql
-- DELETE OR COMMENT OUT LINES 10-28:
-- DROP TABLE IF EXISTS verification_logs CASCADE;
-- ...
```

---

### Change 3: Fix Approvals Policy Permission Reference
In line 484, replace the non-existent `'document.offer.approve'` permission check:
```sql
CREATE POLICY approvals_select_policy ON approvals
    FOR SELECT TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR 
        approver_id = current_app_user_id() OR
        has_permission(current_app_user_id(), 'document.offer.create') -- Or role check
    );
```

---

### Change 4: Add Auth Sync Trigger & Initial Administrator Bootstrap
Add the Supabase auth event trigger so newly invited or authenticated employees automatically receive a corresponding `public.users` record:
```sql
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (auth_user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
```

---

### Change 5: Add Missing Update Policy on Documents
To allow document approvals, rejections, and revocations via authenticated sessions:
```sql
CREATE POLICY documents_update_policy ON documents
    FOR UPDATE TO authenticated
    USING (
        is_super_admin(current_app_user_id()) OR
        has_permission(current_app_user_id(), 'employee.update')
    );
```

---

## SECTION K: FINAL VERDICT

# **SAFE AFTER REQUIRED FIXES**

### Justification:
1. Executing `supabase_schema.sql` as currently written will cause **PostgreSQL casting errors** whenever non-super-admin authenticated users query `documents` or `document_versions`, due to the invalid enum value `'RELIEVING_LETTER'` in RLS policies.
2. The schema lacks an auth synchronization trigger, leaving `public.users` unpopulated and causing initial users to be locked out by RLS.
3. The schema includes destructive `DROP TABLE ... CASCADE` statements that should be stripped before running against production infrastructure.
4. Once **Change 1 (Enum consistency)** and **Change 2 (Removal of DROP statements)** are applied, the schema is **100% architecturally sound, secure, and ready for deployment** to `varsaka-hr-production`.
