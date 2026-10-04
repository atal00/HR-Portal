# COMPANY EMAIL STANDARDIZATION AUDIT
## Discovery / Read-Only Phase

| | |
|---|---|
| **Date** | 2026-10-05 |
| **Prepared by** | Antigravity (read-only scan) |
| **Scope** | `D:\19.Website\HR_Portal` |
| **Excluded** | `D:\19.Website\Varsaka` (not touched) |
| **Search target** | `info@varsakalabs.com` (all case variants) |
| **Replacement target** | `info@varsaka.com` |
| **Phase** | READ-ONLY — no files modified, no DB writes |

---

## 1. Summary

| Metric | Count |
|--------|-------|
| Total occurrences found | **10** |
| Unique files affected | **7** |
| Source code files | 5 |
| Schema / seed SQL files | 2 |
| Markdown audit/docs (skip) | 1 |
| Live Supabase occurrences | See §4 |
| Test fixture occurrences | 0 |

---

## 2. Complete Occurrence Map

### FILE 1 — `supabase_schema.sql` (Schema + Seed SQL)
| # | Line | Content | Classification |
|---|------|---------|----------------|
| 1 | 623 | `"email": "info@varsakalabs.com",` | ✅ **Active configuration** — `system_settings` seed data (`company_info` JSON blob) |

**Context:**
```sql
-- Seed System Settings
INSERT INTO system_settings (key, value, description) VALUES
('company_info', '{
    "company_name": "Varsaka Labs",
    "legal_entity": "Varsaka Labs",
    "website": "https://varsaka.com",
    "email": "info@varsakalabs.com",   -- ← CHANGE THIS
    ...
}'::jsonb, 'Official Varsaka corporate metadata used in documents'),
```
**Recommended change:** `"info@varsakalabs.com"` → `"info@varsaka.com"`

---

### FILE 2 — `supabase_schema.production.sql` (Production Schema + Seed SQL)
| # | Line | Content | Classification |
|---|------|---------|----------------|
| 2 | 758 | `"email": "info@varsakalabs.com",` | ✅ **Active configuration** — Production `system_settings` seed data (`company_info` JSON blob) |

**Context:**
```sql
-- 12.6 Seed System Settings
INSERT INTO system_settings (key, value, description) VALUES
('company_info', '{
    "company_name": "Varsaka Labs",
    "legal_entity": "Varsaka Labs",
    "website": "https://varsaka.com",
    "email": "info@varsakalabs.com",   -- ← CHANGE THIS
    ...
}'::jsonb, 'Official Varsaka corporate metadata used in documents'),
```
**Recommended change:** `"info@varsakalabs.com"` → `"info@varsaka.com"`

---

### FILE 3 — `src/lib/db.ts` (Runtime fallback / branding constant)
| # | Line | Content | Classification |
|---|------|---------|----------------|
| 3 | 4347 | `corporate_email: 'info@varsakalabs.com',` | ✅ **Active configuration** — In-code `defaultMetadata` object (runtime fallback when DB setting is absent) |

**Context:**
```ts
const defaultMetadata: CorporateMetadata = {
  brand_name: 'Varsaka Labs',
  legal_entity: 'Varsaka Labs',
  corporate_website: 'https://varsaka.com',
  corporate_email: 'info@varsakalabs.com',   // ← CHANGE THIS
  registered_office_address: '...',
  cin: 'U72900TG2023PTC178920',
};
```
**Recommended change:** `'info@varsakalabs.com'` → `'info@varsaka.com'`

---

### FILE 4 — `src/app/(portal)/settings/page.tsx` (Settings UI — 2 occurrences)

#### Occurrence A (Line 56) — Initial form state default
| # | Line | Content | Classification |
|---|------|---------|----------------|
| 4 | 56 | `corporate_email: 'info@varsakalabs.com',` | ✅ **Active configuration** — `useState` initial value for the "Edit Corporate Metadata" form |

**Context:**
```tsx
const [metaForm, setMetaForm] = useState({
  brand_name: 'Varsaka Labs',
  legal_entity: 'Varsaka Labs',
  corporate_website: 'https://varsaka.com',
  corporate_email: 'info@varsakalabs.com',   // ← CHANGE THIS
  registered_office_address: '...',
  cin: 'U72900TG2023PTC178920',
});
```
**Recommended change:** `'info@varsakalabs.com'` → `'info@varsaka.com'`

#### Occurrence B (Line 563) — Display fallback value
| # | Line | Content | Classification |
|---|------|---------|----------------|
| 5 | 563 | `{corporateMetadata?.corporate_email \|\| 'info@varsakalabs.com'}` | ✅ **Active configuration** — JSX display fallback in the Settings page Corporate Communications panel |

**Context:**
```tsx
<span className="font-mono text-slate-700">
  {corporateMetadata?.corporate_email || 'info@varsakalabs.com'}
</span>
```
**Recommended change:** `'info@varsakalabs.com'` → `'info@varsaka.com'`

---

### FILE 5 — `src/components/documents/SalarySlipTemplate.tsx` (Document template)
| # | Line | Content | Classification |
|---|------|---------|----------------|
| 6 | 204 | `Varsaka Labs • Registered Office: Hyderabad, Telangana, India • info@varsakalabs.com` | ✅ **Active document template** — Footer bar on every Salary Slip PDF |

**Context:**
```tsx
<div>Varsaka Labs • Registered Office: Hyderabad, Telangana, India • info@varsakalabs.com</div>
```
**Recommended change:** `info@varsakalabs.com` → `info@varsaka.com`

---

### FILE 6 — `src/components/documents/RelievingLetterTemplate.tsx` (Document template)
| # | Line | Content | Classification |
|---|------|---------|----------------|
| 7 | 138 | `Email: info@varsakalabs.com • Web: https://varsaka.com/ • Verification: {verificationUrl}` | ✅ **Active document template** — Footer bar on every Relieving Letter PDF |

**Context:**
```tsx
Email: info@varsakalabs.com • Web: https://varsaka.com/ • Verification: {verificationUrl}
```
**Recommended change:** `info@varsakalabs.com` → `info@varsaka.com`

---

### FILE 7 — `src/components/documents/OfferLetterTemplate.tsx` (Document template)
| # | Line | Content | Classification |
|---|------|---------|----------------|
| 8 | 144 | `Email: info@varsakalabs.com &nbsp;\|&nbsp; Web: https://varsaka.com/ &nbsp;\|&nbsp; Phone: ...` | ✅ **Active document template** — Running footer on Offer Letter PDF (1 occurrence confirmed in 811-line file) |

**Context:**
```tsx
Email: info@varsakalabs.com &nbsp;|&nbsp; Web: https://varsaka.com/ &nbsp;|&nbsp; Phone: +91 40 6000 0000
```
**Recommended change:** `info@varsakalabs.com` → `info@varsaka.com`

---

### FILE 8 — `src/components/documents/ExperienceLetterTemplate.tsx` (Document template)
| # | Line | Content | Classification |
|---|------|---------|----------------|
| 9 | 129 | `Email: info@varsakalabs.com • Web: https://varsaka.com/ • Verification: {verificationUrl}` | ✅ **Active document template** — Footer bar on every Experience Letter PDF |

**Context:**
```tsx
Email: info@varsakalabs.com • Web: https://varsaka.com/ • Verification: {verificationUrl}
```
**Recommended change:** `info@varsakalabs.com` → `info@varsaka.com`

---

### FILE 9 — `COMPANY_NAME_ENTITY_CLEANUP_REPORT.md` (Historical audit document — SKIP)
| # | Line | Content | Classification |
|---|------|---------|----------------|
| 10 | 176 | `Brand/domain unchanged (varsaka.com, info@varsakalabs.com)` | 🗂 **Historical audit report** — Documents a past state. **Do not change.** |

---

## 3. Classification Summary Table

| # | File | Line | Classification | Action |
|---|------|------|----------------|--------|
| 1 | [`supabase_schema.sql`](file:///D:/19.Website/HR_Portal/supabase_schema.sql#L623) | 623 | Active config — DB seed | ✏️ **CHANGE** |
| 2 | [`supabase_schema.production.sql`](file:///D:/19.Website/HR_Portal/supabase_schema.production.sql#L758) | 758 | Active config — Production DB seed | ✏️ **CHANGE** |
| 3 | [`src/lib/db.ts`](file:///D:/19.Website/HR_Portal/src/lib/db.ts#L4347) | 4347 | Active config — Runtime fallback constant | ✏️ **CHANGE** |
| 4 | [`src/app/(portal)/settings/page.tsx`](file:///D:/19.Website/HR_Portal/src/app/(portal)/settings/page.tsx#L56) | 56 | Active config — Form initial state | ✏️ **CHANGE** |
| 5 | [`src/app/(portal)/settings/page.tsx`](file:///D:/19.Website/HR_Portal/src/app/(portal)/settings/page.tsx#L563) | 563 | Active config — UI display fallback | ✏️ **CHANGE** |
| 6 | [`src/components/documents/SalarySlipTemplate.tsx`](file:///D:/19.Website/HR_Portal/src/components/documents/SalarySlipTemplate.tsx#L204) | 204 | Active document template — Salary Slip footer | ✏️ **CHANGE** |
| 7 | [`src/components/documents/RelievingLetterTemplate.tsx`](file:///D:/19.Website/HR_Portal/src/components/documents/RelievingLetterTemplate.tsx#L138) | 138 | Active document template — Relieving Letter footer | ✏️ **CHANGE** |
| 8 | [`src/components/documents/OfferLetterTemplate.tsx`](file:///D:/19.Website/HR_Portal/src/components/documents/OfferLetterTemplate.tsx#L144) | 144 | Active document template — Offer Letter footer | ✏️ **CHANGE** |
| 9 | [`src/components/documents/ExperienceLetterTemplate.tsx`](file:///D:/19.Website/HR_Portal/src/components/documents/ExperienceLetterTemplate.tsx#L129) | 129 | Active document template — Experience Letter footer | ✏️ **CHANGE** |
| 10 | [`COMPANY_NAME_ENTITY_CLEANUP_REPORT.md`](file:///D:/19.Website/HR_Portal/COMPANY_NAME_ENTITY_CLEANUP_REPORT.md#L176) | 176 | Historical audit report | 🚫 **SKIP** |

---

## 4. Live Supabase — Read-Only Check

> **Status: READ-ONLY scan only — no DB writes performed.**

The live database is seeded from `supabase_schema.sql` / `supabase_schema.production.sql`.
Run the following queries **read-only** against your Supabase instance to confirm live state:

```sql
-- Check system_settings for the old email
SELECT key, value
FROM system_settings
WHERE value::text ILIKE '%info@varsakalabs.com%';

-- Check templates table if it exists
SELECT id, name, content
FROM templates
WHERE content::text ILIKE '%info@varsakalabs.com%';

-- Check template_versions if it exists
SELECT template_id, version, content
FROM template_versions
WHERE content::text ILIKE '%info@varsakalabs.com%';
```

> ⚠️ The schema seeds the `company_info.email` field with `info@varsakalabs.com`.
> If this seed was applied to the live DB, the `system_settings` row will contain the old email
> and must be updated with a targeted UPDATE — **not during this phase**.

**Proposed live DB update (for execution phase only — requires approval):**
```sql
UPDATE system_settings
SET value = jsonb_set(value, '{email}', '"info@varsaka.com"')
WHERE key = 'company_info'
  AND value->>'email' = 'info@varsakalabs.com';
```

---

## 5. Recommended Changes — Execution Phase

> All 9 changes are a pure string substitution:
> `info@varsakalabs.com` → `info@varsaka.com`
> No structural, formatting, or legal-text changes required.

### Source Code

| File | Line | Old | New |
|------|------|-----|-----|
| `src/lib/db.ts` | 4347 | `'info@varsakalabs.com'` | `'info@varsaka.com'` |
| `src/app/(portal)/settings/page.tsx` | 56 | `'info@varsakalabs.com'` | `'info@varsaka.com'` |
| `src/app/(portal)/settings/page.tsx` | 563 | `'info@varsakalabs.com'` | `'info@varsaka.com'` |
| `src/components/documents/SalarySlipTemplate.tsx` | 204 | `info@varsakalabs.com` | `info@varsaka.com` |
| `src/components/documents/RelievingLetterTemplate.tsx` | 138 | `info@varsakalabs.com` | `info@varsaka.com` |
| `src/components/documents/OfferLetterTemplate.tsx` | 144 | `info@varsakalabs.com` | `info@varsaka.com` |
| `src/components/documents/ExperienceLetterTemplate.tsx` | 129 | `info@varsakalabs.com` | `info@varsaka.com` |

### SQL Schema Files

| File | Line | Old | New |
|------|------|-----|-----|
| `supabase_schema.sql` | 623 | `"info@varsakalabs.com"` | `"info@varsaka.com"` |
| `supabase_schema.production.sql` | 758 | `"info@varsakalabs.com"` | `"info@varsaka.com"` |

### Live Database (deferred — run after approval)
Execute the targeted UPDATE shown in §4.

---

## 6. Exclusions Confirmed

| Category | Status |
|----------|--------|
| Employee / personal email addresses | 🚫 None found |
| SMTP configuration | 🚫 Not applicable — no SMTP config contains old email |
| Historical audit `.md` files | 🚫 1 occurrence in `COMPANY_NAME_ENTITY_CLEANUP_REPORT.md` — intentionally skipped |
| `D:\19.Website\Varsaka` | 🚫 Not scanned — excluded per instructions |
| Test fixtures | 🚫 None found |
| `node_modules` | 🚫 Not scanned |

---

## 7. Next Steps

1. **Review this report** and confirm the 9 recommended changes are approved.
2. **Execute file changes** — simple find-and-replace across 7 files.
3. **Run live DB update** — the targeted `UPDATE` in §4.
4. **Verify** with: `grep -ri "info@varsakalabs.com" src/ *.sql`
5. **Commit** with message: `chore: standardise company email to info@varsaka.com`

---

*Generated by read-only discovery scan. No files were modified.*
