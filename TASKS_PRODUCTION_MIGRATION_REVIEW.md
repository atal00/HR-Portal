# Production Tasks Migration & Architecture Review

**Target Project:** `D:\19.Website\HR_Portal`  
**Migration File:** [`supabase_tasks_production_final.sql`](file:///D:/19.Website/HR_Portal/supabase_tasks_production_final.sql)  
**Target Table:** `public.tasks`  
**Associated Datastore:** `public.system_settings` (`key = 'tasks_store'`)  
**Status:** PROPOSED FOR DBA / HUMAN REVIEW — UNEXECUTED  

---

## 1. Executive Summary

During final production verification, three critical conditions were confirmed:
1. `public.tasks` does not currently exist in the production PostgreSQL schema (`PGRST205: Could not find the table 'public.tasks' in the schema cache`).
2. The HR Portal application ([`src/lib/db.ts`](file:///D:/19.Website/HR_Portal/src/lib/db.ts#L3980-4288)) operates smoothly by failing over to the `system_settings.tasks_store` JSON datastore, which currently holds exactly **2 confirmed legitimate operational tasks**.
3. The atomic database function [`permanent_purge_employee`](file:///D:/19.Website/HR_Portal/supabase_atomic_purge_rpc.sql#L68-70) contains an explicit safeguard (`IF to_regclass('public.tasks') IS NULL THEN RAISE EXCEPTION ...`) that safely blocks employee permanent purge until `public.tasks` is materialized.

This document reviews the production-ready migration script [`supabase_tasks_production_final.sql`](file:///D:/19.Website/HR_Portal/supabase_tasks_production_final.sql) designed to:
- Materialize `public.tasks` with enterprise constraints and indexes.
- Enforce strict Row-Level Security (RLS) integrated with Varsaka RBAC.
- Backfill the 2 legitimate operational tasks idempotently without data loss.
- Transition live traffic from `tasks_store` to native `public.tasks` seamlessly.
- Unblock employee purge operations safely.

---

## 2. Current Production Fallback Structure (`tasks_store`)

The verified state of `system_settings.tasks_store` contains exactly two records assigned to the Super Administrator (`05cbe54d-7267-4b91-a006-b2c2ccc952f8`):

```json
[
  {
    "id": "3c58b957-d4b5-4f92-a3fc-f77d7770cd28",
    "title": "Self-Assigned Security Audit Review",
    "status": "TODO",
    "due_date": null,
    "priority": "URGENT",
    "created_at": "2026-10-03T17:01:15.006Z",
    "created_by": "05cbe54d-7267-4b91-a006-b2c2ccc952f8",
    "updated_at": "2026-10-03T17:01:15.006Z",
    "assigned_to": "05cbe54d-7267-4b91-a006-b2c2ccc952f8",
    "description": null,
    "document_id": null,
    "employee_id": null
  },
  {
    "id": "ed9a09f1-c6ba-4515-8233-275b442e4c43",
    "title": "Verify Engineering Relieving Credentials",
    "status": "COMPLETED",
    "due_date": null,
    "priority": "HIGH",
    "created_at": "2026-10-03T17:01:13.746Z",
    "created_by": "05cbe54d-7267-4b91-a006-b2c2ccc952f8",
    "updated_at": "2026-10-03T17:01:17.960Z",
    "assigned_to": "05cbe54d-7267-4b91-a006-b2c2ccc952f8",
    "description": "Check certificate against central registry for batch 2026",
    "document_id": null,
    "employee_id": null
  }
]
```

---

## 3. Detailed Database Schema (`public.tasks`)

```sql
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
```

### Column Specifications & Justifications:

| Column | Type | Constraints | Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Immutable task identifier. |
| `title` | `TEXT` | `NOT NULL` | Short summary title. |
| `description` | `TEXT` | `NULL` | Extended task details or instructions. |
| `assigned_to` | `UUID` | `NOT NULL REFERENCES public.users(id)` | User responsible for task execution. |
| `created_by` | `UUID` | `NOT NULL REFERENCES public.users(id)` | User who opened the task. |
| `priority` | `VARCHAR(20)`| `CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT'))` | Priority ranking. |
| `status` | `VARCHAR(20)`| `CHECK (status IN ('TODO','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED'))` | Workflow lifecycle stage. |
| `due_date` | `TIMESTAMPTZ`| `NULL` | Task deadline. |
| `employee_id`| `UUID` | `REFERENCES public.employees(id) ON DELETE SET NULL` | Optional foreign key to linked employee. |
| `document_id`| `UUID` | `REFERENCES public.documents(id) ON DELETE SET NULL` | Optional foreign key to linked document. |
| `created_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT timezone('utc'::text, now())` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ`| `NOT NULL DEFAULT timezone('utc'::text, now())` | Last modification timestamp. |

### PostgREST Relationship Aliases:
The foreign key names `tasks_assigned_to_fkey` and `tasks_created_by_fkey` strictly match the exact syntax used in [`src/lib/db.ts`](file:///D:/19.Website/HR_Portal/src/lib/db.ts#L3988-3989):
```typescript
assigned_user:users!tasks_assigned_to_fkey(id, full_name, email),
created_user:users!tasks_created_by_fkey(id, full_name, email)
```

---

## 4. Query Performance Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON public.tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_employee_id ON public.tasks(employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_document_id ON public.tasks(document_id) WHERE document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_created_at_desc ON public.tasks(created_at DESC);
```

- **Filter Optimization**: Accelerates filtering by status, priority, and user involvement (`assigned_to`, `created_by`).
- **Partial Indexes**: `employee_id` and `document_id` use partial indexes (`WHERE ... IS NOT NULL`) to minimize B-Tree index bloat on generic operational tasks without entity linkages.
- **Default Chronological Sort**: `idx_tasks_created_at_desc` directly optimizes the API default order: `ORDER BY created_at DESC`.

---

## 5. Row-Level Security (RLS) Policy Matrix

| Policy Name | Action | Target Role | Expression (`USING` / `WITH CHECK`) |
| :--- | :--- | :--- | :--- |
| `tasks_super_admin_all` | `ALL` | `authenticated` | `public.is_super_admin(public.current_app_user_id())` |
| `tasks_select_policy` | `SELECT` | `authenticated` | `assigned_to = public.current_app_user_id() OR created_by = public.current_app_user_id() OR public.has_permission(public.current_app_user_id(), 'task.view') OR public.has_permission(public.current_app_user_id(), 'employee.view')` |
| `tasks_insert_policy` | `INSERT` | `authenticated` | `created_by = public.current_app_user_id() AND (public.has_permission(public.current_app_user_id(), 'task.create') OR public.is_super_admin(public.current_app_user_id()))` |
| `tasks_update_policy` | `UPDATE` | `authenticated` | `assigned_to = public.current_app_user_id() OR created_by = public.current_app_user_id() OR public.is_super_admin(public.current_app_user_id())` |
| `tasks_delete_policy` | `DELETE` | `authenticated` | `(created_by = public.current_app_user_id() AND public.has_permission(public.current_app_user_id(), 'task.delete')) OR public.is_super_admin(public.current_app_user_id())` |

### Access Privileges:
- `anon` and `public`: Explicitly **REVOKED** from all table operations.
- `service_role`: Granted **ALL** privileges for background server-side execution.
- `authenticated`: Granted `SELECT`, `INSERT`, `UPDATE`, `DELETE` governed by the active RLS policies.

---

## 6. Backfill Strategy & QA Task Exclusion

### Exact Records for Migration:
1. **Task 1: Self-Assigned Security Audit Review**
   - `id`: `3c58b957-d4b5-4f92-a3fc-f77d7770cd28`
   - `title`: `"Self-Assigned Security Audit Review"`
   - `status`: `'TODO'`
   - `priority`: `'URGENT'`
   - `assigned_to`: `'05cbe54d-7267-4b91-a006-b2c2ccc952f8'` (Super Admin)
   - `created_by`: `'05cbe54d-7267-4b91-a006-b2c2ccc952f8'` (Super Admin)
   - `created_at`: `'2026-10-03T17:01:15.006Z'`

2. **Task 2: Verify Engineering Relieving Credentials**
   - `id`: `ed9a09f1-c6ba-4515-8233-275b442e4c43`
   - `title`: `"Verify Engineering Relieving Credentials"`
   - `description`: `"Check certificate against central registry for batch 2026"`
   - `status`: `'COMPLETED'`
   - `priority`: `'HIGH'`
   - `assigned_to`: `'05cbe54d-7267-4b91-a006-b2c2ccc952f8'` (Super Admin)
   - `created_by`: `'05cbe54d-7267-4b91-a006-b2c2ccc952f8'` (Super Admin)
   - `created_at`: `'2026-10-03T17:01:13.746Z'`
   - `updated_at`: `'2026-10-03T17:01:17.960Z'`

### Mathematical Proof of Zero QA Remnants:
The migration executes an explicit, literal `INSERT` targeting only these two static UUIDs:
```sql
WHERE id IN (
  '3c58b957-d4b5-4f92-a3fc-f77d7770cd28'::UUID,
  'ed9a09f1-c6ba-4515-8233-275b442e4c43'::UUID
)
```
Because the migration does not perform open wildcards (`SELECT * FROM ...`) and does not copy unreviewed keys, **it is mathematically impossible for test runner tasks (e.g. Aditi Sharma, Test Delete Recipient, Rollback verification tasks) to enter `public.tasks`**.

---

## 7. Employee Purge Compatibility Analysis

The atomic employee permanent purge RPC [`permanent_purge_employee`](file:///D:/19.Website/HR_Portal/supabase_atomic_purge_rpc.sql) contains three structural touchpoints with `public.tasks`:

1. **Materialized Table Guard ([Lines 68-70](file:///D:/19.Website/HR_Portal/supabase_atomic_purge_rpc.sql#L68-L70)):**
   ```sql
   IF to_regclass('public.tasks') IS NULL THEN
     RAISE EXCEPTION 'PRECONDITION_FAILED: Employee purge is temporarily unavailable because the required Tasks database table is not installed. Contact the Super Administrator.';
   END IF;
   ```
   *Impact:* Once `public.tasks` is created, `to_regclass('public.tasks')` evaluates to non-null, immediately unblocking the employee purge workflow.

2. **Draft Document Unlinking ([Line 98](file:///D:/19.Website/HR_Portal/supabase_atomic_purge_rpc.sql#L98)):**
   ```sql
   EXECUTE 'UPDATE public.tasks SET document_id = NULL WHERE document_id = ANY($1)' USING v_draft_doc_ids;
   ```
   *Impact:* Compatible. The `document_id UUID` column exists and permits `NULL` values.

3. **Employee Task Deletion ([Line 117](file:///D:/19.Website/HR_Portal/supabase_atomic_purge_rpc.sql#L117)):**
   ```sql
   EXECUTE 'DELETE FROM public.tasks WHERE employee_id = $1' USING p_employee_id;
   ```
   *Impact:* Compatible. The `employee_id UUID` column exists and the query executes within the surrounding transaction.

---

## 8. Safe Fallback Transition & Zero Downtime

1. **Preservation of `tasks_store`**:
   The migration leaves `system_settings.tasks_store` completely untouched. It does not drop, clear, or modify this record.
2. **Seamless Failover Detection**:
   In [`src/lib/db.ts`](file:///D:/19.Website/HR_Portal/src/lib/db.ts#L4012-4024):
   - When `public.tasks` is missing, PostgREST returns `PGRST205`, triggering `fallbackList()`.
   - As soon as `public.tasks` is created and PostgREST schema cache reloads (`NOTIFY pgrst, 'reload schema'`), queries to `public.tasks` return HTTP 200 with the 2 backfilled tasks.
   - The application naturally switches from fallback mode to database mode with zero downtime and zero deployment restarts required.
3. **Archival Redundancy**:
   Should any unforeseen issue occur, `tasks_store` remains available in `system_settings` as a point-in-time snapshot.

---

## 9. Idempotency & Rollback Considerations

### Idempotency Verification:
- **`CREATE TABLE IF NOT EXISTS`**: Safe to re-run on an existing table.
- **`CREATE INDEX IF NOT EXISTS`**: Safe to re-run without duplicate index errors.
- **`DROP POLICY IF EXISTS ... CREATE POLICY`**: Cleans up existing policy definitions before re-applying.
- **`INSERT ... ON CONFLICT (id) DO NOTHING`**: Safe to re-run without duplicate key violations.
- **Zero Destructive DDL**: No tables or columns are dropped or truncated.

### Rollback Runbook:
If rollback is ever required:
```sql
-- Step 1: Drop public.tasks table
DROP TABLE IF EXISTS public.tasks CASCADE;

-- Step 2: Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
```
Upon dropping `public.tasks`, the application's Data Access Layer in [`src/lib/db.ts`](file:///D:/19.Website/HR_Portal/src/lib/db.ts) immediately intercepts `PGRST205` and seamlessly falls back to `system_settings.tasks_store`, restoring the prior verified state with zero service interruption.
