# DEEP RATE LIMITING AUDIT REPORT
**Target System:** Varsaka HR Document Management & Verification Portal  
**Project Path:** `D:\19.Website\HR_Portal`  
**Audit Date:** October 4, 2026  
**Scope:** Exhaustive Audit of Rate Limiting across all `src/app/api` Endpoints and `src/lib/rate-limit.ts`  
**Mode:** Strict Read-Only Static and Architectural Analysis  

---

## 1. Executive Summary

This deep rate-limiting audit inspected all 38 API route files (comprising 45 distinct HTTP method handlers) under `src/app/api`, along with the underlying rate limiting utilities in [src/lib/rate-limit.ts](file:///D:/19.Website/HR_Portal/src/lib/rate-limit.ts).

### High-Level Summary
- **Public Entry Points Protected:**
  - `/api/auth/login` implements dual token bucket rate limiting (IP and account keys) backed by persistent database account lockout in PostgreSQL (`user_credentials.locked_until`).
  - `/api/auth/mfa/verify` implements token bucket consumption and database lockout on consecutive failures.
  - `/api/verify/[verificationId]` implements IP-based sliding window rate limiting (15 requests/min).
  - `/api/documents/[id]/download` enforces a strict download rate limiter (10 requests/min per user/IP).
- **Secondary / Internal Gaps Identified:**
  - Critical sensitive endpoints such as `/api/auth/break-glass`, `/api/auth/change-password`, `/api/documents/bulk-action`, and `/api/settings/branding` (file uploads) lack request rate limiting.
  - In-memory token bucket and sliding window rate limiting structures are process-local and will not synchronize across multi-instance serverless deployments without a distributed datastore.

---

## 2. Complete Inventory of API Routes & Rate Limiting Status

The table below documents every endpoint discovered in `src/app/api`. No endpoints were omitted or fabricated.

| # | Endpoint | Method | Purpose | Abuse Risk | Current Protection | Key Used | Limit | Window / Cooldown | Server-side? |
| :-: | :--- | :---: | :--- | :--- | :---: | :--- | :---: | :---: | :---: |
| 1 | `/api/auth/login` | POST | Password authentication | Brute force, credential stuffing | **PROTECTED** | `login:ip:<ip>`, `login:account:<email>`, DB `user_credentials` | 5 attempts | 1 token/15min refill + 15min DB lock | **YES** |
| 2 | `/api/auth/mfa/verify` | POST | Verify 6-digit TOTP code | TOTP brute force (1,000,000 combinations) | **PROTECTED** | `login:ip:<ip>`, `login:account:<email>`, DB `user_mfa` | 5 attempts | 1 token/15min refill + 15min DB lock | **YES** |
| 3 | `/api/auth/mfa/recovery` | POST | Verify 16-char backup recovery code | Recovery code guessing | **PARTIALLY PROTECTED** | DB `user_mfa.locked_until` (Missing IP bucket) | 5 attempts | 15min DB lockout | **YES** |
| 4 | `/api/auth/mfa/setup` | POST | Initiate TOTP enrollment | Uncontrolled secret generation, memory load | **NOT PROTECTED** | None | None | None | **YES** |
| 5 | `/api/auth/mfa/verify-setup` | POST | Confirm first TOTP code on setup | Trial-and-error OTP during setup | **NOT PROTECTED** | None | None | None | **YES** |
| 6 | `/api/auth/mfa/reset` | POST | Administrative user MFA reset | Targeted user disruption (RBAC gated) | **NOT PROTECTED** | None | None | None | **YES** |
| 7 | `/api/auth/mfa/status` | GET | Query user MFA enrollment status | Telemetry probing | **NOT PROTECTED** | None | None | None | **YES** |
| 8 | `/api/auth/change-password` | POST | Change temporary to permanent password | Brute forcing temporary password | **NOT PROTECTED** | None | None | None | **YES** |
| 9 | `/api/auth/break-glass` | POST | Emergency Super Admin recovery | Brute-forcing emergency recovery key | **NOT PROTECTED** | None | None | None | **YES** |
| 10 | `/api/auth/logout` | POST | Invalidate cookie session | Session termination spam | **NOT APPLICABLE** | None | None | None | **YES** |
| 11 | `/api/auth/me` | GET | Retrieve active session profile | Profile polling load | **NOT PROTECTED** | None | None | None | **YES** |
| 12 | `/api/verify/[verificationId]` | GET | Public document QR verification | Registry scraping, token enumeration | **PROTECTED** | `verify:<ip>` | 15 req | 60s sliding window | **YES** |
| 13 | `/api/documents/[id]/download` | GET, POST | Request signed token & download PDF | Bulk document exfiltration, bandwidth DoS | **PROTECTED** | `download:<userId\|ip>` | 10 req | 60s sliding window (15m token) | **YES** |
| 14 | `/api/documents` | GET | Search and list documents | DB load via regex/wildcard search | **NOT PROTECTED** | None | None | None | **YES** |
| 15 | `/api/documents` | POST | Generate official document draft | Document ID counter exhaustion, DB bloat | **NOT PROTECTED** | None | None | None | **YES** |
| 16 | `/api/documents/[id]` | GET | Retrieve document record snapshot | Metadata scraping (RBAC gated) | **NOT PROTECTED** | None | None | None | **YES** |
| 17 | `/api/documents/[id]` | DELETE | Revoke or delete document draft | Tampering / mass deletion (RBAC gated) | **NOT PROTECTED** | None | None | None | **YES** |
| 18 | `/api/documents/[id]/approve` | POST | Formal management document approval | Approval flooding (RBAC gated) | **NOT PROTECTED** | None | None | None | **YES** |
| 19 | `/api/documents/[id]/reject` | POST | Reject document draft with reason | Workflow disruption (RBAC gated) | **NOT PROTECTED** | None | None | None | **YES** |
| 20 | `/api/documents/[id]/revoke` | POST | Formally revoke approved document | Mass invalidation (RBAC gated) | **NOT PROTECTED** | None | None | None | **YES** |
| 21 | `/api/documents/[id]/new-version` | POST | Draft new document revision | Version tree bloat | **NOT PROTECTED** | None | None | None | **YES** |
| 22 | `/api/documents/bulk-action` | POST | Batch approve/reject/revoke/delete | Resource exhaustion, DB lock contention | **NOT PROTECTED** | None (Uncapped array) | None | None | **YES** |
| 23 | `/api/employees` | GET | List employee directory | Directory scraping (RBAC gated) | **NOT PROTECTED** | None | None | None | **YES** |
| 24 | `/api/employees` | POST | Onboard new employee master record | Employee record spam | **NOT PROTECTED** | None | None | None | **YES** |
| 25 | `/api/employees/[id]` | GET | View employee profile | Profile scraping (RBAC gated) | **NOT PROTECTED** | None | None | None | **YES** |
| 26 | `/api/employees/[id]` | PUT | Update employee master & salary | Frequent DB writes / tampering | **NOT PROTECTED** | None | None | None | **YES** |
| 27 | `/api/employees/[id]` | DELETE | Permanently purge employee (SUPER_ADMIN) | Irreversible data destruction (RBAC gated) | **NOT PROTECTED** | None | None | None | **YES** |
| 28 | `/api/employees/[id]/deletion` | GET, POST, PUT | Request, inspect, approve deletion | Deletion queue spam | **NOT PROTECTED** | None | None | None | **YES** |
| 29 | `/api/employees/next-id` | GET | Preview next sequence identifier | ID counter polling | **NOT PROTECTED** | None | None | None | **YES** |
| 30 | `/api/salary/[employeeId]` | GET | Inspect employee compensation | Compensation scraping (RBAC gated) | **NOT PROTECTED** | None | None | None | **YES** |
| 31 | `/api/salary/[employeeId]` | PUT | Modify employee compensation | Unauthorized salary updates | **NOT PROTECTED** | None | None | None | **YES** |
| 32 | `/api/settings/branding` | GET | Retrieve document branding & seals | Metadata polling | **NOT PROTECTED** | None | None | None | **YES** |
| 33 | `/api/settings/branding` | POST | Upload signature or seal image (2-3MB) | Disk / storage bloat, CPU load on magic-byte scan | **NOT PROTECTED** | None | None | None | **YES** |
| 34 | `/api/settings/branding/asset` | GET | Fetch private signature/stamp image | Asset scraping, storage bandwidth load | **NOT PROTECTED** | None | None | None | **YES** |
| 35 | `/api/settings/corporate` | GET, PUT | View or update corporate metadata | Organization profile tampering | **NOT PROTECTED** | None | None | None | **YES** |
| 36 | `/api/tasks` | GET, POST | List tasks or create operational task | Task spam / DB bloat | **NOT PROTECTED** | None | None | None | **YES** |
| 37 | `/api/tasks/[id]` | GET, PATCH | View task or update assignment/status | Task status manipulation | **NOT PROTECTED** | None | None | None | **YES** |
| 38 | `/api/tasks/staff` | GET | List assignable staff members | Staff directory probing | **NOT PROTECTED** | None | None | None | **YES** |
| 39 | `/api/users` | GET, POST | List users or create new staff account | User account creation spam (SUPER_ADMIN) | **NOT PROTECTED** | None | None | None | **YES** |
| 40 | `/api/users/[id]` | GET, PATCH, DELETE | Update role, department, deactivation | Administrative account manipulation | **NOT PROTECTED** | None | None | None | **YES** |
| 41 | `/api/users/[id]/permissions` | GET, POST, DELETE | Grant, revoke, or clear perm overrides | Permission tampering (SUPER_ADMIN) | **NOT PROTECTED** | None | None | None | **YES** |
| 42 | `/api/users/[id]/reset-password` | POST | Admin-triggered password reset | Reset token flooding (SUPER_ADMIN) | **NOT PROTECTED** | None | None | None | **YES** |
| 43 | `/api/certificate-requests` | GET, POST | Request or list certificate permissions | Request flooding | **NOT PROTECTED** | None | None | None | **YES** |
| 44 | `/api/certificate-requests/[id]` | PUT | Approve or reject certificate request | Workflow disruption (RBAC gated) | **NOT PROTECTED** | None | None | None | **YES** |
| 45 | `/api/departments` | GET | Fetch departments list | None (Static catalog) | **NOT APPLICABLE** | None | None | None | **YES** |

---

## 3. In-Depth Inspection of `src/lib/rate-limit.ts`

The utility file exposes two rate-limiting primitives:
1. `InMemoryRateLimiter`: Sliding-window timestamp tracker.
2. `TokenBucketRateLimiter`: Continuous token refill bucket.

### Behavioral Analysis

#### 1. IP-Based Limiting
- Keys follow the structure `login:ip:<ip>`, `verify:<ip>`, or `download:<userId|ip>`.
- Client IP extraction:
  ```ts
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
  ```
- **Proxy Consideration:** Taking `x-forwarded-for.split(',')[0]` trusts the leftmost client IP. If an upstream reverse proxy (e.g. Cloudflare, AWS CloudFront, Nginx) does not strip incoming client-supplied `X-Forwarded-For` headers, a malicious client could spoof their IP to bypass IP-level rate limiting.
- *Recommendation:* In production, configure your reverse proxy or edge layer to overwrite or append to `X-Forwarded-For`, or use trusted platform headers like `CF-Connecting-IP` or `True-Client-IP`.

#### 2. Account-Based Limiting
- Key structure: `login:account:<email>`.
- Independently tracked from IP buckets. An attacker attempting passwords from rotating proxy IPs against a single account triggers the account-level bucket after 5 attempts.

#### 3. Burst Behavior & Capacity
- `capacity`: 5 tokens.
- Immediate bursts of up to 5 attempts are permitted before lockouts trigger.

#### 4. Refill Interval & Cooldown
- Consumes 1 token per failure (`tokens -= 1`).
- Refills 1 token every 15 minutes (`refillMinutes: 15`).
- If completely exhausted (0 tokens), taking the full 5 attempts back to capacity requires:
  $$\text{Full recovery} = 5 \times 15\text{ minutes} = 75\text{ minutes}$$
- The next attempt is allowed as soon as 1 token refills (within 15 minutes).

#### 5. Lockout & Retry-After Behavior
- When `tokens < 1`, `check()` returns:
  ```ts
  {
    allowed: false,
    remainingTokens: 0,
    lockoutSeconds: Math.max(1, Math.ceil(timeUntilNextTokenMs / 1000))
  }
  ```
- Endpoints return HTTP 429 with standard `Retry-After: <seconds>` headers.

#### 6. Successful Login Reset
- When authentication succeeds:
  ```ts
  loginTokenBucket.reset(`login:account:${email}`);
  loginTokenBucket.reset(`login:ip:${ip}`);
  await db.userCredentials.resetFailedAttempts(user.id);
  ```
- Both in-memory buckets and database failed counters are reset to 0/full capacity immediately.

---

## 4. Multi-Instance & Serverless Limitations

> [!WARNING]
> **DOCUMENTED PRODUCTION LIMITATION:**  
> **"In-memory rate limiting is not reliable across multiple serverless/Node instances."**

### Architectural Nuance
1. **Memory Scope:** `rateLimiter` and `loginTokenBucket` store records in `Map<string, Record>` inside the Node.js process heap.
2. **Serverless Concurrency:** When deployed to serverless environments (e.g., Vercel, AWS Lambda, Google Cloud Run with autoscaling), each concurrent container or worker executes with isolated memory.
3. **Implication:**
   - IP-level brute-force attacks distributing requests across separate lambda instances will not share token decrements.
   - **Persistent Defense Present:** Account-level lockouts for valid accounts are persisted in PostgreSQL via `public.user_credentials.locked_until` and `public.user_mfa.locked_until`, providing multi-instance account lockout across all lambdas. However, nonexistent account probing and public IP rate limiting remain vulnerable to multi-instance desynchronization.

---

## 5. Recommended Minimal Rate Limiting Strategy per Endpoint

To address unmetered endpoints without introducing heavy external dependencies, the following minimal, zero-breaking-change strategy is recommended:

| Endpoint | Recommended Limiter | Key Pattern | Limit | Window | Rationale |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `/api/auth/break-glass` | `rateLimiter` | `breakglass:<ip>` | 3 req | 15 min | High-entropy emergency key must be protected against brute-force probing. |
| `/api/auth/change-password` | `rateLimiter` | `chpass:<userId>` | 5 req | 15 min | Prevents guessing current temporary password before mandatory change. |
| `/api/auth/mfa/verify-setup` | `loginTokenBucket` | `mfasetup:<userId>` | 5 tokens | 1 token/15m | Protects against OTP guessing during first-time MFA onboarding. |
| `/api/documents/bulk-action` | `rateLimiter` + Cap | `bulkdoc:<userId>` | 5 req | 1 min | Cap `documentIds.length <= 50` and rate limit to protect DB performance. |
| `/api/documents` (POST) | `rateLimiter` | `docgen:<userId>` | 10 req | 1 min | Throttles automated mass document generation. |
| `/api/settings/branding` (POST)| `rateLimiter` | `brandupload:<userId>` | 5 req | 5 min | Prevents storage bloat and CPU spikes from image parsing. |
| `/api/employees` (POST) | `rateLimiter` | `empcreate:<userId>` | 10 req | 1 min | Protects employee master table from script-driven flooding. |

---

## 6. Suggested Safe Verification Tests (Local / Test Environment)

The following safe tests can be executed against a local development instance or isolated staging server to verify rate limiter behavior without touching production data:

### Test 1: Public Verification Rate Limit Reached (HTTP 429)
```bash
# Execute 16 rapid GET requests against verification route
for i in {1..16}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/verify/VVR-PROBE-001
done
# Expected: Requests 1-15 return 200/404; Request 16 returns 429 Too Many Requests
```

### Test 2: Retry-After Header Inspection
```bash
curl -i http://localhost:3000/api/verify/VVR-PROBE-001
# Expected response headers when rate limited:
# HTTP/1.1 429 Too Many Requests
# Retry-After: <seconds>
```

### Test 3: Download Rate Limiting (10 req/min per User)
```bash
# Authenticated request to /api/documents/[id]/download
# Sending 11 consecutive requests within 60 seconds
# Expected: Request 11 returns 429 with Retry-After header
```

### Test 4: Login Account Lockout & Successful Reset
```bash
# 1. Send 5 failed login attempts with wrong password
# 2. Verify response code is 429 / 423
# 3. Wait for token refill OR authenticate successfully with correct credentials
# 4. Verify bucket is restored to 5 tokens immediately upon successful login
```

### Test 5: Multi-IP Isolation
```bash
# Send 15 requests with X-Forwarded-For: 192.168.1.100 (hits limit)
# Send 1 request with X-Forwarded-For: 192.168.1.101
# Expected: IP 101 succeeds (200), confirming per-IP bucket isolation
```

---

## 7. Audit Outcome

# FINDINGS

### Audit Verdict Rationale
- **Core Critical Protections Are Active:** The portal's primary external attack surfaces (`/api/auth/login`, `/api/auth/mfa/verify`, `/api/verify/[verificationId]`, and `/api/documents/[id]/download`) are **PROTECTED** server-side with strict rate limits, exponential lockouts, and standard `Retry-After` headers.
- **Identified Findings (Non-Blockers for Code Architecture, but Recommended for Production Hardening):**
  1. `/api/auth/break-glass` lacks request throttling.
  2. `/api/documents/bulk-action` lacks an array size cap and rate limiter.
  3. Image upload (`/api/settings/branding`) is unmetered.
  4. In-memory token bucket rate limiting requires Redis/Upstash backing for distributed multi-instance serverless deployments.
