# HR PORTAL — PRODUCTION BUG FIX + SECURITY LOG RETENTION REPORT

**Date:** 2026-10-05
**Workspace:** `D:\19.Website\HR_Portal`
**Status:** ALL FIXES IMPLEMENTED & 100% VERIFIED

---

## 1. Employee Dropdown Root Cause

### Root Cause Analysis:
1. **Aggressive Route Caching in Next.js 16 App Router:**
   The endpoint `/api/employees/route.ts` did not declare `export const dynamic = 'force-dynamic'` or `export const revalidate = 0`. As a result, Next.js internal router and HTTP caching layers served pre-rendered/cached responses across browser sessions.
2. **Missing Anti-Caching HTTP Headers:**
   The API response lacked explicit cache-control directives (`no-store, no-cache, must-revalidate`).
3. **Client-Side Fetch Without Cache Invalidation:**
   Client components (`offer/page.tsx`, `experience/page.tsx`, `relieving/page.tsx`, `salary/page.tsx`) executed `fetch('/api/employees')` without `{ cache: 'no-store' }`. Consequently, when an employee was onboarded in the Employee Directory, the document generators loaded the previously cached directory payload from before the onboarding event.
4. **Silent API Load Failures:**
   In previous revisions, errors during employee loading were swallowed silently in empty `catch` blocks, causing the dropdown to remain empty without alerting the user or offering a retry action.

### Applied Resolution:
- Enforced `export const dynamic = 'force-dynamic'` and `export const revalidate = 0` on `src/app/api/employees/route.ts`.
- Appended authoritative cache prevention headers to every response:
  ```http
  Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
  Pragma: no-cache
  Expires: 0
  ```
- Updated all document generator fetch calls to supply `{ cache: 'no-store' }`.
- Integrated active loading states and explicit error banners with retry triggers (`Refresh Directory`) across Offer, Experience, Relieving, and Salary document pages.
- Preserved strict RBAC/RLS: Employee list queries sanitize compensation fields so that sensitive salary info (`annual_ctc`, `basic_pay`) is never leaked in the directory listing.

---

## 2. Employee Auto-Selection Root Cause

### Root Cause Analysis:
1. **Hardcoded First-Index Auto-Selection:**
   In `experience/page.tsx`, `relieving/page.tsx`, and `salary/page.tsx`, the `useEffect` hook handling the employee directory response contained:
   ```typescript
   if (activeList.length > 0) {
     handleSelectEmployee(activeList[0].id, activeList[0]);
   }
   ```
   This automatically bound the first employee alphabetically (e.g., *Atal Kumar Pandey*) upon route load, browser refresh, or tab switch.
2. **Fallback Auto-Selection in Form Submission:**
   In `offer/page.tsx`, the submission handler fell back to selecting `employees[0]?.id` if no employee was explicitly chosen:
   ```typescript
   employee_id: selectedEmpId || employees[0]?.id || 'emp-placeholder',
   ```
3. **Missing State Reset on Unselect:**
   The dropdown `<select>` lacked a proper empty selection handler that restored neutral form values when the user deselected an employee.

### Applied Resolution:
- Removed all instances of `activeList[0]` / `employees[0]` auto-selection across all document generators.
- Enforced required initial states:
  - **Offer Letter:** `-- Choose from Employee Directory --` (value: `""`, `selectedEmpId = ""`)
  - **Experience Letter:** `-- Choose Employee --` (value: `""`, `selectedEmpId = ""`)
  - **Relieving Letter:** `-- Choose Employee --` (value: `""`, `selectedEmpId = ""`)
  - **Salary Slip:** `-- Choose Employee --` (value: `""`, `selectedEmpId = ""`)
- Added explicit reset logic: When the user toggles back to the empty option, all employee-derived fields (Full Name, Employee ID, Designation, Department, Joining Date, Relieving Date, Tenure, Location, Compensation fields) are completely cleared to neutral/empty values.
- Form submissions now strictly validate that an employee is explicitly chosen; submissions without an employee are halted with clear validation alerts.

---

## 3. CIN Root Cause & Complete Elimination

### Root Cause Analysis:
The obsolete CIN value `U72900TG2023PTC178920` existed in:
1. Default fallback corporate metadata in `src/lib/db.ts` (`corporate_meta` mock seed).
2. Hardcoded display fallback in `src/app/(portal)/settings/page.tsx` (`settings.cin || 'U72900TG2023PTC178920'`).
3. Hardcoded template text in `src/components/documents/SalarySlipTemplate.tsx` (`CIN: U72900TG2023PTC178920`).

### Applied Resolution:
- Updated `src/lib/db.ts`: `cin` property in corporate settings default metadata is strictly `''` (empty string).
- Updated `src/app/(portal)/settings/page.tsx`: Initialized `cin: ''`, removed old CIN fallback; displays `'—'` when blank.
- Updated `src/components/documents/SalarySlipTemplate.tsx`: Completely eliminated the hardcoded CIN line from the document header.
- Template rendering rules: Document templates only render the CIN line if `cin` is populated and non-empty. When empty, the line is cleanly omitted.
- **Corporate Identity Preservation:**
  - Company: **Varsaka Labs**
  - Email: **info@varsaka.com**
  - Website: **https://varsaka.com**
- **Verification:** Global ripgrep search across all active code and configuration confirmed **ZERO active/runtime references** to `U72900TG2023PTC178920`.

---

## 4. Retention Implementation Method

### Architecture:
A rolling 7-day retention engine was implemented to execute automatically at both the database and application levels:

1. **Automated Server Daemon (Application / Next.js Runtime):**
   - Implemented `src/lib/retention.ts` with continuous daemon loop running every 6 hours (`RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000`) with a 15-second initial startup delay.
   - Wired to Next.js server lifecycle via `src/instrumentation.ts` (`register()` hook for `process.env.NEXT_RUNTIME === 'nodejs'`), ensuring hands-free, autonomous background execution without requiring any administrator to navigate to Security Center.
2. **Database Targeted Deletion Logic:**
   - Implemented `auditLogs.purgeExpired(retentionDays)` and `securityLogs.purgeExpired(retentionDays)` in `src/lib/db.ts`.
   - Computes UTC ISO timestamp cutoff strictly using database/UTC time: `NOW() - INTERVAL '7 days'`.
   - Uses targeted `DELETE` operations only:
     ```sql
     DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL '7 days';
     DELETE FROM public.security_logs WHERE created_at < NOW() - INTERVAL '7 days';
     ```
   - **NEVER** uses `TRUNCATE`.
   - **NEVER** cascades or touches any business tables.
3. **PostgreSQL / Supabase Native Execution:**
   - Authored `supabase_log_retention_policy.sql` defining:
     - `public.purge_expired_audit_and_security_logs(p_retention_days integer DEFAULT 7)` with `SECURITY DEFINER`.
     - Integrated `pg_cron` schedule `0 2 * * *` (runs every night at 02:00 UTC).
4. **Internal Protected Trigger Endpoint:**
   - `src/app/api/internal/retention/route.ts` allows administrative or external cron invocations with `CRON_SECRET` authorization.
5. **No Cleanup Loop:**
   - Purge operations do not log individual audit records per deleted row. Only standard operational console logs are emitted.

---

## 5. Exact Tables Affected by Retention

**STRICTLY TWO TABLES:**
1. `public.audit_logs`
2. `public.security_logs`

**CONFIRMATION: ZERO OTHER TABLES ARE TOUCHED.**
The following tables are 100% untouched and preserved:
- `public.employees`
- `public.employee_salary`
- `public.documents`
- `public.document_versions`
- `public.approvals`
- `public.verification_logs`
- `public.tasks`
- `public.users`
- `public.user_roles`
- `public.roles`
- `public.permissions`
- `public.templates`
- `public.template_versions`
- `public.departments`
- `public.system_settings`
- Storage buckets / objects / uploaded files
- `auth.users`

---

## 6. Exact Timestamp Columns Used

Discovered via live PostgreSQL schema inspection:
- `public.audit_logs`: **`created_at`** (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`)
- `public.security_logs`: **`created_at`** (`TIMESTAMPTZ NOT NULL DEFAULT NOW()`)

All comparisons are executed against UTC ISO timestamps computed from system/UTC time.

---

## 7. Schedule and Frequency

- **Application Daemon (`src/instrumentation.ts` & `src/lib/retention.ts`):**
  Executes automatically every **6 hours**, with an initial execution **15 seconds** after server startup.
- **Database `pg_cron` Schedule (`supabase_log_retention_policy.sql`):**
  Configured to execute daily at **02:00 UTC** (`0 2 * * *`).

---

## 8. SQL / Function / Job Created

The migration script `supabase_log_retention_policy.sql` provides the complete database-level policy:

```sql
CREATE OR REPLACE FUNCTION public.purge_expired_audit_and_security_logs(p_retention_days integer DEFAULT 7)
RETURNS TABLE (
    purged_audit_count bigint,
    purged_security_count bigint,
    cutoff_timestamp timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cutoff timestamptz;
    v_audit_deleted bigint;
    v_security_deleted bigint;
BEGIN
    IF p_retention_days IS NULL OR p_retention_days < 1 THEN
        p_retention_days := 7;
    END IF;

    v_cutoff := NOW() - (p_retention_days || ' days')::interval;

    DELETE FROM public.audit_logs
    WHERE created_at < v_cutoff;
    GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;

    DELETE FROM public.security_logs
    WHERE created_at < v_cutoff;
    GET DIAGNOSTICS v_security_deleted = ROW_COUNT;

    RETURN QUERY SELECT v_audit_deleted, v_security_deleted, v_cutoff;
END;
$$;

-- Scheduled Execution via pg_cron (runs at 02:00 UTC daily)
SELECT cron.schedule(
    'rolling-7day-log-retention-job',
    '0 2 * * *',
    $$SELECT * FROM public.purge_expired_audit_and_security_logs(7);$$
);
```

---

## 9. Indexes Used / Created

Schema inspection confirmed the required indexes already exist on the live database:
- `idx_audit_logs_created` on `public.audit_logs(created_at DESC)`
- `idx_security_logs_created` on `public.security_logs(created_at DESC)`

Because existing B-tree indexes cover `created_at DESC`, `DELETE ... WHERE created_at < cutoff` utilizes fast index range scans. **No additional indexes were needed or created**, avoiding unnecessary storage overhead.

---

## 10. Test Results

Executed comprehensive automated test suite `tests/retention-and-employee-dropdown-test.ts`:

```
================================================================
PRODUCTION BUG FIX & 7-DAY ROLLING RETENTION VERIFICATION SUITE
================================================================

--- 1. Verification of Complete CIN Elimination ---
✅ PASS: Corporate metadata CIN defaults to empty string
✅ PASS: Corporate brand_name is "Varsaka Labs"
✅ PASS: Corporate email is "info@varsaka.com"
✅ PASS: Corporate website is "https://varsaka.com"
✅ PASS: Active source file src/lib/db.ts has ZERO references to old CIN
✅ PASS: Active source file src/app/(portal)/settings/page.tsx has ZERO references to old CIN
✅ PASS: Active source file src/components/documents/SalarySlipTemplate.tsx has ZERO references to old CIN
✅ PASS: Active source file src/app/api/settings/corporate/route.ts has ZERO references to old CIN

--- 2. Employee Onboarding & Dropdown Synchronization ---
✅ PASS: Successfully onboarded new employee in authoritative store
✅ PASS: Newly onboarded employee appears in authoritative Employee Directory
✅ PASS: Newly onboarded employee is eligible and present for Offer Letter selection
✅ PASS: Newly onboarded employee is eligible and present for Experience/Relieving selection
✅ PASS: Authoritative employee record does not leak annual_ctc in employee list
✅ PASS: Authoritative employee record does not leak basic pay in employee list

--- 3. Exact 7-Day Rolling Retention Window Verification ---
✅ PASS: Seeded boundary test records into audit_logs
✅ PASS: Seeded boundary test records into security_logs
✅ PASS: Purged expired audit_logs (Deleted count: 2)
✅ PASS: Purged expired security_logs (Deleted count: 2)
✅ PASS: Audit: Today record is PRESERVED (NOT deleted)
✅ PASS: Audit: 1-day-old record is PRESERVED (NOT deleted)
✅ PASS: Audit: 6-day-old record is PRESERVED (NOT deleted)
✅ PASS: Audit: 6d 23h record within 7-day boundary is PRESERVED (NOT deleted)
✅ PASS: Audit: 8-day-old expired record is DELETED
✅ PASS: Audit: 14-day-old expired record is DELETED
✅ PASS: Security: Today record is PRESERVED (NOT deleted)
✅ PASS: Security: 1-day-old record is PRESERVED (NOT deleted)
✅ PASS: Security: 6-day-old record is PRESERVED (NOT deleted)
✅ PASS: Security: 6d 23h record within 7-day boundary is PRESERVED (NOT deleted)
✅ PASS: Security: 8-day-old expired record is DELETED
✅ PASS: Security: 14-day-old expired record is DELETED
✅ PASS: Retention is IDEMPOTENT: Immediate rerun deletes 0 additional audit_logs
✅ PASS: Retention is IDEMPOTENT: Immediate rerun deletes 0 additional security_logs
✅ PASS: Daemon runner executed cleanly and idempotently

--- 4. Strict Business Record Preservation Audit ---
✅ PASS: employees count UNCHANGED (Before: 2, After: 2)
✅ PASS: employee_salary count UNCHANGED (Before: 2, After: 2)
✅ PASS: documents count UNCHANGED (Before: 4, After: 4)
✅ PASS: document_versions count UNCHANGED (Before: 0, After: 0)
✅ PASS: approvals count UNCHANGED (Before: 0, After: 0)
✅ PASS: verification_logs count UNCHANGED (Before: 25, After: 25)
✅ PASS: tasks count UNCHANGED (Before: 4, After: 4)
✅ PASS: users count UNCHANGED (Before: 2, After: 2)
✅ PASS: system_settings count UNCHANGED (Before: 31, After: 31)

--- 5. Repository Integrity Audit ---
✅ PASS: Main Varsaka project path confirmed

================================================================
TEST SUMMARY: 43 PASSED, 0 FAILED
================================================================
```

---

## 11. Confirmation: Only `audit_logs` and `security_logs` Subject to Automatic Deletion

Confirmed by code inspection, database RPC definition, and live boundary test suite:
- `auditLogs.purgeExpired(7)` targets exclusively `public.audit_logs`.
- `securityLogs.purgeExpired(7)` targets exclusively `public.security_logs`.
- No other table is referenced in any retention query.

---

## 12. Confirmation: All Other Business Data Remains Untouched

Pre-purge and post-purge row counts in the live database confirmed exact parity:
- `employees`: 2 rows -> 2 rows (0 modified/deleted)
- `employee_salary`: 2 rows -> 2 rows (0 modified/deleted)
- `documents`: 4 rows -> 4 rows (0 modified/deleted)
- `document_versions`: 0 rows -> 0 rows (0 modified/deleted)
- `approvals`: 0 rows -> 0 rows (0 modified/deleted)
- `verification_logs`: 25 rows -> 25 rows (0 modified/deleted)
- `tasks`: 4 rows -> 4 rows (0 modified/deleted)
- `users`: 2 rows -> 2 rows (0 modified/deleted)
- `system_settings`: 31 rows -> 31 rows (0 modified/deleted)

---

## 13. TypeScript Compilation Result

Ran `npm run typecheck` (`tsc --noEmit`):
```
> varsaka-hr-portal@1.0.0 typecheck
> tsc --noEmit

Exit code: 0 (PASSED - Zero type errors)
```

---

## 14. ESLint Result

Ran `npm run lint` (`eslint src`):
```
> varsaka-hr-portal@1.0.0 lint
> eslint src

Exit code: 0 (PASSED - Zero errors, 0 broken rules)
```

---

## 15. Production Build Result

Ran `npm run build` (`next build` with Turbopack on Next.js 16.3.6):
```
✓ Compiled successfully in 18.2s
  Running TypeScript ...
  Finished TypeScript in 11.3s ...
  Collecting page data using 7 workers ...
  Generating static pages using 7 workers (40/40) in 579ms
  Finalizing page optimization ...

Exit code: 0 (PASSED - All 40 routes compiled successfully)
```

---

## 16. PDF / Document Regression Results

1. **Relieving Letter Verification Suite (`tests/relieving-letter-verification.ts`):**
   - 41/41 PASSED (Prefix `VAR-REL`, cryptographic entropy, RBAC permissions, approval lifecycle, QR verification).
2. **Offer Letter Compensation Persistence Suite (`tests/offer-letter-compensation-persistence-test.ts`):**
   - 23/23 PASSED (16-component breakdown, non-zero handling, effective date revisions, snapshot parity).
3. **Format Integrity:**
   - Offer Letter: 16-page layout preserved.
   - Experience Letter: 1-page layout preserved.
   - Relieving Letter: 1-page layout preserved.
   - Salary Slip: 1-page layout preserved (without CIN line, with `https://varsaka.com`).
   - Certificate: 1-page layout preserved.

---

## 17. Confirmation: `D:\19.Website\Varsaka` Was Untouched

- Verified with `git status` in `D:\19.Website\Varsaka`:
  ```
  On branch main
  Your branch is up to date with 'origin/main'.
  nothing to commit, working tree clean
  ```
- **Zero files were viewed, modified, or written in `D:\19.Website\Varsaka`.**
- **Zero git commits or pushes were executed.**
