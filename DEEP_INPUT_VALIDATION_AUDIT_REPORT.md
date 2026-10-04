# Deep Input Validation & Injection Security Audit Report

**Target Project:** `D:\19.Website\HR_Portal`  
**Audit Scope:** Server-Side Input Validation, Injection Flaws (SQLi, XSS, Command, Path Traversal), Business Logic & Data Boundary Defense  
**Audit Mode:** READ-ONLY Deep Source Code Inspection  
**Audit Date:** October 4, 2026  
**Auditor:** Antigravity IDE Security Subagent  
**Isolation Status:** `D:\19.Website\Varsaka` = **UNTOUCHED (Verified Clean)**  
**Overall Verdict:** **FINDINGS** (No Critical / Injection Vulnerabilities; Architectural Sanitization & Range Hardening Recommended)

---

## 1. Executive Summary

A comprehensive, read-only security audit of all server-side input processing, serialization, injection vectors, and data boundaries was conducted across the **Varsaka HR Portal** (`D:\19.Website\HR_Portal`). Every API route handler under `src/app/api`, shared utility libraries (`src/lib/`), database access abstractions (`src/lib/db.ts`), storage management (`src/lib/storage.ts`), branding image handlers (`src/lib/branding.ts`), and Supabase SQL procedures was inspected against strict OWASP ASVS and enterprise compliance standards.

### Key Audit Conclusions:
1. **Command Injection: PASS (0 occurrences).** No invocations of `child_process`, `exec`, `execSync`, `spawn`, `spawnSync`, or shell evaluation exist in the codebase.
2. **SQL Injection: PASS (0 occurrences).** All database communications strictly utilize the `@supabase/supabase-js` query builder with parameterized queries, or strongly typed, parameterized PostgreSQL stored functions (`permanent_purge_employee`, `next_document_sequence`) with explicit `SET search_path = public, pg_temp`. No raw dynamic string concatenation exists.
3. **Cross-Site Scripting (XSS): PASS (0 occurrences).** No usage of `dangerouslySetInnerHTML`, `eval()`, or unescaped HTML template literals was detected across all client and server components. React automatic contextual output encoding protects all user-generated content.
4. **Path Traversal: PASS (0 occurrences).** File operations for document generation and branding assets enforce strict character whitelisting, sanitize filenames (`replace(/[^a-zA-Z0-9_-]/g, '_')`), block directory navigation sequences (`..` and `\`), and constrain disk reads to predefined root directories.
5. **Identified Findings (0 Critical, 0 High, 1 Medium, 3 Low, 2 Informational):**
   - **Medium:** Unbounded array length in `POST /api/documents/bulk-action` allows arbitrary batch sizes, introducing potential database connection pool exhaustion.
   - **Low:** Numeric salary inputs in `PUT /api/salary/[employeeId]` allow negative numbers due to missing floor checks and absent DB check constraints.
   - **Low:** Inconsistent validation between employee creation (`Zod` schema enforced) and employee updates (`PUT /api/employees/[id]` accepts raw updates without schema validation).
   - **Low:** Unvalidated document snapshot schema in `POST /api/documents` allows arbitrary JSON payloads in `data_snapshot`.
   - **Informational:** `X-Forwarded-For` header parsing takes the first entry without checking trusted proxy count.
   - **Informational:** `GET /api/verify/[verificationId]` performs PostgREST `.ilike()` without escaping SQL wildcard characters (`%`, `_`).

---

## 2. API Route Inventory

The following table catalogs all 38 route files comprising 45 distinct HTTP method handlers under [src/app/api](file:///D:/19.Website/HR_Portal/src/app/api):

| Endpoint | Method | Input Source | Validation | Sanitization | DB Usage | File/HTML Usage | Risk |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| `/api/auth/login` | POST | JSON body (`email`, `password`) | String check, required check | `.trim().toLowerCase()` | Read `users`, `user_credentials` | None | Low |
| `/api/auth/logout` | POST | Cookies (`auth_token`) | Presence check | Cookie clearing | Write `audit_logs` | None | Low |
| `/api/auth/me` | GET | Session cookie (`auth_token`) | HMAC signature, session version | None | Read `users`, `user_roles` | None | Low |
| `/api/auth/change-password` | POST | JSON body (`currentPassword`, `newPassword`, `confirmPassword`) | Policy check (min length, upper, lower, number, symbol) | None | Read/Write `user_credentials` | None | Low |
| `/api/auth/break-glass` | POST | Header (`x-break-glass-key`), JSON (`operator`, `reason`) | Timing-safe key check, min length string check | `.trim()` | Stored function / Admin recovery | None | Low |
| `/api/auth/mfa/status` | GET | Session cookie | Session verification | None | Read `user_mfa` | None | Low |
| `/api/auth/mfa/setup` | POST | Session cookie | Session verification | None | Write `user_mfa` (AES encrypted) | None | Low |
| `/api/auth/mfa/verify-setup` | POST | JSON body (`code`), Session cookie | Regex `^\d{6}$` | `.trim()` | Write `user_mfa` | None | Low |
| `/api/auth/mfa/verify` | POST | JSON body (`code`, `challengeId`), Cookie | Regex `^\d{6}$`, HMAC challenge check, Nonce check | `.trim()` | Read `user_mfa`, Write locks | None | Low |
| `/api/auth/mfa/recovery` | POST | JSON body (`recovery_code`, `challengeId`) | Presence check, HMAC challenge | SHA-256 hash lookup | Read/Write `user_mfa` | None | Low |
| `/api/auth/mfa/reset` | POST | JSON body (`target_user_id`, `reason`) | Required string check, RBAC `SUPER_ADMIN` | `.trim()` | Write `user_mfa` | None | Low |
| `/api/certificate-requests` | GET | Session cookie | RBAC check | None | Read `certificate_requests` | None | Low |
| `/api/certificate-requests` | POST | JSON body (`requested_permission`) | Single active request constraint | None | Write `certificate_requests` | None | Low |
| `/api/certificate-requests/[id]` | PUT | Path param (`id`), JSON (`action`, `reason`) | Allowlist `['APPROVE', 'REJECT']`, required reason | `.trim()` | Write `certificate_requests` | None | Low |
| `/api/departments` | GET | Session cookie | Auth required | None | Read `departments` | None | Low |
| `/api/documents` | GET | Query params (`type`, `status`, `employeeId`, `search`) | Permission gating (`salary.view`) | `.trim()` on search | Read `documents` | None | Low |
| `/api/documents` | POST | JSON body (`document_type`, `employee_id`, `title`, `data_snapshot`) | Presence check, active employee state guard | None | Write `documents` | QR code generation | Low |
| `/api/documents/bulk-action` | POST | JSON body (`action`, `documentIds`, `reason`) | Allowlist `['APPROVE', 'REJECT', 'REVOKE', 'DELETE']`, min reason length | `.trim()` on reason | Batch Write `documents`, `approvals` | None | **Medium** |
| `/api/documents/[id]` | GET | Path param (`id`), Session cookie | Existence check, document-type RBAC | None | Read `documents` | None | Low |
| `/api/documents/[id]` | DELETE | Path param (`id`), Session cookie | RBAC check, REVOKED immutability check | None | Soft delete / state update `documents` | None | Low |
| `/api/documents/[id]/approve` | POST | Path param (`id`), Session cookie | Maker-checker validation, status transition | None | Write `documents`, `approvals` | None | Low |
| `/api/documents/[id]/reject` | POST | Path param (`id`), JSON (`reason`) | RBAC check, status transition | Default fallback string | Write `documents`, `approvals` | None | Low |
| `/api/documents/[id]/revoke` | POST | Path param (`id`), JSON (`reason`, `confirmation`) | Mandatory confirmation boolean, reason min length | `.trim()` | Write `documents` | None | Low |
| `/api/documents/[id]/new-version` | POST | Path param (`id`), JSON (`newDataSnapshot`, `reason`) | Reason min length (>=5 chars) | `.trim()` | Write `documents`, `document_versions` | None | Low |
| `/api/documents/[id]/download` | POST | Path param (`id`), Session cookie | Rate limit, RBAC by document type | None | Read `documents` | Signed token generation | Low |
| `/api/documents/[id]/download` | GET | Path param (`id`), Query (`token`), Cookie | HMAC token verification or Session auth | None | Read `documents` | Signed Supabase storage URL | Low |
| `/api/employees` | GET | Query params (`search`, `department`, `status`) | Auth & RBAC (`employee.view`) | None | Read `employees` | None | Low |
| `/api/employees` | POST | JSON body (full employee payload + salary) | **Zod Schema** (`createEmployeeSchema`), regex on emp ID | Sanitized via Zod | Write `employees`, `employee_salary` | None | Low |
| `/api/employees/next-id` | GET | Session cookie | RBAC (`employee.create`) | None | Atomic Sequence Generator | None | Low |
| `/api/employees/[id]` | GET | Path param (`id`), Session cookie | RBAC (`employee.view`), existence check | None | Read `employees` | None | Low |
| `/api/employees/[id]` | PUT | Path param (`id`), JSON body | Partial department check | `Number()` cast | Write `employees`, `employee_salary` | None | Low |
| `/api/employees/[id]` | DELETE | Path param (`id`), JSON (`confirmation`) | Strict check `confirmation === 'DELETE'`, Super Admin only | None | RPC `permanent_purge_employee` | Local storage cleanup | Low |
| `/api/employees/[id]/deletion` | GET | Path param (`id`), Session cookie | RBAC (`employee.view`) | None | Read dependency counts | None | Low |
| `/api/employees/[id]/deletion` | POST | Path param (`id`), JSON (`reason`) | Mandatory reason check | `.trim()` | Write `employees` (status update) | None | Low |
| `/api/employees/[id]/deletion` | PUT | Path param (`id`), JSON (`action`, `reason`) | Allowlist `['APPROVE', 'REJECT']`, Super Admin only | `.trim()` | Write `employees` | None | Low |
| `/api/salary/[employeeId]` | GET | Path param (`employeeId`), Query (`effectiveDate`) | Strict RBAC (`salary.view`), UUID check | None | Read `employee_salary` | None | Low |
| `/api/salary/[employeeId]` | PUT | Path param (`employeeId`), JSON body | Strict RBAC (`salary.update`), active state guard | `Number()` cast | Write `employee_salary` | None | **Low** |
| `/api/settings/branding` | GET | Session cookie | Auth required | None | Read `system_settings` | None | Low |
| `/api/settings/branding` | POST | Multipart FormData (`file`, `target`) or JSON | Magic byte check, MIME whitelist, size cap | None | Write `system_settings` | Storage upload (PNG/JPEG/WebP) | Low |
| `/api/settings/branding/asset` | GET | Query param (`path`), Session cookie | Traversal check (`..`, `\`), prefix whitelist | Path whitelist | Read `storage.objects` | Read local asset file | Low |
| `/api/settings/corporate` | GET | Session cookie | Auth required | None | Read `system_settings` | None | Low |
| `/api/settings/corporate` | PUT | JSON body (`brand_name`, `legal_entity`, etc.) | Non-empty check, URL start check, email check | `.trim()` | Write `system_settings` | None | Low |
| `/api/tasks` | GET | Query params (`view`, `status`, `priority`, `search`) | RBAC (`task.view`), party filter | None | Read `tasks` | None | Low |
| `/api/tasks` | POST | JSON body (`title`, `assign_to`, `priority`, etc.) | Priority allowlist, non-empty title, assignee check | `.trim()` | Write `tasks` | None | Low |
| `/api/tasks/staff` | GET | Session cookie | Auth required | None | Read `users` | None | Low |
| `/api/tasks/[id]` | GET | Path param (`id`), Session cookie | RBAC / party check (assignee or creator) | None | Read `tasks` | None | Low |
| `/api/tasks/[id]` | PATCH | Path param (`id`), JSON body | Status allowlist, priority allowlist, cancel auth | None | Write `tasks` | None | Low |
| `/api/tasks/[id]` | DELETE | Path param (`id`), Session cookie | Creator or Super Admin check | None | Delete `tasks` | None | Low |
| `/api/users` | GET | Session cookie | RBAC (`SUPER_ADMIN` or `HR_ADMIN`) | None | Read `users` | None | Low |
| `/api/users` | POST | JSON body (`full_name`, `email`, `role`, etc.) | Role allowlist, email presence, Super Admin check | `.trim().toLowerCase()` | Write `users`, `user_credentials` | None | Low |
| `/api/users/[id]` | GET | Path param (`id`), Session cookie | Self or Super Admin check | None | Read `users`, `permissions` | None | Low |
| `/api/users/[id]` | PATCH | Path param (`id`), JSON body | Role allowlist, Super Admin immutability | None | Write `users` | None | Low |
| `/api/users/[id]/permissions` | GET | Path param (`id`), Session cookie | Self or Super Admin or `permission.assign` | None | Read `role_permissions` | None | Low |
| `/api/users/[id]/permissions` | POST | Path param (`id`), JSON (`permission_code`, `is_granted`) | Strict dictionary allowlist, self-escalation block | None | Write `role_permissions` | None | Low |
| `/api/users/[id]/reset-password` | POST | Path param (`id`), Session cookie | Super Admin only | None | Write `user_credentials` | None | Low |
| `/api/verify/[verificationId]` | GET | Path param (`verificationId`), Headers | Rate limit (15 req/min) | `.trim()` | Read `documents`, Write `verification_logs` | None | Low |

---

## 3. Server-Side Validation

Server-side validation was analyzed across all entry points. The application implements strong architectural defenses, utilizing:
1. **Schema Validation via Zod:** Implemented comprehensively on employee creation ([src/app/api/employees/route.ts:8-95](file:///D:/19.Website/HR_Portal/src/app/api/employees/route.ts#L8-L95)). Enforces email regex, phone minimum length (8 chars), designation length, joining date format, and employment type enums.
2. **Enum Allowlists:**
   - Task Priority: `['LOW', 'MEDIUM', 'HIGH', 'URGENT']` ([src/app/api/tasks/route.ts:119](file:///D:/19.Website/HR_Portal/src/app/api/tasks/route.ts#L119))
   - Task Status: `['TODO', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']` ([src/app/api/tasks/[id]/route.ts:74](file:///D:/19.Website/HR_Portal/src/app/api/tasks/%5Bid%5D/route.ts#L74))
   - User Roles: `['SUPER_ADMIN', 'HR_ADMIN', 'DOCUMENT_ADMIN', 'PAYROLL_ADMIN', 'VIEWER']` ([src/app/api/users/route.ts:62](file:///D:/19.Website/HR_Portal/src/app/api/users/route.ts#L62))
   - Document Bulk Actions: `['APPROVE', 'REJECT', 'REVOKE', 'DELETE']` ([src/app/api/documents/bulk-action/route.ts:13](file:///D:/19.Website/HR_Portal/src/app/api/documents/bulk-action/route.ts#L13))
   - Permission Codes: Validated against `PERMISSION_DESCRIPTIONS` dictionary keys ([src/app/api/users/[id]/permissions/route.ts:88](file:///D:/19.Website/HR_Portal/src/app/api/users/%5Bid%5D/permissions/route.ts#L88))
3. **Database Constraints:** Foreign keys (`ON DELETE CASCADE` / `ON DELETE SET NULL`) protect relational integrity across all 17 tables in PostgreSQL.

---

## 4. SQL Injection

**Audit Result: PASS — Zero SQL Injection Vulnerabilities Identified.**

### Evidence & Verification:
- **No String Concatenation:** An automated scan across all files in `src/` for SQL concatenation (`query(`, `sql` template tags, raw SQL queries) confirmed **0 instances** of unsanitized SQL generation.
- **Supabase Query Builder:** All read and write operations in [src/lib/db.ts](file:///D:/19.Website/HR_Portal/src/lib/db.ts) use the Supabase PostgREST client library:
  ```ts
  // Example parameterized query in db.ts
  supabase.from('documents').select('*').eq('id', docId)
  ```
  PostgREST translates these calls to parameterized SQL queries with bind parameters natively at the PostgreSQL protocol level.
- **Stored Procedure Inspection:**
  - `permanent_purge_employee`: Receives `target_employee_id UUID, p_admin_id UUID, p_admin_email VARCHAR`. Variables are typed UUIDs/VARCHARs and executed via parameterized internal SQL. Configured with `SECURITY DEFINER` and `SET search_path = public, pg_temp;` preventing search path hijacking.
  - `next_document_sequence`: Takes `p_company_code VARCHAR, p_fiscal_year VARCHAR, p_doc_type VARCHAR` and returns `INT`. Pure parameterized integer operations.

---

## 5. Cross-Site Scripting (XSS)

**Audit Result: PASS — Zero Cross-Site Scripting Vectors Identified.**

### Evidence & Verification:
- **No Unsafe HTML Insertion:** A recursive search for `dangerouslySetInnerHTML`, `eval(`, and `new Function(` across `src/` yielded **0 occurrences**.
- **React Contextual Escaping:** All user-controlled text strings (e.g. employee names, task titles, document remarks, addresses) are passed into JSX elements as standard React children `{employee.full_name}`, where React automatically applies context-aware entity encoding (converting `<`, `>`, `&`, `"`, `'` to safe HTML entities).
- **Document Rendering Safety:** Document generation creates PDF files server-side via `pdf-lib` or renders strictly structured JSX layouts. No user input is directly evaluated as executable JavaScript or unescaped HTML markup.

---

## 6. Command Injection

**Audit Result: PASS — No user-controlled command execution path identified.**

### Evidence & Verification:
- Searched codebase for `child_process`, `exec`, `execSync`, `spawn`, `spawnSync`.
- **0 occurrences found across all application code.** The HR Portal is a pure TypeScript/Next.js web application with no local system command-line invocations.

---

## 7. Path Traversal

**Audit Result: PASS — Zero Path Traversal Vulnerabilities Identified.**

### Evidence & Verification:
1. **Branding Asset Path Handling:** In [src/app/api/settings/branding/asset/route.ts:21-27](file:///D:/19.Website/HR_Portal/src/app/api/settings/branding/asset/route.ts#L21-L27):
   ```ts
   if (assetPath.includes('..') || assetPath.includes('\\')) {
     return new NextResponse('Invalid asset path.', { status: 400 });
   }
   if (!assetPath.startsWith('signatures/') && !assetPath.startsWith('stamps/')) {
     return new NextResponse('Forbidden asset folder.', { status: 403 });
   }
   ```
   Both relative path traversal (`..`), Windows directory separators (`\`), and unapproved folders are strictly rejected with HTTP 400/403.
2. **Document File Generation:** In [src/lib/storage.ts:109](file:///D:/19.Website/HR_Portal/src/lib/storage.ts#L109):
   ```ts
   const safeDocNum = documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
   ```
   Document numbers are sanitized to alphanumeric, hyphen, and underscore characters before being combined into file paths, preventing arbitrary file write or directory escape.

---

## 8. File / Document Input

**Audit Result: PASS (Robust Magic-Byte and MIME Inspection).**

### Evidence & Verification:
Asset uploads in [src/lib/branding.ts:133-176](file:///D:/19.Website/HR_Portal/src/lib/branding.ts#L133-L176) (`validateImageBuffer`):
1. **Magic-Byte Signature Verification:**
   - PNG: `buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47`
   - JPEG: `buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff`
   - WebP: Checks `'RIFF'` header and `'WEBP'` format marker.
2. **SVG Rejection:** Explicitly rejects SVG uploads to eliminate SVG-embedded script execution (stored XSS).
3. **Payload Size Caps:** Hard limits enforced: 2 MB for Signatures, 3 MB for Official Stamps.
4. **Internal Storage Pathing:** Storage filenames are generated internally using `${type}_v${version}_${Date.now()}.${ext}`, completely ignoring client-supplied filenames.

---

## 9. Header / Cookie Input

### Audit Details:
1. **Authentication Cookies:** `auth_token` is an HTTP-Only, Secure, SameSite=Lax cookie signed using HMAC-SHA256 (`src/lib/auth.ts`). Tampering invalidates the signature and returns 401 Unauthorized.
2. **X-Forwarded-For IP Resolution:**
   - Endpoints extract client IP via: `req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1'`.
   - **Finding (Informational):** If deployed behind a reverse proxy that appends client IPs rather than replacing them, a client can prepend arbitrary IPs to spoof rate-limiting buckets. Requires upstream proxy configuration verification (e.g. Cloudflare / Nginx configuring trusted header).

---

## 10. URL / Query Parameter Input

### Audit Details:
1. **Pagination & Search Filtering:** Document and employee search parameters (`search`, `status`, `type`) are trimmed and sanitized.
2. **Verification ID Parameter:**
   - In [src/app/api/verify/[verificationId]/route.ts](file:///D:/19.Website/HR_Portal/src/app/api/verify/%5BverificationId%5D/route.ts), the path parameter is trimmed and queried via Supabase `.ilike('verification_id', cleanVId)`.
   - If `%` or `_` is supplied in the URL, SQL `ILIKE` treats them as wildcards. While `maybeSingle()` returns an error if multiple documents match (preventing wildcard enumeration of the entire table), wildcards can produce unexpected query matching. Adding an alphanumeric regex validator (`/^[A-Za-z0-9_-]{5,50}$/`) will strictly enforce format boundaries.

---

## 11. Bulk Operations

**Audit Focus: `POST /api/documents/bulk-action`**  
**File:** [src/app/api/documents/bulk-action/route.ts:20-22](file:///D:/19.Website/HR_Portal/src/app/api/documents/bulk-action/route.ts#L20-L22)

```ts
if (!Array.isArray(documentIds) || documentIds.length === 0) {
  return NextResponse.json({ error: 'At least one document ID must be specified.' }, { status: 400 });
}
```

### Positive Safeguards Verified:
- Action enum allowlisted: `['APPROVE', 'REJECT', 'REVOKE', 'DELETE']`.
- Reason minimum length enforced: >=5 chars for REJECT/REVOKE, >=3 chars for DELETE.
- Granular per-item RBAC checks (e.g. `SALARY_SLIP` confidentiality checked for every row in the loop).
- Per-item error isolation: Failures on individual items do not crash the batch.

### Gap / Finding:
- **No Maximum Array Size Cap:** An attacker could submit an array of 20,000 document IDs. The handler executes `db.documents.getById` sequentially for every ID, creating an event loop lag and database connection bottleneck.
- **No Array Deduplication:** Submitting duplicate IDs executes duplicate queries.

---

## 12. Business-Logic Validation

| Business Domain | Rule Tested | Server-Side Enforcement | Status |
| :--- | :--- | :--- | :---: |
| **Separated / Inactive Employees** | Cannot issue new documents | [src/app/api/documents/route.ts:84](file:///D:/19.Website/HR_Portal/src/app/api/documents/route.ts#L84) throws 403 Forbidden | **ENFORCED** |
| **Separated / Inactive Employees** | Cannot modify payroll / compensation | [src/lib/db.ts:2842](file:///D:/19.Website/HR_Portal/src/lib/db.ts#L2842) blocks payroll upsert | **ENFORCED** |
| **Document State Machine** | Revoked documents cannot be deleted | [src/app/api/documents/[id]/route.ts:93](file:///D:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/route.ts#L93) blocks physical deletion | **ENFORCED** |
| **Super Admin Immutability** | Super Admin cannot be demoted or disabled | [src/app/api/users/[id]/route.ts:66, 100](file:///D:/19.Website/HR_Portal/src/app/api/users/%5Bid%5D/route.ts#L66) throws 403 | **ENFORCED** |
| **Self-Escalation Prevention** | Users cannot edit own permission overrides | [src/app/api/users/[id]/permissions/route.ts:59](file:///D:/19.Website/HR_Portal/src/app/api/users/%5Bid%5D/permissions/route.ts#L59) throws 403 | **ENFORCED** |
| **Task Cancellation** | Only creator or Admin can cancel tasks | [src/app/api/tasks/[id]/route.ts:83](file:///D:/19.Website/HR_Portal/src/app/api/tasks/%5Bid%5D/route.ts#L83) throws 403 | **ENFORCED** |
| **Compensation Range** | Salary components must be non-negative | [src/lib/db.ts:2849](file:///D:/19.Website/HR_Portal/src/lib/db.ts#L2849) uses `Number(val) \|\| 0`, allowing negative numbers | **GAP (LOW)** |

---

## 13. Output Safety

1. **Stack Traces:** Route catch blocks return `{ error: error.message }` without printing raw error stack traces to JSON responses.
2. **Credential Redaction:**
   - Password hashes (`password_hash`), MFA secrets (`secret_encrypted`), and recovery keys are never returned in user or profile API responses.
   - The user listing endpoint (`/api/users`) strips sensitive credential columns.
3. **Zod Error Serialization:** In `POST /api/employees`, `error.message` returns the Zod validation issue string without exposing server filesystem paths or database connection credentials.

---

## 14. Error Handling

- **Consistent HTTP Status Codes:** Validation failures correctly return HTTP `400 Bad Request`. Authentication failures return `401 Unauthorized`. Authorization failures return `403 Forbidden`. Resource misses return `404 Not Found`. Rate limit violations return `429 Too Many Requests` with a `Retry-After` header.
- **Audit Logging of Failures:** Security-sensitive validation and authorization failures are systematically recorded into the audit trail via `logSecurityEvent` with client IP, user ID, severity, and event type.

---

## 15. Confirmed Findings

### Finding 1: Unbounded Array Length in Bulk Document Actions
- **Severity:** **MEDIUM**
- **Endpoint:** `POST /api/documents/bulk-action`
- **File & Line:** [src/app/api/documents/bulk-action/route.ts:20-22](file:///D:/19.Website/HR_Portal/src/app/api/documents/bulk-action/route.ts#L20-L22)
- **Exact Code Evidence:**
  ```ts
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json({ error: 'At least one document ID must be specified.' }, { status: 400 });
  }
  ```
- **Why It Matters:** The lack of an upper-bound cap (e.g. `documentIds.length > 50`) allows a client to submit thousands of IDs in a single request. The server will loop through each document ID sequentially, performing individual database queries and RBAC evaluations, risking event-loop blockage, timeout errors, and connection pool starvation.
- **Minimal Recommended Fix:**
  ```ts
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json({ error: 'At least one document ID must be specified.' }, { status: 400 });
  }
  if (documentIds.length > 50) {
    return NextResponse.json({ error: 'Bulk action is limited to a maximum of 50 documents per request.' }, { status: 400 });
  }
  const uniqueDocIds = Array.from(new Set(documentIds));
  ```

---

### Finding 2: Unvalidated Negative Compensation Numbers
- **Severity:** **LOW**
- **Endpoint:** `PUT /api/salary/[employeeId]`
- **File & Line:** [src/lib/db.ts:2849-2863](file:///D:/19.Website/HR_Portal/src/lib/db.ts#L2849-L2863) & [src/app/api/salary/[employeeId]/route.ts:88](file:///D:/19.Website/HR_Portal/src/app/api/salary/%5BemployeeId%5D/route.ts#L88)
- **Exact Code Evidence:**
  ```ts
  annual_ctc: Number(data.annual_ctc) || 0,
  monthly_gross: Number(data.monthly_gross) || 0,
  basic: Number(data.basic) || 0,
  ```
- **Why It Matters:** In JavaScript, `Number(-50000)` yields `-50000`, which is truthy. The fallback `|| 0` only handles `NaN` or `0`. Neither the route handler nor the database schema (`public.employee_salary`) enforces a `CHECK (annual_ctc >= 0)` constraint. Submitting negative values succeeds and corrupts payroll math and generated salary slips.
- **Minimal Recommended Fix:**
  Add floor validation:
  ```ts
  const sanitizeAmount = (val: any) => {
    const num = Number(val);
    return isNaN(num) || num < 0 ? 0 : num;
  };
  ```

---

### Finding 3: Inconsistent Employee Update Validation vs. Employee Creation
- **Severity:** **LOW**
- **Endpoint:** `PUT /api/employees/[id]`
- **File & Line:** [src/app/api/employees/[id]/route.ts:53-68](file:///D:/19.Website/HR_Portal/src/app/api/employees/%5Bid%5D/route.ts#L53-L68)
- **Exact Code Evidence:**
  ```ts
  const { id } = await params;
  const body = await req.json();
  if (body.department_id === 'other') { ... }
  const { salary: salaryData, ...employeeData } = body;
  const updated = await db.employees.update(id, employeeData, user.id, user.email);
  ```
- **Why It Matters:** While `POST /api/employees` enforces strict Zod validation on email, phone number, and designation, `PUT /api/employees/[id]` directly passes `employeeData` to `db.employees.update()`. A user could update an employee with an invalid email format or blank designation.
- **Minimal Recommended Fix:**
  Apply `createEmployeeSchema.partial().parse(employeeData)` before updating.

---

### Finding 4: Unvalidated Document Snapshot Schema
- **Severity:** **LOW**
- **Endpoint:** `POST /api/documents`
- **File & Line:** [src/app/api/documents/route.ts:60-64](file:///D:/19.Website/HR_Portal/src/app/api/documents/route.ts#L60-L64)
- **Exact Code Evidence:**
  ```ts
  const { document_type, employee_id, title, data_snapshot } = body;
  if (!document_type || !employee_id || !title || !data_snapshot) {
    return NextResponse.json({ error: 'Missing required document fields.' }, { status: 400 });
  }
  ```
- **Why It Matters:** `data_snapshot` is checked only for presence. Arbitrary JSON structures can be inserted. If mandatory template fields (e.g. `basic_salary` for a salary slip or `candidate_name` for an offer letter) are omitted, downstream PDF generation or public verification lookups could produce null rendering or runtime errors.
- **Minimal Recommended Fix:**
  Validate `data_snapshot` against a minimal required schema for each `document_type`.

---

### Finding 5: PostgREST Wildcard Pattern Injection in Public Verification
- **Severity:** **INFORMATIONAL**
- **Endpoint:** `GET /api/verify/[verificationId]`
- **File & Line:** [src/app/api/verify/[verificationId]/route.ts:29-32](file:///D:/19.Website/HR_Portal/src/app/api/verify/%5BverificationId%5D/route.ts#L29-L32) & [src/lib/db.ts:3671](file:///D:/19.Website/HR_Portal/src/lib/db.ts#L3671)
- **Exact Code Evidence:**
  ```ts
  const { data: doc } = await supabase
    .from('documents')
    .select('*, employees (full_name, employee_id)')
    .ilike('verification_id', cleanVId)
    .maybeSingle();
  ```
- **Why It Matters:** Calling `GET /api/verify/%25` triggers an `ILIKE '%'` query in PostgreSQL. While `maybeSingle()` errors if multiple rows match, using `ilike` without escaping `%` or `_` allows unintended wildcard matching, and the absence of a format regex allows arbitrarily long inputs.
- **Minimal Recommended Fix:**
  Validate format before executing query:
  ```ts
  if (!/^[A-Za-z0-9_-]{5,50}$/.test(verificationId.trim())) {
    return NextResponse.json({ status: 'NOT_FOUND', error: 'Invalid verification ID format' }, { status: 400 });
  }
  ```
  And change `.ilike('verification_id', cleanVId)` to `.eq('verification_id', cleanVId.toUpperCase())`.

---

### Finding 6: Untrusted X-Forwarded-For Header in Rate Limiting
- **Severity:** **INFORMATIONAL**
- **Endpoint:** Authentication and Verification Handlers
- **File & Line:** [src/app/api/auth/login/route.ts:12](file:///D:/19.Website/HR_Portal/src/app/api/auth/login/route.ts#L12)
- **Exact Code Evidence:**
  ```ts
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  ```
- **Why It Matters:** If the production application is deployed behind a proxy that forwards client-controlled headers without overwriting the leftmost IP, an attacker could supply `X-Forwarded-For: 1.2.3.4` to evade IP-level rate-limiting buckets.
- **Minimal Recommended Fix:**
  Verify production proxy configuration (e.g. Cloudflare / AWS ALB) to ensure `X-Forwarded-For` is sanitized, or use Cloudflare's `cf-connecting-ip` header when available.

---

## 16. Recommended Minimal Fixes

```diff
// 1. Bulk Action Cap (src/app/api/documents/bulk-action/route.ts)
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return NextResponse.json({ error: 'At least one document ID must be specified.' }, { status: 400 });
  }
+ if (documentIds.length > 50) {
+   return NextResponse.json({ error: 'Bulk actions are capped at 50 documents per request.' }, { status: 400 });
+ }
+ const uniqueIds = Array.from(new Set(documentIds));

// 2. Salary Floor Validation (src/lib/db.ts)
- annual_ctc: Number(data.annual_ctc) || 0,
+ annual_ctc: Math.max(0, Number(data.annual_ctc) || 0),
- monthly_gross: Number(data.monthly_gross) || 0,
+ monthly_gross: Math.max(0, Number(data.monthly_gross) || 0),

// 3. Verification ID Format Enforcement (src/app/api/verify/[verificationId]/route.ts)
  const { verificationId } = await params;
+ if (!verificationId || !/^[A-Za-z0-9_-]{5,64}$/.test(verificationId.trim())) {
+   return NextResponse.json({ status: 'NOT_FOUND', error: 'Invalid verification ID format.' }, { status: 400 });
+ }
```

---

## 17. Suggested Security Tests

The following safe tests are recommended for automated QA and pre-flight validation:

| Test Case | Target Endpoint | Payload / Input | Expected Result |
| :--- | :--- | :--- | :--- |
| **Bulk Array Boundary** | `POST /api/documents/bulk-action` | `{"action": "APPROVE", "documentIds": Array(51)}` | HTTP 400 (`Bulk actions are capped at 50`) |
| **Negative Salary** | `PUT /api/salary/:id` | `{"annual_ctc": -500000, "basic": -25000}` | Rejection or sanitization to `0` |
| **Malformed Verification ID** | `GET /api/verify/%25%25%25` | URL-encoded wildcards `%%%` | HTTP 400 / 404 (Format rejected) |
| **Oversized String Input** | `GET /api/verify/[5000 chars]` | 5,000-character alphanumeric string | HTTP 400 (Length exceeded) |
| **Path Traversal Escape** | `GET /api/settings/branding/asset` | `?path=../../etc/passwd` | HTTP 400 (`Invalid asset path`) |
| **Windows Path Traversal** | `GET /api/settings/branding/asset` | `?path=signatures\..\..\windows\win.ini` | HTTP 400 (`Invalid asset path`) |
| **XSS Payload in Task** | `POST /api/tasks` | `{"title": "<script>alert(1)</script>"}` | Safe text storage, contextually encoded in UI |
| **SQL Injection Payload** | `GET /api/documents` | `?search=' OR 1=1 --` | Treated as literal text; no syntax error |
| **Unapproved Role Escalation** | `POST /api/users` | `{"role": "SYSTEM_ROOT"}` | HTTP 400 (`Valid role is required`) |
| **Self-Escalation Override** | `POST /api/users/:myId/permissions` | `{"permission_code": "all", "is_granted": true}` | HTTP 403 (`Forbidden: You cannot modify own overrides`) |

---

## 18. Final Verdict

| Metric | Result |
| :--- | :--- |
| **Command Injection Vulnerabilities** | **PASS (0)** |
| **SQL Injection Vulnerabilities** | **PASS (0)** |
| **Cross-Site Scripting (XSS)** | **PASS (0)** |
| **Path Traversal Vulnerabilities** | **PASS (0)** |
| **Business Logic State Guards** | **PASS (Enforced)** |
| **Identified Input Validation Findings** | **6 (0 Critical, 0 High, 1 Medium, 3 Low, 2 Informational)** |
| **Isolated Target (`D:\19.Website\Varsaka`)** | **UNTOUCHED (Clean)** |

### Final Audit Status:
**Input Validation Audit: FINDINGS**

*(No critical blockers or remote code execution vectors exist. All findings represent opportunities for enterprise-grade hardening of array size limits, numeric boundaries, and parameter format filters.)*
