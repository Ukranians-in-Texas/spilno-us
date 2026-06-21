# Research Prompt: Admin Dashboard for Ukrainian Community Directory

> **Historical** — Research completed. The admin dashboard is live at `/admin`. See [admin-dashboard.md](../implementation/admin-dashboard.md).

## Context

I'm building an admin dashboard for a Ukrainian professional services directory web app serving the Texas community. Here's the current setup:

**Frontend (this repo):**

- React 19 + Vite 7 + Tailwind CSS v4
- React Router 7, deployed on Vercel
- No Redux — React Context only
- Bilingual: English / Ukrainian

**Data layer:**

- Airtable as the database/CMS (table: `services`)
- Client never calls Airtable directly — always via Vercel serverless functions (`/api/services`, `/api/submit-service`)
- Key Airtable fields: `title`, `description_en`, `description_ua`, `category`, `address`, `phone`, `email`, `website`, `instagram`, `facebook`, `linkedin`, `messenger`, `approved` (checkbox), `featured` (checkbox), `images` (Google Drive URLs), `submittedAt`, `notes`

**Current workflow (manual and painful):**

- Users submit services via a public form → record lands in Airtable as `approved: false`
- Admin opens Airtable UI directly to review and check the `approved` checkbox
- No moderation queue, no bulk actions, no notifications

---

## Research Questions

### 1. Scope — What should the admin dashboard actually do?

Identify the minimal useful feature set for a solo/small-team admin. Consider:

- **Moderation queue** — view pending (unapproved) submissions, approve/reject with one click
- **Service management** — edit any field (title, description EN/UA, category, contact info, images), toggle `featured`, soft-delete or archive
- **Search & filter** — by category, approval status, date submitted, keyword
- **Bulk actions** — approve/reject/delete multiple records at once
- **Image management** — preview Google Drive images, reorder, remove broken links
- **Analytics** — submission trends over time, category distribution, total counts
- **Notifications** — email or Slack alert when a new submission arrives
- **Audit log** — who approved what and when (useful if multiple admins)
- **Notes field** — add internal notes per listing

Which of these are must-haves vs. nice-to-haves for a v1? What would give the most leverage to a solo admin spending 30 min/week on moderation?

---

### 2. Architecture — Separate repo or monorepo?

Evaluate these options:

**Option A: Same repo, `/admin` route, auth-gated**

- Pros: shared components, shared Vercel deployment, one codebase
- Cons: admin code ships in the public bundle (even if gated by auth), more complex build

**Option B: Separate Vite app in a `/admin` subfolder (monorepo)**

- Pros: clean separation, can have its own build/deploy, tree-shaken from public site
- Cons: shared infra (Vercel, Airtable lib) needs to be extracted

#### Option C: Completely separate repository

- Pros: fully independent, different stack possible, tightest security separation
- Cons: duplication of API logic, harder to keep in sync

#### Option D: Use Airtable's built-in interface designer or a no-code tool (Retool, Appsmith, Budibase)

- Pros: zero frontend code needed, fast to set up
- Cons: vendor lock-in, less custom UX, potential cost

Which approach is most pragmatic given:

- Single developer
- Current stack: React + Vercel serverless + Airtable
- Admin is used infrequently (a few times per week)
- Security matters but team is very small

---

### 3. Authentication — How to protect the admin?

The admin must not be publicly accessible. Options:

- **Vercel Password Protection** (built-in, per-deployment) — simplest, no code
- **HTTP Basic Auth via Vercel middleware** — simple, but credentials in env vars
- **Clerk / Auth0 / Supabase Auth** — proper OAuth, roles, sessions
- **Hardcoded email+password with JWT** — DIY, fragile
- **Vercel's own OIDC / SSO** (Team plan only)

What's the right choice for a solo/two-person team that wants "good enough" security without managing an auth service?

---

### 4. Tech Stack — What to actually build it with?

If building a custom admin (not no-code), evaluate:

- **Same stack (React + Vite + Tailwind)** — familiar, reuse existing components
- **Next.js** — SSR, built-in API routes, good for auth middleware
- **React Admin** (marmelab) — opinionated CRUD framework, Airtable adapter exists
- **AdminJS** — Node.js-based auto-generated admin panels
- **Remix** — similar to Next.js, good data mutation model

Key questions:

- Does React Admin's Airtable data provider work well in practice?
- Is the overhead of Next.js worth it for a small internal tool?
- What's the fastest path to a working moderation queue?

---

### 5. API Layer — Extend existing serverless functions or add new ones?

Current Vercel serverless functions only handle public read (`GET /api/services`) and public write (`POST /api/submit-service`). Admin needs:

- `GET /api/admin/pending` — unapproved submissions
- `PATCH /api/admin/services/:id` — approve, reject, edit fields
- `DELETE /api/admin/services/:id` — remove a listing
- `GET /api/admin/stats` — counts, trends

Options:

- Add more serverless functions to the existing repo under `/api/admin/*`
- Use Airtable's REST API directly from the admin frontend (since it's not public-facing)
- Use a different backend (e.g., a small Express server on Railway or Render)

Which is cleanest given the current Vercel + Airtable setup?

---

### 6. Delivery — What's the fastest path to a useful v1?

Given all the above, recommend a concrete v1 plan:

- Exact architecture choice and reasoning
- Minimum feature set
- Auth approach
- Estimated scope in hours for a solo developer
- What to defer to v2

---

### 7. Database — Should I stay on Airtable or migrate?

Current Airtable usage:

- ~17 fields per service record
- Records are submitted via a public form, reviewed manually, then approved
- Accessed only via Vercel serverless functions (never directly from the browser)
- No complex relations — essentially a single flat table

The admin dashboard pain point is that Airtable's own UI *is* the current admin — meaning there's no custom moderation UX, no notifications, no bulk actions without workarounds.

Evaluate whether migrating the database makes sense, considering:

#### Option A: Stay on Airtable

- Pros: zero migration effort, free tier works, non-technical admins can still open Airtable as a fallback
- Cons: API rate limits (5 req/s), no real-time, querying is limited, building a proper admin still requires custom API work

#### Option B: Firebase Firestore

- Pros: real-time listeners, generous free tier, built-in auth (Firebase Auth), good React SDKs, admin SDK for serverless, Google ecosystem
- Cons: NoSQL document model (schema flexibility but no joins), vendor lock-in, Firestore queries are limited (no full-text search), learning curve if unfamiliar

#### Option C: Supabase (Postgres)

- Pros: open-source, SQL (full queries, joins, full-text search), built-in auth + row-level security, real-time via websockets, REST and JS client, self-hostable
- Cons: slightly more setup than Firebase, free tier has pausing after inactivity

#### Option D: PlanetScale / Neon / Turso (serverless SQL)

- Pros: Postgres/MySQL-compatible, designed for serverless/edge, no connection pool issues
- Cons: no built-in auth or storage, need separate solutions

#### Option E: MongoDB Atlas

- Pros: flexible schema, good free tier, Atlas App Services has built-in auth and rules
- Cons: NoSQL, less suited for structured directory data, more complexity

Key questions:

- Does adding an admin dashboard become significantly easier with Firebase or Supabase compared to Airtable?
- Firebase Auth + Firestore vs. Supabase Auth + Postgres — which is simpler end-to-end for a small app like this?
- Is the migration effort (data export from Airtable, rewriting API functions) worth the long-term simplicity gain?
- If staying serverless on Vercel, which database plays best with Vercel Functions?

**Priority:** Keep the stack as simple as possible. Prefer a solution where the database, auth, and admin API can come from one provider rather than stitching together multiple services.

---

## Constraints & Preferences

- Solo developer (or tiny team)
- Budget-conscious (prefer free tiers)
- Already on Vercel (prefer staying there)
- Open to migrating away from Airtable if it meaningfully simplifies the stack
- Prefer TypeScript-friendly solutions
- Must work on mobile (admin might approve from phone)
- No need for real-time features (polling is fine)
