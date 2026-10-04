# Deep Error Handling & Information Leakage Security Audit Report

**Target Project:** `D:\19.Website\HR_Portal`  
**Audit Scope:** Error Responses, Exception Handling, Database Leakage, Authentication & Authorization Disclosures, Logging Security, and Error Boundaries  
**Audit Mode:** READ-ONLY Source Code & Configuration Inspection  
**Audit Date:** October 4, 2026  
**Auditor:** Antigravity IDE Security Subagent  
**Isolation Status:** `D:\19.Website\Varsaka` = **UNTOUCHED (Verified Clean)**  
**Overall Verdict:** **FINDINGS** (No Critical Leaks or Stack Trace Exposure; Database Error & Authorization Oracle Hardening Recommended)

---

## 1. Executive Summary

A comprehensive, read-only security audit of error handling and information leakage was conducted across the **Varsaka HR Portal** (`D:\19.Website\HR_Portal`). The audit evaluated all 38 API route files (45 handlers) under `src/app/api`, database query execution routines (`src/lib/db.ts`), storage subsystems (`src/lib/storage.ts`), authentication and session validation (`src/lib/auth.ts`, `src/lib/mfa.ts`), audit/security logging pipelines (`src/lib/audit.ts`), and Next.js App Router error handling.

### Key Audit Conclusions:
1. **Stack Trace Exposure: PASS (0 occurrences).** No API endpoints return `error.stack` or raw V8 call traces to clients. React production compilation hides component stack traces.
2. **Logging Pipeline Security: PASS.** `src/lib/audit.ts` actively strips 13 sensitive fields (`password`, `token`, `secret`, `apiKey`, `serviceRoleKey`, `totpSecret`, `mfaSecret`, `secret_encrypted`, `recoveryCode`, etc.) and masks financial identifiers (PAN, bank account numbers) prior to database insertion.
3. **Identified Findings (0 Critical, 0 High, 2 Medium, 2 Low, 2 Informational):**
   - **Medium (Finding 1):** In 37 database operations in `src/lib/db.ts`, errors are wrapped as `Supabase error (functionName): ${error.message}`. Because API route catch blocks return `{ error: error.message }`, raw PostgreSQL table names, constraint names, and query details are returned directly in HTTP 400/500 responses.
   - **Medium (Finding 2):** Discrepant 404 vs 403 status codes in `GET /api/documents/[id]` and `GET /api/tasks/[id]` act as an authorization oracle, revealing whether a confidential document or task ID exists before checking if the caller has permissions.
   - **Low (Finding 3):** Authentication state enumeration in `/api/auth/login` leaks account existence when an account is locked (HTTP 423) or when a temporary password has expired (evaluated before password verification).
   - **Low (Finding 4):** Next.js App Router error boundaries (`error.tsx`, `global-error.tsx`, `not-found.tsx`) are missing from `src/app/`, leaving the application dependent on default framework error rendering.
   - **Informational (Finding 5):** Public verification endpoint `/api/verify/[verificationId]` returns `{ status: 'NOT_FOUND', error: error.message }` paired with an HTTP 500 status code on caught errors.
   - **Informational (Finding 6):** Local storage asset endpoint reveals underlying storage mode via `"Asset not found on disk."`.

---

## 2. API Error Response Audit

All 38 API route files were inspected. The table below details the error handling behavior across core API endpoints:

| Endpoint | Method | Catch Block Behavior | User-Facing Error Content | Disclosed Internals | Severity |
| :--- | :---: | :--- | :--- | :--- | :---: |
| `/api/auth/login` | POST | Custom catch block | `{ error: error?.message ? ... : ... }` | Returns `error.message` on uncaught 500 exceptions | Low |
| `/api/auth/change-password` | POST | Policy validation catch | Policy failure array joined as text | None (safe validation strings) | Pass |
| `/api/auth/break-glass` | POST | Catch block | `{ error: error.message \|\| 'Internal Server Error' }` | Discloses error message on recovery failure | Low |
| `/api/auth/mfa/verify` | POST | Catch block | Generic auth/MFA failure messages | None (safe strings) | Pass |
| `/api/documents` | GET | `catch (error: any)` | `{ error: error.message }` (500) | Exposes `Supabase error (documents.list)` | **Medium** |
| `/api/documents` | POST | `catch (error: any)` | `{ error: error.message }` (400) | Exposes `Supabase error (documents.create)` | **Medium** |
| `/api/documents/bulk-action` | POST | `catch (error: any)` | `{ error: error.message }` (500) | Exposes batch database exceptions | **Medium** |
| `/api/documents/[id]` | GET | `catch (error: any)` | `{ error: error.message }` (500) | Exposes `Supabase error (documents.getById)` | **Medium** |
| `/api/documents/[id]/download` | GET | `catch (error: any)` | `{ error: error.message }` (500) | Exposes token verification or storage errors | Low |
| `/api/employees` | GET | `catch (error: any)` | `{ error: error.message }` (500) | Exposes `Supabase error (employees.list)` | **Medium** |
| `/api/employees` | POST | `catch (error: any)` | `{ error: error.message }` (400) | Returns raw Zod JSON issue string or DB error | Low |
| `/api/employees/[id]` | PUT | `catch (error: any)` | `{ error: error.message }` (400) | Exposes update database exceptions | **Medium** |
| `/api/employees/[id]` | DELETE | Custom catch mapping | `{ error: msg, canPurge: false }` | Exposes internal RPC error messages | Low |
| `/api/salary/[employeeId]` | GET | `catch (error: any)` | `{ error: error.message }` (500) | Exposes `Supabase error (salary.getByEmployeeId)` | **Medium** |
| `/api/salary/[employeeId]` | PUT | `catch (error: any)` | `{ error: error.message }` (400) | Exposes `Supabase error (salary.upsert)` | **Medium** |
| `/api/settings/branding/asset`| GET | Custom catch | `new NextResponse(error.message)` | Exposes `"Asset not found on disk."` | Info |
| `/api/tasks` | GET/POST | `catch (error: any)` | `{ error: error.message \|\| 'Internal Server Error' }` | Exposes task database query errors | **Medium** |
| `/api/tasks/[id]` | GET/PATCH| `catch (error: any)` | `{ error: error.message \|\| 'Internal Server Error' }` | Exposes task record query errors | **Medium** |
| `/api/verify/[verificationId]`| GET | `catch (error: any)` | `{ status: 'NOT_FOUND', error: error.message }` (500) | Exposes `Supabase error (documents.getByVerificationId)` | **Medium** |

---

## 3. Raw Error Message Analysis

An audit of string extraction and serialization patterns across the application revealed:
- `error.stack` / `err.stack`: **0 instances returned in API responses.**
- `JSON.stringify(error)`: **0 instances returned in API responses.**
- `error.message`: **Prevalently returned across route catch blocks.**

### Analysis:
Returning `error.message` is safe when errors originate from intentional domain validations (e.g. `throw new Error("Task title is required")`). However, because uncaught driver errors bubble up to the route catch block, any PostgreSQL driver error, connection timeout, or relational foreign key violation is directly forwarded to the client.

---

## 4. Database / Supabase Error Analysis

A comprehensive scan of [src/lib/db.ts](file:///D:/19.Website/HR_Portal/src/lib/db.ts) identified **37 distinct locations** where PostgREST error messages are wrapped with internal diagnostics:

```ts
// Examples from src/lib/db.ts:
446: if (error) throw new Error(`Supabase query error (users.list): ${error.message}`);
551: if (error) throw new Error(`Supabase query error (users.getById): ${error.message}`);
681: if (error) throw new Error(`Supabase query error (users.getByEmail): ${error.message}`);
1819: if (error) throw new Error(`Supabase error (employees.list): ${error.message}`);
2088: if (coreErr) throw new Error(`Supabase error (employees.create): ${coreErr.message}`);
2799: if (error) throw new Error(`Supabase error (salary.getByEmployeeId): ${error.message}`);
2894: if (coreErr) throw new Error(`Supabase error (salary.upsert): ${coreErr.message}`);
3186: throw new Error(`Supabase error (documents.create): ${error.message}`);
```

### Information Disclosed to API Callers:
1. **Internal Function Names:** `(salary.upsert)`, `(documents.create)`, `(users.getByEmail)`.
2. **PostgreSQL Table Names:** `employee_salary`, `documents`, `users`, `departments`, `employees`.
3. **Database Constraints & Schema Details:** `violates unique constraint "employees_email_key"`, `column "xyz" does not exist`.
4. **Target Audience:** Any authenticated user; and on public routes (`/api/verify/[verificationId]`, `/api/auth/login`), unauthenticated public internet callers.

---

## 5. Authentication Error Disclosure

### Analysis of `/api/auth/login`:
1. **Generic Credential Failure (SECURE):**
   - User Not Found: returns `{ error: 'Invalid credentials or inactive account.' }` (HTTP 401).
   - Inactive Account: returns `{ error: 'Invalid credentials or inactive account.' }` (HTTP 401).
   - Incorrect Password: returns `{ error: 'Invalid credentials or inactive account.' }` (HTTP 401).
   - Missing Credentials in DB: returns `{ error: 'Invalid credentials or inactive account.' }` (HTTP 401).
   *All standard authentication failures use the identical generic message.*

2. **Account Lockout Discrepancy (Finding 3 - Low):**
   - In [src/app/api/auth/login/route.ts:138-144](file:///D:/19.Website/HR_Portal/src/app/api/auth/login/route.ts#L138-L144), locked accounts return:
     `HTTP 423: "Too many failed login attempts. Account locked. Please try again in X seconds."`
   - A non-existent email returns HTTP 401. This allows an attacker to distinguish valid locked corporate accounts from non-existent accounts.

3. **Temporary Password Expiration Discrepancy (Finding 3 - Low):**
   - In [src/app/api/auth/login/route.ts:151-168](file:///D:/19.Website/HR_Portal/src/app/api/auth/login/route.ts#L151-L168), the check for expired temporary passwords occurs **before** password verification:
     `if (cred.must_change_password && cred.temp_password_expires_at && Date.now() > expiresAtMs)`
   - Submitting *any* password for an account with an expired temporary password returns:
     `"Temporary password has expired. Please contact an administrator for a password reset."`
   - This confirms the account exists without requiring a valid password.

---

## 6. Authorization Error Disclosure (IDOR / BOLA Oracle)

### Analysis of `GET /api/documents/[id]` ([src/app/api/documents/[id]/route.ts:18-38](file:///D:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/route.ts#L18-L38)):
```ts
const doc = await db.documents.getById(id);
if (!doc) {
  return NextResponse.json({ error: 'Document not found' }, { status: 404 });
}

// Permission check evaluated afterward:
if (doc.document_type === 'SALARY_SLIP') {
  const canView = hasPermission(user, 'salary.view') || hasPermission(user, 'document.salary.view');
  if (!canView) {
    return NextResponse.json(
      { error: 'Forbidden. Missing required permission: salary.view' },
      { status: 403 }
    );
  }
}
```

### Flaw Mechanism:
1. If an unprivileged user tests a non-existent document ID `doc-999` -> receives **HTTP 404** (`Document not found`).
2. If the user tests an existing confidential salary slip `doc-001` -> receives **HTTP 403** (`Forbidden. Missing required permission: salary.view`).
3. **Leakage:** The caller discovers that `doc-001` exists and is a `SALARY_SLIP`.

### Comparison with `GET /api/salary/[employeeId]` (Proper Implementation):
In [src/app/api/salary/[employeeId]/route.ts:15-23](file:///D:/19.Website/HR_Portal/src/app/api/salary/%5BemployeeId%5D/route.ts#L15-L23), permission is checked **before** querying the employee:
```ts
if (!canAccessSalary(user)) {
  return NextResponse.json({ error: 'Forbidden: You do not possess clearance...' }, { status: 403 });
}
```
Here, unauthorized callers always receive HTTP 403, preventing existence enumeration.

---

## 7. File & Storage Errors

1. **Storage Bucket Name Leakage:**
   In [src/lib/storage.ts:61](file:///D:/19.Website/HR_Portal/src/lib/storage.ts#L61):
   `throw new Error(\`Failed to upload document to private Supabase bucket (\${SUPABASE_DOCUMENTS_BUCKET}): \${error.message}\`);`
   If an upload fails, the bucket name `hr-documents` is exposed in the exception.
2. **Local Storage Mode Disclosure:**
   In [src/app/api/settings/branding/asset/route.ts:54](file:///D:/19.Website/HR_Portal/src/app/api/settings/branding/asset/route.ts#L54):
   `return new NextResponse('Asset not found on disk.', { status: 404 });`
   Reveals that the server is serving assets from local disk storage rather than cloud storage.

---

## 8. Document & PDF Generation Errors

- In [src/app/api/documents/[id]/download/route.ts](file:///D:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/download/route.ts), signed URL generation and document fetching catch errors and return `{ error: error.message }` with HTTP 500.
- While PDF generation errors do not expose employee salary figures or PAN numbers, caught exceptions could expose internal document sequence formats or database column mappings.

---

## 9. Logging Security

An audit of [src/lib/audit.ts](file:///D:/19.Website/HR_Portal/src/lib/audit.ts) confirmed robust data hygiene:
1. **Explicit Key Deletion:** Before storing audit or security log records, metadata objects are scrubbed of:
   `password`, `token`, `secret`, `apiKey`, `serviceRoleKey`, `totpSecret`, `mfaSecret`, `manualKey`, `secret_encrypted`, `otp`, `code`, `recoveryCode`, `recoveryCodes`.
2. **PII Masking:**
   - PAN numbers are masked: `••••••${pan.slice(-4)}`
   - Bank account numbers are masked: `••••••••${account.slice(-4)}`
3. **Console Logging:** `console.error` calls log error messages for operational telemetry, but do not dump raw HTTP request bodies or Authorization headers.

---

## 10. Production Debug Configuration

1. **`next.config.ts`:**
   - `poweredByHeader: false` disables the `X-Powered-By: Next.js` header.
   - `productionBrowserSourceMaps` is not enabled (default false). Source code is not exposed in production browser DevTools.
2. **`NODE_ENV`:** Next.js automatically suppresses React development error overlays and internal server component stack traces when built in production mode (`next build`).

---

## 11. HTTP Status Codes

| Situation | Status Code Used | Architectural Alignment | Assessment |
| :--- | :---: | :---: | :---: |
| Missing / Malformed Payload | 400 Bad Request | Aligned | **PASS** |
| Unauthenticated Session | 401 Unauthorized | Aligned | **PASS** |
| Missing RBAC Permission | 403 Forbidden | Aligned | **PASS** |
| Resource Not Found | 404 Not Found | Aligned | **PASS** |
| Account Lockout | 423 Locked | Informative but leaks state | **Finding 3** |
| Rate Limit Exhaustion | 429 Too Many Requests | Aligned with `Retry-After` header | **PASS** |
| Verification Error Catch | 500 with `status: 'NOT_FOUND'` | Discrepant status pairing | **Finding 5** |

---

## 12. Error Boundaries

### Status: Missing Custom Boundaries (Finding 4 - Low)
- `src/app/error.tsx`: **Not Present**
- `src/app/global-error.tsx`: **Not Present**
- `src/app/not-found.tsx`: **Not Present**

In Next.js App Router, if an unhandled rendering error occurs without custom error boundaries, Next.js renders framework default pages. While safe in production, implementing custom error boundaries ensures brand consistency and guarantees that no component rendering diagnostics ever leak to clients.

---

## 13. Cache & Error Response Leakage

- `next.config.ts` configures `Cache-Control: no-store, max-age=0, must-revalidate` for portal routes (`/(dashboard|employees|documents|salary|...)/:path*`).
- Sensitive successful API responses (e.g. `/api/documents`, `/api/users`) explicitly declare `no-store` headers.
- **Gap:** When API route handlers catch exceptions, `NextResponse.json({ error: error.message }, { status: 500 })` is returned without an explicit `Cache-Control: no-store` header. If an aggressive caching reverse proxy (e.g. Cloudflare / Nginx) caches 5xx or 4xx responses, errors could theoretically be cached.

---

## 14. Confirmed Findings

### Finding 1: Raw Database/Supabase Error Disclosure
- **Severity:** **MEDIUM**
- **Endpoint/File:** Multiple API Routes & [src/lib/db.ts:446-3965](file:///D:/19.Website/HR_Portal/src/lib/db.ts#L446) (37 locations)
- **Exact Code Evidence:**
  ```ts
  // src/lib/db.ts:2799
  if (error) throw new Error(`Supabase error (salary.getByEmployeeId): ${error.message}`);

  // src/app/api/salary/[employeeId]/route.ts:106
  catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.status || 400 });
  }
  ```
- **Information Leaked:** PostgreSQL table names, column names, constraint names (`employees_email_key`), and internal function names.
- **Audience:** Authenticated API callers, and on public routes (`/api/verify/[id]`), unauthenticated callers.
- **Security Impact:** Facilitates backend reconnaissance and targeted database exploitation.
- **Minimal Remediation:** Log raw details on server (`console.error`) and return a generic error: `{ error: 'An internal error occurred. Please try again later.' }` with status 500.

---

### Finding 2: Resource Existence Disclosure via Status Code Discrepancy (IDOR Oracle)
- **Severity:** **MEDIUM**
- **Endpoint/File:** [src/app/api/documents/[id]/route.ts:18-38](file:///D:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/route.ts#L18-L38) & [src/app/api/tasks/[id]/route.ts:16-27](file:///D:/19.Website/HR_Portal/src/app/api/tasks/%5Bid%5D/route.ts#L16-L27)
- **Exact Code Evidence:**
  ```ts
  const doc = await db.documents.getById(id);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  if (doc.document_type === 'SALARY_SLIP' && !canViewSalary) {
    return NextResponse.json({ error: 'Forbidden. Missing required permission: salary.view' }, { status: 403 });
  }
  ```
- **Information Leaked:** Whether a protected document or task ID exists in the system and its specific category.
- **Audience:** Authenticated users probing IDs outside their authorization boundary.
- **Security Impact:** Allows unauthorized resource enumeration across tenants/employees.
- **Minimal Remediation:** Invert authorization or return uniform HTTP 404 for unauthorized items.

---

### Finding 3: Account Existence & State Enumeration in Login Endpoint
- **Severity:** **LOW**
- **Endpoint/File:** [src/app/api/auth/login/route.ts:138-167](file:///D:/19.Website/HR_Portal/src/app/api/auth/login/route.ts#L138-L167)
- **Exact Code Evidence:**
  `cred.locked_until` returns HTTP 423 ("Account locked"), and expired temp passwords return a unique message prior to password verification.
- **Information Leaked:** Distinguishes valid locked or temporary-password accounts from non-existent accounts.
- **Audience:** Unauthenticated public callers.
- **Security Impact:** Enables targeted employee email harvesting.
- **Minimal Remediation:** Verify password before checking temporary password expiration. Return generic authentication error on failed attempts while enforcing server-side lockouts.

---

### Finding 4: Missing App Router Custom Error Boundaries
- **Severity:** **LOW**
- **Endpoint/File:** `src/app/error.tsx`, `src/app/global-error.tsx` (Missing)
- **Information Leaked:** Relies on framework default error handling during rendering crashes.
- **Audience:** Browser clients encountering Server Component exceptions.
- **Security Impact:** Sub-optimal error handling; potential framework-level diagnostic leakage in non-production environments.
- **Minimal Remediation:** Add standard sanitized `error.tsx` and `global-error.tsx`.

---

### Finding 5: Inconsistent Verification Error Status Mapping
- **Severity:** **INFORMATIONAL**
- **Endpoint/File:** [src/app/api/verify/[verificationId]/route.ts:39](file:///D:/19.Website/HR_Portal/src/app/api/verify/%5BverificationId%5D/route.ts#L39)
- **Exact Code Evidence:**
  `return NextResponse.json({ status: 'NOT_FOUND', error: error.message }, { status: 500 });`
- **Information Leaked:** Pairs `NOT_FOUND` payload with HTTP 500 status and raw `error.message`.
- **Audience:** Public verification consumers.
- **Security Impact:** Misleading API status code and internal error exposure.
- **Minimal Remediation:** Map genuine misses to HTTP 404 and caught exceptions to HTTP 500 with generic text.

---

### Finding 6: Local Disk Mode Disclosure in Asset Route
- **Severity:** **INFORMATIONAL**
- **Endpoint/File:** [src/app/api/settings/branding/asset/route.ts:54](file:///D:/19.Website/HR_Portal/src/app/api/settings/branding/asset/route.ts#L54)
- **Exact Code Evidence:**
  `return new NextResponse('Asset not found on disk.', { status: 404 });`
- **Information Leaked:** Discloses local filesystem storage mode.
- **Audience:** Authenticated asset callers.
- **Security Impact:** Architecture reconnaissance.
- **Minimal Remediation:** Standardize to `'Asset not found.'`.

---

## 15. Recommended Minimal Fixes

```diff
// 1. Generic Error Sanitization on Catch Blocks (API Routes)
  } catch (error: any) {
+   console.error('[API_ERROR]', error);
+   const isDev = process.env.NODE_ENV === 'development';
-   return NextResponse.json({ error: error.message }, { status: error.status || 500 });
+   return NextResponse.json(
+     { error: isDev ? error.message : 'An internal error occurred. Please try again later.' },
+     { status: error.status || 500 }
+   );
  }

// 2. Uniform 404 on Unauthorized Document Access (src/app/api/documents/[id]/route.ts)
  if (user.role !== 'SUPER_ADMIN') {
    if (doc.document_type === 'SALARY_SLIP' && !canViewSalary) {
-     return NextResponse.json({ error: 'Forbidden. Missing required permission: salary.view' }, { status: 403 });
+     return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
  }

// 3. Verify Password Before Checking Temp Password Expiry (src/app/api/auth/login/route.ts)
- if (cred.must_change_password && cred.temp_password_expires_at) { ... }
+ const isPasswordValid = await verifyPassword(rawPassword, cred.password_hash);
+ if (!isPasswordValid) return NextResponse.json({ error: GENERIC_AUTH_ERROR }, { status: 401 });
+ if (cred.must_change_password && cred.temp_password_expires_at && Date.now() > expiresAtMs) { ... }
```

---

## 16. Suggested Security Tests

| Test Case | Target Endpoint | Payload / Condition | Expected Secure Result |
| :--- | :--- | :--- | :--- |
| **Database Failure Response** | `GET /api/documents` | Simulate database timeout or connection error | HTTP 500 (`An internal error occurred`), NO table or SQL names |
| **IDOR Document Existence** | `GET /api/documents/:salarySlipId` | Call with user lacking `salary.view` | HTTP 404 (Indistinguishable from non-existent ID) |
| **IDOR Task Existence** | `GET /api/tasks/:unrelatedTaskId` | Call with user not assigned or creator | HTTP 404 (Indistinguishable from non-existent ID) |
| **Account Lockout Timing** | `POST /api/auth/login` | Email for locked account vs non-existent | Same HTTP status / generic response |
| **Public Verification Error** | `GET /api/verify/invalid-id` | Database connection interrupted | HTTP 500 generic message, NO PostgREST error details |
| **Asset Mode Information** | `GET /api/settings/branding/asset` | Request non-existent asset | HTTP 404 (`Asset not found`), NO `'on disk'` mention |

---

## 17. Final Verdict

| Metric | Result |
| :--- | :--- |
| **Stack Trace Disclosures** | **PASS (0)** |
| **Logging Data Hygiene & Sanitization** | **PASS (Clean)** |
| **Production Debug Configuration** | **PASS (Secure)** |
| **Identified Error Handling & Leakage Findings** | **6 (0 Critical, 0 High, 2 Medium, 2 Low, 2 Informational)** |
| **Isolated Target (`D:\19.Website\Varsaka`)** | **UNTOUCHED (Clean)** |

### Final Audit Status:
**Error Handling & Information Leakage Audit: FINDINGS**

*(No critical credentials or raw stack traces are exposed. All findings represent opportunities to harden database exception formatting, normalize authorization error codes, and prevent account existence enumeration.)*
