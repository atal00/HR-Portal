# DEEP FILE UPLOAD & STORAGE SECURITY AUDIT REPORT

**Project:** HR Portal (`D:\19.Website\HR_Portal`)  
**Audit Type:** Read-Only Source Code & Storage Architecture Security Audit  
**Date:** October 4, 2026  
**Auditor:** Antigravity IDE Security Agent  
**Audit Scope:** `src/app/api`, `src/lib`, `src/components`, storage adapters, bucket policies, and download routes  
**Status:** **FINDINGS IDENTIFIED (NON-BLOCKING)**  
**Varsaka Core Isolation:** **D:\19.Website\Varsaka = UNTOUCHED (100% ISOLATED)**

---

## 1. Executive Summary

A comprehensive, read-only security audit of all file upload, file storage, file retrieval, and file serving pathways within the HR Portal codebase was conducted. The application handles high-value corporate artifacts including corporate seals, authorized executive signatures, employee compensation records, and legal employment contracts (Offer Letters, Experience Letters, Relieving Orders, Salary Slips, and Certificates).

### Key Architectural Strengths:
1. **Zero Client Filename Trust:** Client-supplied filenames in multipart uploads are completely discarded. The server deterministically generates internal filenames based on asset types, monotonic version counters, and timestamps (`sig_v{n}_{timestamp}.{ext}`). This eliminates filename-based path traversal, null-byte injection, and arbitrary file overwrite vectors.
2. **Deep Magic-Byte & MIME Dual-Validation:** Uploaded binary buffers are inspected against hardcoded magic-byte signatures for PNG, JPEG, and WebP formats before saving to storage. Mismatched or spoofed MIME types are rejected immediately.
3. **Strict SVG Rejection:** Scalable Vector Graphics (`image/svg+xml`) are prohibited, mitigating SVG-borne Stored Cross-Site Scripting (XSS), XML External Entity (XXE) injection, and SSRF attacks.
4. **Private Storage Isolation:** Documents and branding assets reside exclusively in private storage buckets (`hr-documents`, `hr-assets`) or locked local filesystem directories (`storage/documents`, `storage/assets`). No confidential HR records are hosted in public storage.
5. **Cryptographically Signed Download Tokens:** Downloads are gated behind short-lived HMAC-SHA256 signed tokens (15-minute / 900-second expiration) and granular RBAC checks, preventing unauthenticated access and direct object enumeration.
6. **Public Verification Privacy:** The public verification pathway (`GET /api/verify/[verificationId]`) exposes only high-level status and verification metadata; it never exposes file paths, signed URLs, compensation numbers, or raw binary artifacts.

### Identified Gaps:
- **Missing Upload Rate Limiting:** `POST /api/settings/branding` lacks rate limiting, allowing an authenticated administrator to submit rapid successive uploads without cooldown (storage/resource exhaustion vector).
- **Missing Cache-Control Header on Document Snapshot JSON:** `GET /api/documents/[id]/download` does not explicitly set `Cache-Control: no-store` on sensitive document snapshots.
- **Unbounded Storage Growth / Lack of Application Quotas:** The portal does not enforce per-tenant or global storage quotas at the application layer, relying primarily on Supabase bucket limits.

---

## 2. Upload Endpoint Inventory

An exhaustive search across `src/app/api`, `src/lib`, `src/components`, and server actions was conducted. The codebase contains **one** binary file upload endpoint, one binary asset retrieval route, one document download token route, and one public verification lookup route. Employee KYC records (`kyc_documents`) store text/string document identifiers, not binary files.

| Endpoint / Function | File & Lines | Purpose | Auth Required | RBAC Permission | Storage Target | Max Size | Allowed Types | Validation Level |
|---|---|---|---|---|---|---|---|---|
| `POST /api/settings/branding` | [`src/app/api/settings/branding/route.ts:22-103`](file:///d:/19.Website/HR_Portal/src/app/api/settings/branding/route.ts#L22-L103) | Upload authorized executive signature or corporate seal image | Yes (`requireAuthUser()`) | `SUPER_ADMIN` or `system.settings` | Supabase `hr-assets` / Local `storage/assets/` | 2MB (Signature), 3MB (Stamp) | `image/png`, `image/jpeg`, `image/jpg`, `image/webp` | **Full**: Size, MIME whitelist, and magic-byte header inspection |
| `GET /api/settings/branding/asset` | [`src/app/api/settings/branding/asset/route.ts:8-67`](file:///d:/19.Website/HR_Portal/src/app/api/settings/branding/asset/route.ts#L8-L67) | Serve private branding images (signatures/stamps) to authenticated users | Yes (`requireAuthUser()`) | Any authenticated user session | Supabase `hr-assets` / Local `storage/assets/` | N/A (Download) | PNG, JPEG, WebP | Path prefix restriction (`signatures/`, `stamps/`), traversal sanitization (`..`, `\`) |
| `POST /api/documents/[id]/download` | [`src/app/api/documents/[id]/download/route.ts:57-130`](file:///d:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/download/route.ts#L57-L130) | Generate 15-minute signed URL / HMAC token for document download | Yes (`getCurrentUser()`) | Granular per-document type (`salary.view`, `document.offer.download`, etc.) | Supabase `hr-documents` / Local `storage/documents/` | N/A (Token generation) | N/A | Rate limit (10/min), DB ID lookup, RBAC permission verification |
| `GET /api/documents/[id]/download` | [`src/app/api/documents/[id]/download/route.ts:133-230`](file:///d:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/download/route.ts#L133-L230) | Retrieve document data snapshot via HMAC token or request signed link | Token OR Session | Token validation (`verifySignedDownloadToken`) OR RBAC check | N/A | N/A (Snapshot payload) | JSON | HMAC-SHA256 signature verification, 900s expiration check, ID binding |
| `GET /api/verify/[verificationId]` | [`src/app/api/verify/[verificationId]/route.ts:5-41`](file:///d:/19.Website/HR_Portal/src/app/api/verify/%5BverificationId%5D/route.ts#L5-L41) | Public verification of document authenticity (QR code scan target) | No (Public) | None (Public read) | Telemetry in `verification_logs` | N/A (Read) | N/A | Rate limit (15/min/IP), strict metadata-only projection (no file URLs) |

*Note: No other multipart/form-data endpoints or binary upload routes exist in the HR Portal codebase.*

---

## 3. Authentication & Authorization

### Server-Side Authentication
- **Branding Uploads:** `POST /api/settings/branding` invokes `await requireAuthUser()` ([`route.ts:24`](file:///d:/19.Website/HR_Portal/src/app/api/settings/branding/route.ts#L24)) before parsing `req.formData()`. Unauthenticated requests receive HTTP 401 immediately.
- **Branding Asset Downloads:** `GET /api/settings/branding/asset` calls `await requireAuthUser()` ([`route.ts:11`](file:///d:/19.Website/HR_Portal/src/app/api/settings/branding/asset/route.ts#L11)) before reading any disk or bucket asset. Unauthenticated requests receive HTTP 401. Anonymous public users cannot view corporate signatures or stamps.
- **Document Downloads:** `POST /api/documents/[id]/download` checks `await getCurrentUser()` ([`route.ts:66`](file:///d:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/download/route.ts#L66)). Unauthenticated requests receive HTTP 401.

### Role-Based Access Control (RBAC) & Principle of Least Privilege
- **Upload Protection:** Branding uploads are strictly restricted:
  ```typescript
  // src/app/api/settings/branding/route.ts:27-35
  if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'system.settings' as any)) {
    await logSecurityEvent({
      eventType: 'UNAUTHORIZED_ACCESS',
      severity: 'HIGH',
      description: `User ${user.email} attempted to update branding settings without authority.`,
      userId: user.id,
    });
    return NextResponse.json({ error: 'Forbidden: Insufficient privileges to update document branding.' }, { status: 403 });
  }
  ```
  Users with roles `VIEWER`, `OFFICER`, `MANAGER`, or standard `ADMIN` without `system.settings` cannot upload signatures or corporate stamps.
- **Document Download RBAC:** Gated by document type in `checkDocumentDownloadPermission`:
  - `SALARY_SLIP`: Requires `salary.view` or `document.salary.download`.
  - `OFFER_LETTER`: Requires `document.offer.download`.
  - `EXPERIENCE_LETTER`: Requires `document.experience.download`.
  - `RELIEVING_LETTER`: Requires `document.relieving.download`.
  - `CERTIFICATE`: Requires `document.certificate.download`.
  - Violations trigger an audit log and an HTTP 403 response.

### IDOR / BOLA Analysis
- **Branding Uploads:** Target assets are global corporate settings (`signature` or `stamp`). There is no user-controlled employee/tenant folder path passed by the client.
- **Document Downloads:** The download route accepts `id` in the URL. Before issuing a signed URL or token, it loads the document from the database ([`route.ts:88`](file:///d:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/download/route.ts#L88)), validates that the record exists, and enforces RBAC based on the document's type. HMAC tokens embed the specific `documentId`, and `GET /api/documents/[id]/download` verifies that `verification.documentId === id` ([`route.ts:146`](file:///d:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/download/route.ts#L146)). Swapping IDs produces an immediate signature mismatch or ID binding failure.

---

## 4. File Size Limits

File size limits are strictly validated on the server side:

1. **Individual Upload Limits ([`src/app/api/settings/branding/route.ts:51-56`](file:///d:/19.Website/HR_Portal/src/app/api/settings/branding/route.ts#L51-L56)):**
   - **Signature Upload:** Max **2 MB** (`2 * 1024 * 1024 = 2,097,152 bytes`).
   - **Stamp Upload:** Max **3 MB** (`3 * 1024 * 1024 = 3,145,728 bytes`).
   - Checked against `file.size` before reading full buffer.
   - Buffer length is additionally verified in `validateImageBuffer(buffer)` ([`src/lib/branding.ts:140`](file:///d:/19.Website/HR_Portal/src/lib/branding.ts#L140)).
2. **Storage Bucket Constraints ([`src/lib/branding.ts:197`](file:///d:/19.Website/HR_Portal/src/lib/branding.ts#L197)):**
   - `hr-assets` bucket has a Supabase server-side limit of **5 MB** (`5242880` bytes).
   - `hr-documents` bucket has a Supabase server-side limit of **10 MB** (`10485760` bytes).
3. **Bypass Resistance:**
   - Manipulating `Content-Length` header does not bypass checks: Next.js streams the multipart body into memory/temp structures, and `file.size` represents the actual received byte count. Additionally, `Buffer.from(bytes).length` is validated in memory before any disk/bucket write.

---

## 5. File Type Validation

File type validation implements a strict, multi-tiered whitelist:

1. **MIME Type Whitelist ([`src/lib/branding.ts:144-148`](file:///d:/19.Website/HR_Portal/src/lib/branding.ts#L144-L148)):**
   - Allowed MIME types: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`.
   - All other MIME types (including `image/svg+xml`, `text/html`, `application/javascript`, `application/pdf`, `application/x-sh`) are rejected with HTTP 400: `"Unsupported image format ({mimeType}). Supported: PNG, JPG, WEBP."`.
2. **SVG Prohibition:**
   - SVG is **explicitly excluded** from the whitelist. SVG files cannot be uploaded as signatures or stamps. This prevents stored SVG XSS attacks (e.g., embedded `<script>` or `<foreignObject>` tags).
3. **PDF Uploads vs. Generation:**
   - There is **no end-user PDF upload endpoint** in the portal. All PDFs are generated internally by the system or rendered via HTML/print templates.
   - Stored document records in `hr-documents` are strictly generated server-side artifacts with MIME type `application/pdf` ([`src/lib/storage.ts:56`](file:///d:/19.Website/HR_Portal/src/lib/storage.ts#L56)).

---

## 6. Magic-Byte Validation

The portal implements deep byte-level header inspection in `validateImageBuffer` ([`src/lib/branding.ts:139-172`](file:///d:/19.Website/HR_Portal/src/lib/branding.ts#L139-L172)):

### Verified Signatures in Code:
- **PNG:** Inspects first 4 bytes for standard PNG signature `89 50 4E 47` (`0x89, 0x50, 0x4E, 0x47`):
  ```typescript
  const isPng = buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  ```
- **JPEG:** Inspects first 3 bytes for standard JPEG SOI marker `FF D8 FF` (`0xFF, 0xD8, 0xFF`):
  ```typescript
  const isJpeg = buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  ```
- **WEBP:** Inspects container structure for RIFF/WEBP signature:
  ```typescript
  const isWebp = buffer.length > 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP';
  ```

### Cross-Validation Logic:
- If magic bytes do not match any known image signature:
  `{ valid: false, error: 'Corrupted image file: File header magic bytes do not match declared image type.' }`
- If client claims `image/png` but magic bytes are not PNG:
  `{ valid: false, error: 'File contents do not match PNG image format.' }`
- If client claims `image/jpeg` but magic bytes are not JPEG:
  `{ valid: false, error: 'File contents do not match JPEG image format.' }`
- If client claims `image/webp` but magic bytes are not WebP:
  `{ valid: false, error: 'File contents do not match WebP image format.' }`

*Verdict: Magic-byte validation is fully implemented and cannot be fooled by renaming an executable or HTML file to `.png` or `.jpg`.*

---

## 7. Filename Security

The portal demonstrates exemplary filename sanitization and isolation:

1. **Client Filename Discarded ([`src/lib/branding.ts:183-186`](file:///d:/19.Website/HR_Portal/src/lib/branding.ts#L183-L186)):**
   - The original filename submitted by the client (via `formData.get('file').name`) is **never used** in storage paths.
   - The server derives extension exclusively from the validated MIME type:
     ```typescript
     const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
     const timestamp = Date.now();
     const filename = `${type === 'signatures' ? 'sig' : 'stamp'}_v${version}_${timestamp}.${ext}`;
     const storagePath = `${type}/${filename}`;
     ```
2. **Document Filename Sanitization ([`src/lib/storage.ts:47`](file:///d:/19.Website/HR_Portal/src/lib/storage.ts#L47)):**
   - Generated document filenames are constructed from the internal document number:
     ```typescript
     const fileName = `${documentNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
     ```
   - All characters outside alphanumeric, hyphen, and underscore are replaced with `_`, preventing directory traversal characters (`../`, `..\`), null bytes (`%00`), and shell metacharacters.
3. **Collision Resistance:**
   - Timestamps and monotonic version numbers guarantee unique filenames, preventing concurrent upload collisions or accidental overwrites.

---

## 8. Storage Location & Bucket Privacy

### Storage Architecture
The portal supports two storage modes configured via `process.env.STORAGE_MODE`:
1. **Supabase Object Storage (`STORAGE_MODE=supabase`):**
   - Private bucket `hr-documents`: Stores finalized PDF artifacts. Configured with `public: false`, `allowedMimeTypes: ['application/pdf']`, max size 10MB.
   - Private bucket `hr-assets`: Stores official signatures and corporate seals. Configured with `public: false`, `allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']`, max size 5MB ([`src/lib/branding.ts:195-198`](file:///d:/19.Website/HR_Portal/src/lib/branding.ts#L195-L198)).
2. **Local Secure Filesystem Fallback (`STORAGE_MODE=local`):**
   - Documents: `process.cwd()/storage/documents/{offer|experience|relieving|salary|certificate}/`
   - Assets: `process.cwd()/storage/assets/{signatures|stamps}/`
   - Both directories are located outside `public/` and `.next/` web-root directories. Direct HTTP requests cannot access them.

### Credential & Bucket Security
- No service-role keys or storage admin credentials are leaked to the client bundle.
- Supabase storage operations are performed exclusively on the server via `getSupabaseAdminClient()`.
- Both storage buckets have `public: false`. Anonymous direct URL fetching (e.g., `https://<ref>.supabase.co/storage/v1/object/public/hr-documents/...`) returns HTTP 400/403 Forbidden.

---

## 9. Signed URL Security

Document downloads are mediated by time-limited signed tokens:

1. **HMAC-SHA256 Token Architecture ([`src/lib/storage.ts:104-136`](file:///d:/19.Website/HR_Portal/src/lib/storage.ts#L104-L136)):**
   - Signed download tokens are created using `crypto.createHmac('sha256', secret)`.
   - Expiration duration: **900 seconds (15 minutes)**.
   - Token payload: `{ documentId, expiresAt, signature }` encoded as `base64url`.
   - Payload verification:
     ```typescript
     if (Date.now() > expiresAt) {
       return { valid: false, error: 'Download link has expired. Please request a new signed link.' };
     }
     const expectedPayload = `${documentId}:${expiresAt}`;
     const expectedSig = crypto.createHmac('sha256', secret).update(expectedPayload).digest('hex');
     if (signature !== expectedSig) {
       return { valid: false, error: 'Invalid or forged download signature.' };
     }
     ```
2. **Supabase Signed URLs ([`src/lib/storage.ts:87-98`](file:///d:/19.Website/HR_Portal/src/lib/storage.ts#L87-L98)):**
   - Generated via `supabase.storage.from('hr-documents').createSignedUrl(filePath, 900)`.
   - Expiration duration: Exactly **900 seconds (15 minutes)**.
3. **Revoked Document Protection:**
   - If a document is revoked or rejected, the status in `db.documents.getById(id)` reflects `'REVOKED'`.
   - Public verification immediately reports status `'REVOKED'` and hides any document contents.

---

## 10. Download Headers

File-serving and download routes were inspected for security headers:

### `GET /api/settings/branding/asset` ([`asset/route.ts:43-48`](file:///d:/19.Website/HR_Portal/src/app/api/settings/branding/asset/route.ts#L43-L48)):
- `Content-Type`: Explicitly set based on extension (`image/png`, `image/webp`, `image/jpeg`).
- `Cache-Control`: Set to `private, max-age=3600`.
- **Finding:** Missing `X-Content-Type-Options: nosniff` header. Although the MIME type is strictly set, adding `X-Content-Type-Options: nosniff` ensures legacy browsers or proxies cannot perform MIME-sniffing.

### `GET /api/documents/[id]/download` ([`download/route.ts:166-173`](file:///d:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/download/route.ts#L166-L173)):
- Returns JSON document snapshot via Next.js `NextResponse.json(...)`.
- **Finding:** Lacks explicit `Cache-Control: no-store` header on the JSON response. Confidential salary or identity snapshots could potentially be stored in intermediate shared proxy caches if not marked private/no-store.

---

## 11. Path Traversal Audit

All filesystem operations in the codebase were inspected:

| Operation | File & Line | User Control? | Traversal Defense | Risk |
|---|---|---|---|---|
| `fs.writeFileSync(filePath, buffer)` | [`src/lib/branding.ts:223`](file:///d:/19.Website/HR_Portal/src/lib/branding.ts#L223) | None | Filename is generated internally (`sig_v{n}_{ts}.{ext}`) | **None** |
| `fs.writeFileSync(absolutePath, buffer)` | [`src/lib/storage.ts:75`](file:///d:/19.Website/HR_Portal/src/lib/storage.ts#L75) | Limited (`documentNumber`) | Sanitized with `.replace(/[^a-zA-Z0-9_-]/g, '_')` | **None** |
| `fs.readFileSync(localFilePath)` | [`src/app/api/settings/branding/asset/route.ts:57`](file:///d:/19.Website/HR_Portal/src/app/api/settings/branding/asset/route.ts#L57) | Query param `path` | Explicitly rejects `..` and `\`; requires `signatures/` or `stamps/` prefix | **None** |
| `fs.readFileSync(DATA_FILE)` | [`src/lib/storage/mock-db.ts:513`](file:///d:/19.Website/HR_Portal/src/lib/storage/mock-db.ts#L513) | None | Fixed path `.system_data/db_store.json` | **None** |
| `fs.unlink` / `fs.rm` / `fs.rename` | None across `src` | N/A | No filesystem deletions exist | **N/A** |

**Evidence of Traversal Defense in Asset Route:**
```typescript
// src/app/api/settings/branding/asset/route.ts:20-27
if (assetPath.includes('..') || assetPath.includes('\\')) {
  return new NextResponse('Invalid asset path.', { status: 400 });
}

if (!assetPath.startsWith('signatures/') && !assetPath.startsWith('stamps/')) {
  return new NextResponse('Forbidden asset folder.', { status: 403 });
}
```
Attempting `path=../../etc/passwd` or `path=signatures/../../etc/passwd` is rejected by the `..` check and prefix boundary validation.

---

## 12. File Content Processing & SSRF / Resource Exhaustion

1. **No External Image Parsing Engines:** The server does not invoke heavy image parsing libraries (like ImageMagick, Sharp, or GraphicsMagick) that historically suffer from memory corruption, buffer overflows, or ghostscript RCE.
2. **Buffer Validation Only:** Binary validation is limited to slicing byte headers (the first 4 to 12 bytes) in Node.js buffers.
3. **No Decompression Bombs:** Because images are not decompressed or rasterized server-side, decompression bombs (e.g., zip bombs or malicious nested PNG chunks) cannot trigger memory exhaustion during upload.
4. **No External URL Fetching:** Upload endpoints do not accept external URLs to download or fetch remote files, completely eliminating Server-Side Request Forgery (SSRF) vulnerabilities in the upload pipeline.

---

## 13. Branding Assets Audit

Branding assets represent sensitive corporate identity credentials (signatures of authorized executives and corporate seals):

1. **RBAC:** Upload requires `SUPER_ADMIN` or `system.settings` permission.
2. **Private Storage:** Stored in private bucket `hr-assets` or private directory `storage/assets/`.
3. **Versioning:** Every upload increments a monotonic version number (`signatory.version + 1`, `stamp.version + 1`).
4. **Audit Trail:** Updating branding settings logs an audit event (`SETTINGS_UPDATED`) recording user ID, email, timestamp, and version numbers ([`src/lib/branding.ts:115-128`](file:///d:/19.Website/HR_Portal/src/lib/branding.ts#L115-L128)).
5. **Asset History:** Old assets are archived in `history.signatures` and `history.stamps` arrays, preserving historical records for legal verification of previously issued documents.

---

## 14. Document Storage & Public Verification

Document categories audited:
- Offer Letter (`OFFER_LETTER`)
- Experience Letter (`EXPERIENCE_LETTER`)
- Relieving Letter (`RELIEVING_LETTER`)
- Salary Slip (`SALARY_SLIP`)
- Certificate / Completion Certificate (`CERTIFICATE`)

### Verification Security Checks:
1. **Public Verification Leakage Check ([`src/lib/db.ts:3662-3773`](file:///d:/19.Website/HR_Portal/src/lib/db.ts#L3662-L3773)):**
   - The public verification route (`GET /api/verify/[verificationId]`) projects ONLY the following properties:
     - `status`: `'VALID' | 'REVOKED' | 'REJECTED' | 'PENDING_APPROVAL' | 'NOT_FOUND'`
     - `verification_id`, `document_number`, `document_type`, `document_title`
     - `candidate_name`, `employee_id`, `issue_date`, `verified_at`
   - **Crucially Excluded:**
     - `file_path` is NEVER exposed.
     - Signed URLs are NEVER returned.
     - `data_snapshot` (salary components, CTC, bank accounts, PAN/Aadhaar) is NEVER returned.
     - Raw signatures/stamps are NEVER returned.
2. **Salary Slip Isolation:**
   - In `checkDocumentDownloadPermission` ([`src/app/api/documents/[id]/download/route.ts:21-25`](file:///d:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/download/route.ts#L21-L25)), `SALARY_SLIP` requires the dedicated permission `salary.view` or `document.salary.download`. A general document viewer cannot access salary slip downloads.

---

## 15. Rate Limiting Analysis

A cross-check with the previous Rate Limiting audit was performed:

| Endpoint | Method | Rate Limit Protection | Current Status | Risk Level |
|---|---|---|---|---|
| `POST /api/settings/branding` | POST | **None** | **VULNERABLE TO RAPID CALLS** | **LOW** |
| `POST /api/documents/[id]/download` | POST | 10 requests / min / user / IP | Protected (`rateLimiter.check`) | **PASS** |
| `GET /api/documents/[id]/download` | GET | 10 requests / min / user / IP | Protected (`rateLimiter.check`) | **PASS** |
| `GET /api/verify/[verificationId]` | GET | 15 lookups / min / IP | Protected (`rateLimiter.check`) | **PASS** |

### Finding Confirmation:
`POST /api/settings/branding` currently has no rate limiting. While an attacker must possess `SUPER_ADMIN` or `system.settings` credentials to reach this logic, an authenticated compromised account could submit hundreds of 3MB images in rapid succession, consuming object storage quota and disk capacity.

---

## 16. Storage Quotas & Resource Exhaustion

1. **Application-Level Quotas:**
   - The application does not track cumulative bytes stored per organization or per user.
   - Old branding files are retained indefinitely on disk/bucket in addition to the newly uploaded ones.
2. **Infrastructure-Level Limits:**
   - Supabase enforces bucket-level maximum file sizes (5MB for assets, 10MB for documents).
   - Supabase project tier enforces global project storage limits.
3. **Assessment:** Because uploads are strictly restricted to Super Admins and files are capped at 2-3MB each, resource exhaustion is a **LOW** practical risk, but should be bounded with a rate limit and asset retention policy.

---

## 17. Malware & Antivirus Scanning

1. **Current State:** The application does not integrate a dynamic antivirus scanner (such as ClamAV or an ICAP server) during upload.
2. **Architectural Risk Assessment:**
   - Uploads are restricted strictly to images (`image/png`, `image/jpeg`, `image/webp`).
   - SVG is forbidden, preventing script execution.
   - Files are validated via magic bytes, preventing arbitrary executables (`.exe`, `.sh`, `.bat`, `.dll`) or polyglot HTML files from masquerading as images.
   - Files are served with strictly defined `Content-Type: image/png|jpeg|webp` headers, preventing browser execution.
   - The upload surface is restricted to Super Admins (no end-user or candidate file uploads).
3. **Classification:** **INFORMATIONAL**. Absence of dynamic antivirus scanning is acceptable for the current architecture given the strict format whitelist, magic-byte enforcement, and admin-only upload scope.

---

## 18. Confirmed Findings

### Finding 1: Missing Rate Limiting on Branding Upload Endpoint
- **Severity:** **LOW**
- **Endpoint:** `POST /api/settings/branding`
- **File & Line:** [`src/app/api/settings/branding/route.ts:22-103`](file:///d:/19.Website/HR_Portal/src/app/api/settings/branding/route.ts#L22-L103)
- **Affected Type:** Multipart/form-data (Signatures & Stamps)
- **Evidence:** The route performs authentication and RBAC checks, but unlike `/api/documents/[id]/download` and `/api/verify/[verificationId]`, it does not invoke `rateLimiter.check(...)`.
- **Attack Scenario:** A compromised admin session or rogue admin script could rapidly upload multi-megabyte files repeatedly, filling the Supabase storage quota or local disk.
- **Security Impact:** Storage bloat, denial of service on storage capacity.
- **Remediation:** Add `rateLimiter.check('branding_upload:' + user.id, 5, 60 * 1000)` (max 5 uploads per minute).

### Finding 2: Missing Explicit Cache-Control on Document Snapshot Response
- **Severity:** **LOW**
- **Endpoint:** `GET /api/documents/[id]/download`
- **File & Line:** [`src/app/api/documents/[id]/download/route.ts:166-173`](file:///d:/19.Website/HR_Portal/src/app/api/documents/%5Bid%5D/download/route.ts#L166-L173)
- **Affected Type:** JSON document snapshot
- **Evidence:** `return NextResponse.json({ success: true, ... data_snapshot: doc.data_snapshot })` returns default caching headers without `Cache-Control: no-store`.
- **Attack Scenario:** A shared workstation or intermediate caching proxy could store sensitive employee document data (such as compensation numbers, addresses, or IDs).
- **Security Impact:** Potential disclosure of confidential HR compensation data from cache.
- **Remediation:** Add header `'Cache-Control': 'no-store, no-cache, must-revalidate, private'` to the JSON response.

### Finding 3: Missing `X-Content-Type-Options: nosniff` on Asset Serving Route
- **Severity:** **LOW**
- **Endpoint:** `GET /api/settings/branding/asset`
- **File & Line:** [`src/app/api/settings/branding/asset/route.ts:43-48`](file:///d:/19.Website/HR_Portal/src/app/api/settings/branding/asset/route.ts#L43-L48)
- **Affected Type:** Static image serving (`image/png`, `image/jpeg`, `image/webp`)
- **Evidence:** Headers returned are `Content-Type` and `Cache-Control: private, max-age=3600`.
- **Attack Scenario:** In older or non-standard browsers, ambiguous byte streams could trigger MIME-sniffing behavior.
- **Security Impact:** Low defense-in-depth risk.
- **Remediation:** Add `'X-Content-Type-Options': 'nosniff'` to response headers.

### Finding 4: Storage Architecture Information Disclosure in Error Message
- **Severity:** **INFORMATIONAL**
- **Endpoint:** `GET /api/settings/branding/asset`
- **File & Line:** [`src/app/api/settings/branding/asset/route.ts:54`](file:///d:/19.Website/HR_Portal/src/app/api/settings/branding/asset/route.ts#L54)
- **Evidence:** Route returns `new NextResponse('Asset not found on disk.', { status: 404 });`.
- **Attack Scenario:** An attacker observing the error message learns that the server is operating in local filesystem mode rather than cloud storage mode.
- **Security Impact:** Minor information disclosure.
- **Remediation:** Standardize error message to `'Asset not found.'`.

---

## 19. Recommended Minimal Fixes

### Fix 1: Add Rate Limiting to `POST /api/settings/branding`
```typescript
// In src/app/api/settings/branding/route.ts
import { rateLimiter } from '@/lib/rate-limit';

// Inside POST handler after user authentication:
const rateCheck = rateLimiter.check(`branding_upload:${user.id}`, 5, 60 * 1000);
if (!rateCheck.allowed) {
  return NextResponse.json(
    { error: `Upload rate limit exceeded. Please wait ${rateCheck.resetSeconds} seconds.` },
    { status: 429, headers: { 'Retry-After': String(rateCheck.resetSeconds) } }
  );
}
```

### Fix 2: Add `no-store` Cache Control to Document Snapshot Response
```typescript
// In src/app/api/documents/[id]/download/route.ts
return NextResponse.json(
  {
    success: true,
    document_number: doc.document_number,
    title: doc.title,
    status: doc.status,
    data_snapshot: doc.data_snapshot,
  },
  {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
    }
  }
);
```

### Fix 3: Add `X-Content-Type-Options: nosniff` to Asset Serving Route
```typescript
// In src/app/api/settings/branding/asset/route.ts
headers: {
  'Content-Type': contentType,
  'Cache-Control': 'private, max-age=3600',
  'X-Content-Type-Options': 'nosniff',
}
```

---

## 20. Suggested Security Tests (Controlled & Non-Destructive)

The following safe tests should be executed in a test/staging environment:

1. **Oversized File Test:**
   - Attempt to upload a 2.5MB PNG file as a signature (limit is 2MB).
   - Expected: HTTP 400 with `"File size exceeds maximum allowed (2MB)."`.
2. **Disallowed Extension / MIME Test:**
   - Attempt to upload an SVG file (`image/svg+xml`) as a stamp.
   - Expected: HTTP 400 with `"Unsupported image format (image/svg+xml). Supported: PNG, JPG, WEBP."`.
3. **Magic-Byte Mismatch Test:**
   - Rename a text file containing `Hello World` to `test.png` with `Content-Type: image/png` and upload.
   - Expected: HTTP 400 with `"Corrupted image file: File header magic bytes do not match declared image type."`.
4. **Path Traversal Test on Asset Retrieval:**
   - Request `GET /api/settings/branding/asset?path=signatures/../../package.json` while authenticated.
   - Expected: HTTP 400 with `"Invalid asset path."`.
5. **Unauthorized Download Attempt:**
   - Authenticate as a user with only `document.offer.download` and attempt to download a `SALARY_SLIP` document ID.
   - Expected: HTTP 403 Forbidden with security event logged in audit table.
6. **Expired Signed Token Test:**
   - Craft or wait 15 minutes for a signed download token to expire, then request `GET /api/documents/[id]/download?token=<expiredToken>`.
   - Expected: HTTP 401 with `"Download link has expired. Please request a new signed link."`.
7. **Document ID Substitution Test:**
   - Generate a valid signed token for Document A, then request `GET /api/documents/<Document_B_ID>/download?token=<Token_For_A>`.
   - Expected: HTTP 401 with `"Download blocked: Malformed signature token."` or document ID mismatch.
8. **Public Verification Exposure Test:**
   - Query `GET /api/verify/<verificationId>` for an approved document.
   - Confirm response JSON does not include `file_path`, `data_snapshot`, salary numbers, or signed download URLs.

---

## 21. Final Verdict

| Evaluation Category | Audit Status | Remarks |
|---|---|---|
| Upload Endpoint Discovery | **PASS** | Only 1 binary upload endpoint exists (`POST /api/settings/branding`). |
| Authentication & RBAC | **PASS** | All uploads require admin session with `system.settings` or `SUPER_ADMIN`. Downloads enforce granular RBAC. |
| File Size Enforcement | **PASS** | Strict limits enforced on both client metadata and actual received buffer byte size. |
| File Type Whitelisting | **PASS** | Whitelist limited to PNG, JPEG, WebP. SVG is strictly rejected. |
| Magic-Byte Inspection | **PASS** | Binary headers verified for PNG, JPEG, and WebP before saving. |
| Filename Security | **PASS** | Client filenames are discarded; server generates deterministic versioned names. |
| Storage Isolation | **PASS** | Storage buckets `hr-documents` and `hr-assets` are private (`public: false`). Local storage is outside web root. |
| Signed URL & Token Security | **PASS** | HMAC-SHA256 tokens and Supabase signed URLs expire in 15 minutes (900s). Bound to document ID. |
| Download Headers | **FINDING (LOW)** | Missing `no-store` on document snapshot JSON and `nosniff` on asset route. |
| Path Traversal Defenses | **PASS** | Strict character sanitization on document numbers, traversal rejection (`..`, `\`) on asset paths. |
| Rate Limiting on Uploads | **FINDING (LOW)** | `POST /api/settings/branding` lacks request throttling. |
| Storage Quotas / DoS | **FINDING (LOW)** | Unbounded cumulative uploads on application level (mitigated by admin-only RBAC). |
| Malware Scanning | **PASS (INFO)** | No AV engine, but fully mitigated by strict image-only whitelist, magic bytes, and admin RBAC. |

**OVERALL RATING:**
### **File Upload & Storage Security Audit: FINDINGS (NON-BLOCKING)**

---

## Confirmation of Isolation
- **D:\19.Website\Varsaka:** **UNTOUCHED (100% Isolated, 0 modifications)**
- **HR Portal Source Code:** **UNTOUCHED (Read-Only Mode strictly respected)**
