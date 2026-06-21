# Admin Dashboard Research Results

> **Historical** — Research completed. The admin dashboard is live at `/admin`. See [admin-dashboard.md](../implementation/admin-dashboard.md).

## Executive Summary

**Recommended stack in one sentence:** Build the admin as a lazy-loaded `/admin` route inside the existing repo, protect it with Supabase Auth + Vercel Edge Middleware, add admin-only Vercel serverless functions under `/api/admin/*` where needed, and migrate from Airtable to Supabase for auth, database, and a dramatically simpler admin API.

---

## 1. Scope — What should v1 actually do?

### Must-haves

1. **Moderation queue** — filtered list of `approved = false` records, each with a one-click Approve and Reject/Delete button. This is the core pain.
2. **Inline field editing** — click a listing to open an edit form for title, description EN/UA, category, contact info, `featured` toggle. Without this, you still have to go to Airtable for corrections.
3. **Search + status filter** — keyword search plus filter by `approved` status.
4. **Notes field** — simple textarea per listing for internal comments.
5. **Image preview** — render Google Drive URLs as `<img>` thumbnails in the edit form. Broken links are obvious immediately.

### Defer to v2

- **Bulk approve/reject** — only matters when you have more than ~20 pending items at once
- **Analytics dashboard** — submission counts over time, category distribution
- **Email/Slack notifications** — use Zapier after v1 (30-min setup)
- **Audit log** — only matters if you add a second admin
- **Image reorder / drag-and-drop**

The moderation queue + approve/reject alone eliminates 80% of the pain. Inline editing eliminates the other 20%.

---

## 2. Architecture — Same repo wins

**Recommendation: Same repo, `/admin` route, lazy-loaded via `React.lazy()`, auth-gated via Vercel Edge Middleware.**

- `React.lazy()` + dynamic `import()` gives route-level code splitting — admin JS chunk only downloads when `/admin` is visited. Middleware blocks unauthenticated requests before the page loads.
- Shared components and hooks (`useLanguage`, `ThemeContext`, category data, UI primitives) are immediately available.
- One repo, one Vercel deployment, one set of env vars.
- Adding `/api/admin/*` serverless functions to the existing repo is trivial.

A separate repo doubles operational surface area for no security benefit at this scale. No-code tools (Retool, Appsmith) introduce vendor lock-in and monthly cost.

---

## 3. Authentication — Supabase Auth

**Recommendation: Supabase Auth (email + password for admin user) + Vercel Edge Middleware.**

- **Vercel Password Protection** requires the Pro plan — not available on Hobby.
- **Clerk** is excellent but overkill for 1-2 admins; adds a third-party SDK dependency for a use case that doesn't warrant it. (Free tier: 50K Monthly Retained Users.)
- **DIY JWT** with `jose` is viable for v1 but gets replaced for free when you migrate to Supabase.

**Implementation:**

1. Create one Supabase Auth user (the admin)
2. Vercel Edge Middleware validates Supabase session cookie on every `/admin/*` request
3. Unauthenticated requests redirect to `/admin/login`
4. Login page calls `supabase.auth.signInWithPassword()`

---

## 4. Tech Stack — Same stack, no new framework

**Recommendation: React + Vite + Tailwind CSS v4 (no changes).**

- **React Admin (marmelab):** No maintained Airtable data provider. Its Material UI aesthetic fights Tailwind. Skip.
- **Refine:** Has an Airtable data provider, but if migrating to Supabase that advantage disappears. Adds heavy framework abstraction over a simple CRUD screen. Overkill.
- **Next.js / Remix:** Adding a new framework to an existing Vite project is the wrong direction.

The admin UI is: a filterable table + a slide-over edit form + a login page. Build it with existing components from `src/components/UI/` and `src/components/AddServiceForm/`. Use TanStack Table for the data table if needed.

---

## 5. API Layer — Supabase JS client directly from the admin frontend

**Recommendation: Call the Supabase JS client directly from the admin React app using the service-role key. Most admin operations need zero serverless functions.**

- The service-role key bypasses Row Level Security — acceptable in the admin since it's auth-gated and only used by you.
- The service-role key is an env var, never exposed in the public app.
- For mutations, `supabase.from('services').update({approved: true}).eq('id', id)` is called directly from the admin React component.
- The existing public serverless functions (`/api/services`, `/api/submit-service`) are rewritten to use `@supabase/supabase-js` — same endpoint URLs, no frontend changes needed.

Only add serverless functions where needed (e.g., sending notification emails, complex aggregations).

---

## 6. Delivery — v1 Plan

### Implementation Phases

| Phase | Task | Hours |
| --- | --- | --- |
| 0 | Supabase migration (export Airtable CSV → create schema → import → rewrite 2 API functions) | 4–5 |
| 1 | Auth: Supabase Auth user + Edge Middleware + `/admin/login` page | 3 |
| 2 | Moderation queue: pending list, approve/reject | 4–5 |
| 3 | All services table: search, filter, click-to-edit slide-over | 7–9 |
| 4 | Polish: mobile layout, empty states, error handling, logout | 3–4 |
| **Total** | | **~24 hours** |

### What to defer

- Notifications → Supabase Database Webhooks → Resend email (1h task, do post-v1)
- Bulk actions
- Analytics charts
- Audit log

---

## 7. Database — Migrate to Supabase

**Recommendation: Migrate to Supabase Postgres before building the admin. Do it first, not last.**

### Why not Airtable

Airtable's API doesn't support efficient multi-condition server-side filtering. You fetch all records and filter client-side — meaning paginated admin views are painful. Rate limit: 5 req/s (irrelevant for this use case but a ceiling).

### Why not Firebase Firestore

Firestore's NoSQL document model is a poor fit for a structured 17-field directory. You lose SQL aggregations (`GROUP BY category`, `COUNT(*) WHERE approved = false`), full-text search, and multi-condition queries without composite indexes for every combination.

### Why Supabase

One provider gives you everything:

| Feature | Supabase |
| --- | --- |
| Database | Postgres — full SQL, joins, aggregations, full-text search |
| Auth | Built-in email/password, OAuth, sessions, JWT |
| Row Level Security | Public API reads only `approved = true`; admin service-role bypasses RLS |
| REST API | PostgREST, wrapped by `@supabase/supabase-js` |
| Dashboard | Non-technical admins can use it as a fallback (like Airtable) |
| Vercel integration | First-class — Vercel Marketplace, auto env var sync |

### Free tier pausing

The free tier pauses after 7 days of inactivity. Once real users hit the public site, this won't be an issue. **Upgrade to Pro ($25/mo) before going to production** — no pausing, daily backups, priority support.

### Migration effort: ~4 hours

1. Export Airtable as CSV (one click)
2. Create Supabase table with matching columns (30 min)
3. Import CSV via Supabase dashboard (5 min)
4. Rewrite `/api/services.js` and `/api/submit-service.js` to use `@supabase/supabase-js` (2–3 hours)

---

## Final Recommended Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + Vite + Tailwind CSS v4 (no change) |
| Admin routing | Same repo, `/admin/*` routes, `React.lazy()` |
| Auth | Supabase Auth (email + password for admin user) |
| Database | Supabase Postgres — Pro plan ($25/mo) for production |
| Admin API | Supabase JS client with service-role key, called from admin React app |
| Public API | Existing Vercel serverless functions, rewritten to use `@supabase/supabase-js` |
| Admin protection | Supabase Auth session cookie + Vercel Edge Middleware |
| Deployment | Vercel (no change) |

---

## Post-v1 Roadmap

- **Notifications:** Supabase Database Webhook on `INSERT` to `services` → Vercel function → Resend email. ~1 hour.
- **Bulk actions:** Checkboxes + `UPDATE ... WHERE id = ANY(array)`.
- **Analytics:** `SELECT category, COUNT(*) FROM services GROUP BY category` → Recharts.
- **Audit log:** Add `approved_by` and `approved_at` columns, populate on approve action.
