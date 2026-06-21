# Security Audit — spilno.us

**Date:** 2026-03-12

---

## Critical

### 1. Overpermissive RLS Policy

**File:** `supabase/admin-rls.sql`

```sql
create policy "Admin full access" on services
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
```

Any authenticated Supabase user — not just your admin — gets full read/write/delete on the `services` table. Needs role-based checks (e.g., a specific admin claim or `app_metadata.role = 'admin'`), not just `authenticated`.

**OWASP:** A01 – Broken Access Control

---

### 2. ~~No Auth on API Endpoints~~ — Fixed

**Files:** `api/delete-image.js`, `api/submit-service.js`

Both endpoints were callable by anyone without authentication:

- `delete-image` let anyone delete any Cloudinary image by guessing a public ID — no ownership check.
- `submit-service` accepted unlimited spam submissions with no rate limiting or auth.

**Fix (2026-03-16):** `delete-image` restricted deletion to images within `CLOUDINARY_UPLOAD_FOLDER/` prefix. `submit-service` rate-limits to 3 submissions per email per 24 hours via Supabase.

**Fix (2026-06-20):** `delete-image` now requires a valid Supabase Bearer token (admin session) — returns `401` without one. The public form no longer calls this endpoint; orphaned images are cleaned up by a weekly server-side cron (`api/cleanup-images.js`). Rate limiting on `submit-service` now fails closed (returns `500` on DB query error instead of allowing through).

**OWASP:** A01 – Broken Access Control

---

## High

### 3. ~~Missing Input Validation~~ — Fixed

**File:** `api/submit-service.js`

- No email format validation
- No phone format validation
- No category allowlist check (arbitrary strings accepted)
- No max-length limits on description, address, etc.

**Fix (2026-03-16):** Added category allowlist (all 105 subcategories), email/phone/URL format validation, and length limits on all fields.

**OWASP:** A03 – Injection, A08 – Software and Data Integrity Failures

---

### 4. ~~Vite Config Loads Server Secrets into `process.env`~~ — Fixed

**File:** `vite.config.js` (~L141–145)

```js
process.env.SUPABASE_SERVICE_KEY ||= env.SUPABASE_SERVICE_KEY
process.env.CLOUDINARY_API_SECRET ||= env.CLOUDINARY_API_SECRET
// ...
```

Server-side secrets are assigned into `process.env` at build time. These should only ever exist in API handler files — never in the Vite config.

**Fix (2026-03-16):** Moved the `process.env` assignments into `configureServer`, which only runs during `vite dev` — never during `vite build`. Secrets are no longer in `process.env` at build time.

**OWASP:** A02 – Cryptographic Failures

---

## Medium

### 5. ~~No Rate Limiting~~ — Partially Fixed

**Files:** `api/submit-service.js`, `api/delete-image.js`, `api/services.js`

**What is currently protected:**

- `POST /api/submit-service` — email-based rate limit (3/24h), fails closed on DB error; honeypot field silently rejects simple bots
- `POST /api/delete-image` — requires Supabase admin auth (no rate limit needed; access-controlled)
- `GET /api/services` — 5 min CDN cache (`s-maxage=300`)
- Vercel provides basic DDoS protection at the infrastructure level on all plans

**What is not protected:**

- `POST /api/submit-service` — IP-based limiting still missing; a bot using varied emails can still spam
- Direct Cloudinary uploads via unsigned preset bypass the backend entirely

**Remaining mitigation options:**

1. **Vercel Firewall** — per-IP/path rate limiting + bot filtering across all `/api` routes
2. **Upstash Rate Limit** — free Redis-based IP rate limiting inside serverless functions
3. **Cloudflare Turnstile** — free CAPTCHA for the submission form

**OWASP:** A04 – Insecure Design

---

### 6. ~~Admin Session Check Race Condition~~ — Fixed

**File:** `src/pages/admin/AdminLayout.jsx`

`loading` state is set *after* the async `getSession()` resolves, so admin content can briefly render before the redirect fires. Loading state should be `true` by default and only set to `false` after the session check completes.

**Fix (2026-03-16):** Added an early `return` in the unauthenticated branch so `setLoading(false)` is never called when redirecting — the loading spinner stays visible until navigation completes and the component unmounts.

**OWASP:** A01 – Broken Access Control

---

### 7. ~~No CSP Headers~~ — Fixed

**File:** `vercel.json`

No `Content-Security-Policy` header defined. Reduces protection against XSS at the HTTP layer.

**Fix (2026-03-16):** Added CSP and supporting headers in `vercel.json`:

- `Content-Security-Policy` — restricts scripts, styles, fonts, images, and connections to known origins; blocks frames and objects; includes `upgrade-insecure-requests`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — disables camera, microphone, geolocation

Note: `script-src` includes `'unsafe-inline'` to support the planned GA4 inline init script.

**OWASP:** A05 – Security Misconfiguration

---

### 8. No CSRF Protection

**Files:** `api/submit-service.js`, `api/delete-image.js`

POST endpoints have no CSRF token validation. An attacker could trick a user's browser into making requests to these endpoints.

**OWASP:** A01 – Broken Access Control

---

## Fix Priority

| Priority | Issue | File(s) | Status |
| --- | --- | --- | --- |
| ~~Now~~ | ~~Fix RLS — use admin role/claim, not just `authenticated`~~ | `supabase/admin-rls.sql` | Fixed |
| ~~Now~~ | ~~Add auth to `delete-image`~~ | `api/delete-image.js` | Fixed (Bearer token) |
| ~~This week~~ | ~~Add input validation (email, phone, category allowlist, max lengths)~~ | `api/submit-service.js` | Fixed |
| ~~This week~~ | ~~Fail-closed rate limiting~~ | `api/submit-service.js` | Fixed |
| Backlog | Add IP-based rate limiting (Vercel Firewall or Upstash) | `/api` routes | Open |
| ~~This week~~ | ~~Remove server secrets from Vite config~~ | `vite.config.js` | Fixed |
| ~~Soon~~ | ~~Add CSP headers~~ | `vercel.json` | Fixed |
| ~~Soon~~ | ~~Fix AdminLayout loading state order~~ | `src/pages/admin/AdminLayout.jsx` | Fixed |
