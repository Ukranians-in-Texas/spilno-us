# Spilno.us — Concepts

Explanations of unfamiliar patterns, anchored to how this project actually uses them. For implementation details, API tables, and env var reference, see [technical-guide.md](technical-guide.md). For annotated end-to-end traces of each feature, see [walkthrough.md](walkthrough.md).

---

## Part 1 — Architecture Overview

## Architecture — reading the diagram

The architecture diagram in [technical-guide.md](technical-guide.md) §2 shows every component in the system and how they connect. For an interactive version with clickable nodes and animated flows, open [architecture/system-graph/index.html](architecture/system-graph/index.html) in a browser. It looks complex, but there are only **four groups** of boxes, and each group has a simple job.

### The four groups

**1. Public read path** (left side)

```text
Public visitor  →  React SPA  →  api/services.js  →  Supabase
```

A visitor opens the site. The React SPA calls `GET /api/services`. That serverless function queries Supabase using the **service key** (which bypasses RLS), filters to `approved=true` rows, and returns JSON with cache headers (`s-maxage=300`). The SPA renders the listings. The visitor never touches Supabase directly.

**2. Submission path** (top center)

```text
Submitter  →  AddServiceForm  →  Cloudinary (images)
                               →  api/submit-service.js  →  Supabase + Telegram
```

A submitter fills the form. Images upload directly from the browser to Cloudinary (unsigned preset — no server involved). On submit, the form `POST`s to `/api/submit-service`, which runs a gauntlet of checks:

1. **Honeypot** — if the hidden field is filled, return 200 silently (fool the bot)
2. **Required fields** — category, business name, descriptions, email
3. **Category allowlist** — must be one of 105 known subcategories
4. **Format validation** — email, phone, URL, social link regexes
5. **Length limits** — per-field character caps
6. **Image filter** — URLs must start with `https://res.cloudinary.com/`, max 5
7. **Rate limit** — count this email's rows in the last 24h; 3 or more → 429. Fails closed (DB error → 500, not "let it through")
8. **Insert** — `approved=false`, using the service key
9. **Telegram notify** — sends a message with inline Approve/Delete buttons. Failure is logged, not fatal.

**3. Admin path** (center)

```text
Admin  →  admin dashboard  →  Supabase (direct, anon key + JWT + RLS)
                            →  api/delete-image.js (with Bearer token)  →  Cloudinary
```

The admin logs into `/admin` via Supabase Auth. The dashboard talks directly to Supabase using the browser client (anon key) — RLS enforces that only admin-role JWTs get full access. For image deletion, the dashboard calls `/api/delete-image` with the admin's session token in the `Authorization` header.

There's a parallel admin flow through **Telegram**: the admin taps an Approve or Delete button on the notification message. Telegram sends a callback to `/api/telegram-webhook`, which verifies a shared secret header, performs the action, and edits the original message to show the result. The two flows are intentionally redundant — phone vs. desktop.

**4. Background jobs** (right side)

```text
Vercel cron daily   →  api/keep-alive.js    →  Supabase (SELECT 1 row)
Vercel cron weekly  →  api/cleanup-images.js →  Cloudinary + Supabase + Telegram
```

Two crons run automatically:

- **keep-alive** (daily midnight UTC) — runs a trivial query to prevent Supabase from idling the free-tier project
- **cleanup-images** (Sunday 3 AM UTC) — lists all Cloudinary images, cross-references against the `services` table, and deletes orphans older than 48 hours. Sends a Telegram alert with the count or any errors.

### The three external services

All three are **managed services** — no servers to maintain:

**Supabase** (center-bottom cylinder) — Postgres database with Row Level Security. The single `services` table holds all listings. Two access patterns: serverless functions use the service key (full access), the admin browser client uses the anon key + JWT (RLS-gated).

**Cloudinary** (right cylinder) — image CDN. Images go in via unsigned browser uploads and come out via optimized URLs (`f_auto,q_auto,w_1200`). Deletions require the Admin API secret, so they only happen server-side.

**Telegram Bot API** (right box) — receives submission notifications and sends callbacks when the admin taps buttons. Also receives cleanup cron alerts. No webhooks to manage beyond the initial `setWebhook` registration.

### What connects to what

Every arrow in the diagram is a real network call. The key insight is **who is allowed to talk to the database**:

| Caller | Talks to Supabase? | How |
| --- | --- | --- |
| Public visitor (browser) | No — goes through `/api/services` | Serverless function, service key |
| Submitter (browser) | No — goes through `/api/submit-service` | Serverless function, service key |
| Admin dashboard (browser) | Yes — direct | Anon key + JWT, RLS-gated |
| Serverless functions (`/api/*`) | Yes — direct | Service key, bypasses RLS |
| Telegram webhook | Yes — through `/api/telegram-webhook` | Serverless function, service key |
| Cron jobs | Yes — through serverless functions | Service key |

The browser **never** has the service key. The admin browser client has the anon key, which is safe because RLS enforces access rules in Postgres itself.

---

## Part 2 — The Data Layer

## Supabase Postgres

The database is a single Postgres instance managed by Supabase. There is no ORM — queries are built with `supabase-js`, which is essentially a REST client that maps method calls to Supabase's PostgREST API:

> **What's an ORM?** An ORM (Object-Relational Mapper) is a library that lets you work with database rows as native objects in your language — e.g. `User.find(id)` or `user.save()` — generating the underlying SQL for you and often handling migrations, relationships, and connection pooling. Examples include Prisma, Drizzle, and TypeORM. This project deliberately skips that layer: `supabase-js` is a thin query builder over an HTTP API, not an ORM. The HTTP API on the other end is **PostgREST** — see its own section below.

```js
// api/_lib/supabase.js — server-side client
const { data, error } = await supabase
  .from('services')
  .select('*')
  .eq('approved', true);
```

This is not raw SQL. The `.from().select().eq()` chain builds an HTTP request to PostgREST, which translates it to SQL on the server. The advantage is that RLS policies apply even to these calls (unless using the service key, which bypasses RLS).

There is no migration tool. Schema changes are applied manually via the Supabase SQL Editor. The table definition lives in [supabase/schema.sql](../supabase/schema.sql) as a reference, but it is not automatically applied — you copy-paste it into the SQL Editor when setting up a new environment.

> **Related:** [technical-guide.md §5](technical-guide.md#5-data-architecture) — full column types and notes on data shape.

---

## PostgREST — the HTTP layer in front of Postgres

Nothing in this project ever opens a raw Postgres connection. There's no connection string, no port 5432, no SQL driver. Every database operation — public reads, admin writes, the rate-limit count, the keep-alive ping — is an **HTTP request**. The thing that turns those HTTP requests into actual SQL is **PostgREST**, and Supabase runs it for you.

### What PostgREST is

PostgREST is a standalone web server that points at a Postgres database and automatically exposes it as a RESTful API. You don't write endpoint code — it reads the database's schema (tables, views, columns, types) and generates an endpoint for each table on the fly. Add a column in SQL, and it's immediately queryable over HTTP; no redeploy, no code change.

Querying is expressed through the URL. Filtering, ordering, selecting columns, and pagination are all query parameters:

```text
GET /rest/v1/services?approved=eq.true&select=id,title,category&order=created_at.desc
```

PostgREST parses that, builds the equivalent `SELECT id, title, category FROM services WHERE approved = true ORDER BY created_at DESC`, runs it, and returns JSON.

### Where it sits

PostgREST is a layer **between the client and Postgres** — it never replaces the database, it fronts it:

```text
                        ┌──────────────────── Supabase (managed) ───────────────────┐
                        │                                                            │
supabase-js client  ──HTTP──►  PostgREST  ──SQL──►  Postgres  ──►  RLS policies      │
(server or browser)     │      (REST API)           (the DB)       enforce access    │
                        │                                                            │
                        └────────────────────────────────────────────────────────────┘
```

Three things live inside the Supabase box, in order: PostgREST (translates HTTP → SQL), Postgres (runs the SQL), and the RLS policies (decide which rows the SQL is actually allowed to touch). The client only ever talks to the first one.

In this project the client is always `supabase-js`. The `.from().select().eq()` method chain doesn't run SQL — it **builds the PostgREST URL** shown above and sends it. That's why the CLAUDE.md note calls it "essentially a REST client": it's a fluent wrapper that produces HTTP requests, not a database driver.

```js
// This chain...
await supabase.from('services').select('id,title').eq('approved', true);

// ...becomes this request:
// GET /rest/v1/services?select=id,title&approved=eq.true
```

### How auth and RLS plug in

Every PostgREST request carries an API key (and optionally a JWT) in its headers. PostgREST uses it to decide **which Postgres role** the query runs as — and that role is what RLS policies check against:

- **Anon key** → runs as the `anon` role. RLS allows only `SELECT` on `approved = true` rows. This is what the admin browser client and any direct public read would use.
- **Anon key + admin JWT** → still the authenticated role, but `auth.jwt()` now exposes `app_metadata.role = 'admin'`, so the admin RLS policy grants full access.
- **Service key** → runs as a privileged role that **bypasses RLS entirely**. This is what the `/api/*` serverless functions use, which is why they can insert unapproved rows and count across all rows.

The key insight: PostgREST doesn't enforce access rules itself — it faithfully runs the query as the role the key maps to, and **Postgres + RLS** do the enforcement one layer deeper. That's what makes it safe to expose the anon key in the browser bundle (see "Service key vs. anon key" below).

### Why this architecture instead of a custom API

The alternative is hand-writing a CRUD endpoint for every operation. PostgREST removes that work: the schema *is* the API. For a single-table directory, that means the admin dashboard can do all its reads and writes against Supabase directly, with zero backend code, and trust RLS to keep it secure.

The project still puts one custom function in front of public reads — `/api/services` — but not because PostgREST couldn't serve them. It's for CDN caching, response shaping, and credential isolation (see "The read proxy pattern" in Part 3). Everything else rides PostgREST directly.

> **Related:** [technical-guide.md §5](technical-guide.md#5-data-architecture) — data architecture. The "Service key vs. anon key" and "Row Level Security (RLS)" sections below cover the role-mapping and enforcement halves of the picture.

---

## Two Supabase clients — why and when

The project has two completely separate Supabase clients with different access levels:

**Server-side** ([api/_lib/supabase.js](../api/_lib/supabase.js)) — uses `SUPABASE_SERVICE_KEY`. This key bypasses Row Level Security (see below) and has full read/write access. It only runs inside Vercel serverless functions — never in the browser.

**Browser-side** ([src/lib/supabaseClient.js](../src/lib/supabaseClient.js)) — uses `VITE_SUPABASE_ANON_KEY`. This key is safe to expose in the browser bundle because RLS controls what it can do. Only the admin dashboard uses this client.

| Client | Key | Used by | Can do |
| --- | --- | --- | --- |
| Server | `SUPABASE_SERVICE_KEY` | `/api/*` serverless functions | Everything (bypasses RLS) |
| Browser | `VITE_SUPABASE_ANON_KEY` | Admin dashboard pages | Only what RLS allows |

The split exists so that public users never touch the database directly — all public reads go through `/api/services`, which uses the service key server-side.

---

## Service key vs. anon key

Every Supabase project comes with two API keys. They're both just strings passed in the `Authorization` header when talking to Supabase's REST API, but they grant different levels of access:

**Anon key** (`VITE_SUPABASE_ANON_KEY`) — the "public" key. It identifies the request as coming from an anonymous (unauthenticated) user. Supabase treats it as a regular database role with **no special privileges** — it can only do what RLS policies explicitly allow. In this project, that means `SELECT` on approved rows and nothing else. It's safe to embed in the browser bundle because even if someone copies it, RLS limits what they can do with it.

**Service key** (`SUPABASE_SERVICE_KEY`) — the "admin" key. It tells Supabase to **bypass RLS entirely** and grants full read/write access to every table, every row, without any policy checks. It's equivalent to connecting to Postgres as a superuser. This key must never leave the server — if it leaked, anyone could read, modify, or delete every row in the database.

### How they're used in code

The server-side client passes the service key when creating the Supabase client:

```js
// api/_lib/supabase.js — runs on Vercel, never in the browser
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
```

The browser-side client passes the anon key:

```js
// src/lib/supabaseClient.js — bundled into the app, visible to anyone
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
```

Both call the same `createClient` function from `@supabase/supabase-js` — the only difference is which key they pass. Supabase decides what to allow based on the key.

### Why serverless functions use the service key

The serverless functions need to do things that no RLS policy allows for anonymous users:

- **Insert unapproved rows** — the public read policy only allows `SELECT`, not `INSERT`
- **Count rows for rate limiting** — needs to count all rows by email, including unapproved ones
- **Delete rows and images** — the Telegram webhook and cleanup cron need full write access
- **Read all columns** — the public API returns only certain fields, but the function needs access to all of them to decide what to return

Using the anon key for these operations would require writing permissive RLS policies that defeat the purpose of having RLS in the first place. The service key sidesteps this cleanly — but only from trusted server-side code.

### How isolation is enforced

"The service key must never reach the client" is a rule, but it's enforced by two concrete mechanisms — not just discipline:

**Vite's environment variable boundary.** Vite only includes environment variables that start with `VITE_` in the browser bundle. `SUPABASE_SERVICE_KEY` (no `VITE_` prefix) is invisible to client-side code — `import.meta.env.SUPABASE_SERVICE_KEY` returns `undefined` in the browser. You'd have to deliberately rename it to `VITE_SUPABASE_SERVICE_KEY` to leak it. The `VITE_` prefix convention is the compile-time firewall.

**Vercel's runtime boundary.** Serverless functions (`api/*.js`) run in a Node.js environment on Vercel's servers. Environment variables set in the Vercel dashboard (like `SUPABASE_SERVICE_KEY`) are available via `process.env` in those functions but are never sent to the browser. The browser only receives the built static files — HTML, CSS, and the JavaScript bundle that Vite produced — which can only contain `VITE_`-prefixed variables.

```text
Vercel dashboard env vars
├── SUPABASE_SERVICE_KEY     →  process.env (server only)
├── CLOUDINARY_API_SECRET    →  process.env (server only)
├── TELEGRAM_BOT_TOKEN       →  process.env (server only)
├── VITE_SUPABASE_ANON_KEY   →  process.env (server) + import.meta.env (browser)
└── VITE_SUPABASE_URL        →  process.env (server) + import.meta.env (browser)
```

This pattern applies to all server-side secrets, not just the Supabase service key. The Cloudinary API secret and Telegram bot token are similarly isolated — they exist only in serverless functions and never appear in the browser bundle.

> **Related:** [technical-guide.md §11](technical-guide.md#11-environment-variables) — complete env var table with scope, required/optional, and secret flags. [§14](technical-guide.md#14-security-model) — security model overview.

### Why the admin dashboard uses the anon key (not the service key)

The admin dashboard runs in the browser, so it can't use the service key — that would expose it in the JavaScript bundle. Instead, it uses the anon key paired with an **authenticated JWT**. When the admin logs in via `supabase.auth.signInWithPassword()`, the client gets a JWT with `app_metadata.role = 'admin'`. The RLS admin policy checks this claim and grants full access. The result is the same level of access as the service key, but gated behind a login rather than a leaked secret.

---

## JWT (JSON Web Token)

A JWT is a self-contained identity token — a string that carries claims about who the user is, signed by a secret so the receiver can trust it without a database lookup.

### What's inside

A JWT has three parts separated by dots: `header.payload.signature`. The payload is the useful part — a JSON object with claims:

```text
{
  "sub": "uuid-of-admin-user",
  "app_metadata": { "role": "admin" },
  "exp": 1750000000
}
```

`sub` is the user ID. `app_metadata` carries application-specific data (like the admin role). `exp` is the expiration timestamp — after this time, the token is invalid.

The whole thing is Base64-encoded (not encrypted — anyone can read it) and then **signed** with a secret key. The signature means: "the server that issued this token vouches that these claims are real." If someone tampers with the payload (e.g., changes `role` to `admin`), the signature check fails and the token is rejected.

### How Supabase uses JWTs

When the admin calls `supabase.auth.signInWithPassword()`, Supabase Auth verifies the credentials and returns a JWT. The `supabase-js` client stores this token and automatically sends it in the `Authorization` header with every subsequent request:

```text
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

On the Supabase side, the Postgres function `auth.jwt()` extracts claims from this token. RLS policies use it to decide access — for example, checking whether `app_metadata.role` is `'admin'` before allowing a write.

### Why "self-contained" matters

Traditional session-based auth stores a session ID in a cookie and looks up the user in a database on every request. JWTs skip that lookup — all the information is in the token itself. The server just verifies the signature (a fast cryptographic check) and reads the claims. The trade-off: you can't revoke a JWT before it expires without adding a blocklist (which reintroduces the database lookup). Supabase JWTs expire after 1 hour by default, limiting the window.

### How the token pair gets set up

The two tokens come into existence at login and are then maintained automatically by the client — the app never builds or signs a token itself. The full lifecycle:

1. **Login.** The admin submits the form on `/admin/login`, which calls `supabase.auth.signInWithPassword({ email, password })`. This is an HTTPS request to Supabase's **Auth** service (a separate service from PostgREST — it's the `/auth/v1` endpoint, not `/rest/v1`).
2. **Issuance.** Supabase Auth verifies the credentials against its own users table. On success it **signs** a new access token (JWT) with the project's secret and generates a random refresh token, returning both as a `session` object. The signing happens server-side at Supabase — the secret never reaches the browser, which is why a tampered token (e.g. someone flipping `role` to `admin`) fails the signature check.
3. **Storage.** `supabase-js` writes the session (both tokens) into localStorage under a key like `sb-<project-ref>-auth-token`. This is what makes the login "stick" across page reloads and new tabs — on startup the client reads that key back and restores the session.
4. **Use.** From then on, the browser client automatically attaches the access token as `Authorization: Bearer …` on every request to Supabase. Nothing in the app code passes the token around manually.
5. **Auto-refresh.** Shortly before the access token's ~1-hour expiry, `supabase-js` silently POSTs the refresh token to Auth, gets a fresh access token (and usually a rotated refresh token) back, and overwrites the localStorage entry. This is why the admin stays logged in for days without re-entering a password, even though each individual JWT only lives an hour.
6. **Teardown.** `supabase.auth.signOut()` clears the localStorage entry and tells Auth to invalidate the refresh token, ending the session.

The key takeaway: **the project writes none of this.** It only calls `signInWithPassword` / `signOut` and reads the user from the client. Issuance, signing, storage, attachment, and refresh are all handled by Supabase Auth and `supabase-js`. The single piece of project-specific configuration is server-side — the `app_metadata.role = 'admin'` claim that gets baked into the JWT at issuance (set when the admin user is provisioned), which is what the RLS policy later checks.

### What if the admin JWT is stolen?

The "self-contained" property cuts both ways: because the token *is* the identity, anyone holding a valid admin JWT **is** the admin as far as Postgres is concerned. The RLS admin policy grants access purely on the `app_metadata.role = 'admin'` claim — there's no second check, no "is this really the admin" lookup. So a stolen token is full admin access: approve, edit, delete, and read every row (including unapproved submissions and internal `notes`).

**How easy is it actually to steal one?** Harder than it sounds for a remote attacker, because the token never travels anywhere useful to them on its own. It lives in the admin's browser (localStorage) and is only ever sent — over HTTPS — to Supabase. To get it, an attacker needs code running in the admin's browser or access to the admin's device. The realistic vectors, roughly easiest to hardest:

- **A malicious browser extension or compromised device.** Any extension with "read data on all sites" permission can read localStorage; so can malware or anyone with physical access to an unlocked machine. This is the most plausible route and the hardest to defend against from the app side — the attack surface is essentially *that one admin's browser*.
- **Phishing.** Trick the admin into logging into a lookalike admin page, or into pasting a token. Social engineering, not a code flaw — no amount of CSP stops it.
- **XSS (cross-site scripting).** Inject JavaScript into the real site that reads the token and ships it to the attacker. This is the classic browser-token theft vector, but it's **hard here**: React escapes rendered values by default, and the CSP's `connect-src` allowlist blocks the script from sending the stolen token to an attacker-controlled domain. An attacker would need both an injection hole *and* a way to exfiltrate within the CSP's allowed destinations. (Note the CSP does permit `'unsafe-inline'` scripts, which weakens — but doesn't remove — this protection.)
- **Supply-chain compromise.** A malicious npm dependency that runs at build or runtime could read the token directly. Low probability, high effort, and hard to detect — the same risk every JS app carries.
- **Network interception.** Effectively closed by HTTPS — the token is encrypted in transit and never sent over plain HTTP.

The short version: there's no easy remote "grab the JWT" button. A determined attacker has to either compromise the admin's machine/browser or find a genuine XSS hole and slip past the CSP. For a single-admin app, that means the practical security boundary is the admin's own device hygiene.

**How many tokens are there?** Two, and the distinction matters for theft. When the admin logs in, Supabase Auth returns a **token pair**, both kept in the same localStorage entry:

| Token | Lifetime | What it's for | If stolen |
| --- | --- | --- | --- |
| **Access token** (the JWT) | ~1 hour | Sent as `Authorization: Bearer …` on every request; carries the `role: admin` claim that RLS checks | Admin access until it expires (≤1h) |
| **Refresh token** | Long-lived (weeks, until used/revoked) | Exchanged for a fresh access token when the current one expires, so the admin isn't logged out hourly | Attacker can mint new access tokens indefinitely until it's revoked |

So "the JWT" is really only half the story — there are two secrets sitting in the browser, and the long-lived one is the dangerous one to lose (covered next).

**How long the damage lasts:** up to the token's expiry. Supabase access tokens default to 1 hour. As covered under "Why 'self-contained' matters" above, the project keeps no blocklist — Postgres trusts any token with a valid signature and doesn't check it against a list of revoked ones. So a leaked access token can't be cancelled early; it simply has to expire.

**The refresh token is the bigger prize.** `supabase-js` stores *two* things in the browser (localStorage by default): the short-lived JWT *and* a long-lived **refresh token** that mints fresh JWTs on demand. Stealing the refresh token is far worse than stealing one 1-hour JWT — the attacker keeps minting valid admin tokens until that refresh token is revoked (the admin signs out, or the session is killed from the Supabase dashboard). When people ask "what if the JWT is stolen," for this stack the refresh token is the real concern.

**Is one harder to steal than the other?** For the dominant theft vectors, no — they're equally exposed, because both tokens live in the **same localStorage entry** (`sb-<project-ref>-auth-token`). Anything that can read localStorage — XSS, a malicious extension, malware on the admin's device — gets the whole session object in one read, access token *and* refresh token together. There's no scenario where the localStorage attack grabs one but not the other.

The only asymmetry is in transit, and it slightly favors the *access* token being easier to leak, not harder: the access token is sent on **every** request to Supabase (`Authorization: Bearer …`), while the refresh token is sent only during the occasional refresh call to the Auth endpoint. So in narrow transit-leak scenarios — a misconfigured logging proxy, a screenshared devtools Network tab, browser history — the access token has more chances to surface on its own. HTTPS closes the realistic version of this, and either way it's the *less* damaging token to lose. Bottom line: if an attacker can steal either one, they can almost certainly steal both, and the refresh token is what makes that bad.

**What limits the damage here:**

- **CSP** ([vercel.json](../vercel.json)) — the main browser-token theft vector is XSS, and the strict `script-src` allowlist makes injecting a token-exfiltrating script hard. This is the project's primary defense (see "HTTP headers" → Security headers).
- **HTTPS everywhere** — rules out network sniffing of the `Authorization: Bearer` header in transit.
- **1-hour expiry** — caps the window for a leaked *access* token.
- **Small blast radius** — this is a public directory. No payments, no user accounts, no sensitive PII beyond submitter email/phone. Worst case is spam approvals or row/image deletion — all recoverable, none catastrophic.

**The honest gaps:**

- Tokens live in **localStorage**, readable by any JavaScript on the page — the trade-off for SPA convenience versus `httpOnly` cookies, which JS can't read.
- **No revocation list** — a leaked token works until expiry by design.
- No IP binding or device fingerprinting on the admin session.

For a single-admin directory app, this is a reasonable posture: CSP + short expiry + low-value data keep the realistic risk low. If the data sensitivity ever rises, the first hardening steps would be moving tokens to `httpOnly` cookies and adding a revocation/blocklist check.

> **Related:** [technical-guide.md §6.3](technical-guide.md#63-authentication--authorization) — auth implementation details and admin provisioning. [security-audit.md §9](security-audit.md) — the session-storage gaps tracked as a Low finding. [technical-guide.md §17](technical-guide.md#17-open-questions--future-work) item 10 — the same gaps in Future Work.

---

## Row Level Security (RLS)

RLS is a Postgres feature that enforces access rules **inside the database itself**, not in application code. When RLS is enabled on a table, every query gets an invisible `WHERE` clause appended by Postgres — even if the caller tries `SELECT * FROM services`, they only see the rows their policy allows.

### What "enable row level security" does

```sql
alter table services enable row level security;
```

This one line changes the default from "anyone can see everything" to "no one can see anything unless a policy explicitly allows it." It's a deny-by-default switch. Without any policies, the table becomes completely invisible to non-superuser roles.

### The two policies

**Public read** ([supabase/schema.sql](../supabase/schema.sql)):

```sql
create policy "Public can read approved services" on services
  for select using (approved = true);
```

The `using (approved = true)` clause is the filter. When an unauthenticated user (or anyone with the anon key) runs `SELECT * FROM services`, Postgres silently rewrites it to `SELECT * FROM services WHERE approved = true`. Unapproved submissions, internal notes, and pending records are invisible — not hidden by the application, but invisible at the database level. No amount of creative API calls can bypass this.

**Admin full access** ([supabase/admin-rls.sql](../supabase/admin-rls.sql)):

```sql
create policy "Admin full access" on services
  for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

This policy applies to all operations (`for all` — SELECT, INSERT, UPDATE, DELETE). It reads the JWT that Supabase attaches to the request, extracts the `role` field from `app_metadata`, and only allows the operation if the value is `'admin'`. The `using` clause controls reads; `with check` controls writes.

### How Supabase connects identity to policies

When the admin dashboard calls `supabase.auth.signInWithPassword()`, Supabase returns a JWT containing the user's identity and metadata:

```text
JWT payload (simplified):
{
  "sub": "uuid-of-admin-user",
  "app_metadata": { "role": "admin" },
  ...
}
```

The `supabase-js` client automatically sends this JWT with every subsequent request. Postgres receives it, and the `auth.jwt()` function inside the policy extracts the claims. If `role` is `'admin'`, the policy passes; if not, the row is invisible or the write is rejected.

### Why this matters

The alternative is enforcing access in application code — adding `WHERE approved = true` to every query, checking user roles in every API handler. That works, but one missed check means a data leak. RLS moves the enforcement to the database, so a bug in the application code can't expose rows that Postgres has already filtered out. Even if someone extracts the anon key from the browser bundle, the database itself rejects unauthorized operations.

This is why the admin dashboard can call Supabase directly from the browser — the anon key + the admin's JWT together satisfy the RLS policy. No serverless function needed for admin reads/writes.

---

## The `services` table

The entire application runs on a **single table**. There are no joins, no foreign keys, no relations. Every listing — pending, approved, featured — is a row in `services`.

```text
services
────────────────────────────────────────────────────────────
id              uuid        PK, auto-generated
title           text        business name (required)
description_en  text        English description
description_ua  text        Ukrainian description
category        text        subcategory string, e.g. "Plumbing"
address         text        physical address (optional)
phone           text        contact phone (optional)
email           text        contact email (required for submission)
website         text        business website URL (optional)
instagram       text        Instagram handle or URL (optional)
facebook        text        Facebook page URL (optional)
linkedin        text        LinkedIn profile URL (optional)
messenger       text        Messenger link (optional)
images          text        comma-separated Cloudinary URLs (max 5)
approved        boolean     false = pending review, true = visible to public
featured        boolean     false = regular, true = highlighted on homepage
featured_order  integer     sort order within featured listings (nullable)
notes           text        internal admin notes (never shown publicly)
submitted_at    timestamptz when the form was submitted
created_at      timestamptz row creation timestamp
```

A few things to notice:

**No user table.** Submissions are anonymous — identified only by the `email` field, which is a plain text column, not a foreign key. The admin logs in via Supabase Auth (a separate system), not a row in this table.

**No category table.** Categories and subcategories are hardcoded in [src/data/categories.js](../src/data/categories.js) — 21 parent categories with 105 subcategories total. The `category` column stores the subcategory string verbatim (e.g. `"Plumbing"`). The submit endpoint validates it against the allowlist; the frontend maps it back to a parent category and icon for display.

**Two description columns** instead of one. `description_en` and `description_ua` store the English and Ukrainian versions side by side. The API returns whichever matches the requested language, falling back to the other if one is empty.

**`images` is a CSV string**, not an array or a join table. See the "Images as comma-separated strings" section below.

---

## The status lifecycle

A listing moves through a simple state machine:

```text
submitted → pending → approved → (optionally) featured
                    ↘ deleted
```

**Pending** (`approved=false`, `featured=false`) — the default state after submission. The row exists in the database but is invisible to the public (RLS blocks it). Only the admin dashboard and Telegram bot can see it.

**Approved** (`approved=true`, `featured=false`) — the admin taps Approve (via Telegram or the dashboard). The row becomes visible to public visitors through `/api/services`. It appears in search results and category filters.

**Featured** (`approved=true`, `featured=true`, `featured_order=N`) — the admin manually flags a listing as featured via the dashboard. Featured listings appear in a highlighted section on the homepage, sorted by `featured_order`. Setting `featured_order` to `null` removes the ordering (the listing is still featured but sorts last).

**Deleted** — the admin taps Delete. The row is removed from the database entirely, and its Cloudinary images are deleted server-side. There is no soft delete.

The `notes` column is not part of the lifecycle — it's a free-text field the admin can use for internal context (e.g. "duplicate of row X", "asked to update phone number"). It is never exposed through the public API.

---

## Images as comma-separated strings

The `images` column in the `services` table is a single `text` field, not an array. Multiple image URLs are stored as a comma-separated string:

```text
https://res.cloudinary.com/.../img1.jpg, https://res.cloudinary.com/.../img2.jpg
```

Every place that reads images must `.split(',')`, `.trim()`, and filter to the `https://res.cloudinary.com/` prefix. Reordering images (in the admin edit panel) means rewriting the entire CSV string.

This is a deliberate simplicity trade-off — a proper `service_images` join table would be cleaner but adds migration and query complexity that isn't justified for a max of 5 images per listing.

---

## Why a single table works here

A typical transactional app has many tables with foreign keys, cascading deletes, and upsert patterns. This project has one table and no relations. The difference comes down to what each app does:

- A transactional app revolves around related entities — users, carts, orders, reviews. Each references others, and consistency matters (you can't delete a product that has orders).
- Spilno.us is a directory — each listing is self-contained. There's nothing to join against.

The trade-offs of the single-table approach:

| Advantage | Disadvantage |
| --- | --- |
| No migrations, no schema drift | Categories can't be managed from the database |
| No joins — every query is a simple filter | Images stored as CSV, not normalized |
| Easy to reason about — one row = one listing | No relational integrity (email is just text) |
| Supabase dashboard shows everything in one view | `notes`, `featured_order` are admin-only but share the same table |

For a directory with <500 listings and a single admin, this is the right trade-off. The point where it breaks: if listings need to belong to registered users, or if categories need to be editable from the admin dashboard, then the schema needs to grow.

---

## Part 3 — The API & Server Layer

## Serverless functions

A traditional web server is a long-running process — you start it, it listens for requests, and it stays alive between requests. You pay for the server 24/7 whether it's handling traffic or idle.

A **serverless function** is the opposite: it doesn't exist until a request arrives. The platform (Vercel, in this project) spins up a small Node.js environment, runs your function, returns the response, and then the environment can be reused or shut down. You pay per invocation, not per hour.

### How it works in this project

Every `.js` file in the `api/` directory is automatically deployed as a serverless function. No configuration, no server setup — Vercel detects the files and creates HTTP endpoints:

```text
api/services.js          →  GET  /api/services
api/submit-service.js    →  POST /api/submit-service
api/delete-image.js      →  DELETE /api/delete-image
api/telegram-webhook.js  →  POST /api/telegram-webhook
api/keep-alive.js        →  GET  /api/keep-alive
```

Each function exports a `handler` that receives `req` (the request) and `res` (the response) — the same interface as Express.js:

```js
// api/services.js
export default async function handler(req, res) {
  const services = await fetchApprovedServices(req.query);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  return res.status(200).json(services);
}
```

### What "stateless" means

Each invocation starts fresh. There's no shared memory between requests — no global variable that accumulates state across calls. This is why rate limiting can't use an in-memory counter (it would reset with each new invocation). The project uses a database query instead: count rows in Supabase where the email matches and `submitted_at` is within the last 24 hours.

Files in the `api/_lib/` directory are **not** deployed as endpoints — the underscore prefix tells Vercel to skip them. They're shared utility modules that the actual serverless functions import (`supabase.js`, `telegram.js`, `cloudinary.js`).

### During local development

In production, Vercel handles the serverless function lifecycle. During `npm run dev`, there's no Vercel — Vite's dev server runs instead. The project uses Vite middleware (configured in `vite.config.js`) to intercept `/api/*` requests and call the handler functions locally, simulating the serverless behavior.

> **Related:** [technical-guide.md §3](technical-guide.md#3-repository-structure) — full repo structure with all `api/` files. [§13](technical-guide.md#13-local-api-vs-production-api--divergence-important) — local vs. production API divergence (the local middleware skips rate limiting, category allowlist, and format checks).

---

## The read proxy pattern

A **proxy** is something that acts on behalf of someone else. In networking, a proxy server sits between a client and a destination, forwarding requests so the client never talks to the destination directly.

In this project, `/api/services` is a **read proxy** — a serverless function that sits between the browser and Supabase. The browser asks the proxy for listings; the proxy asks Supabase, gets the data, and passes it back:

```text
without proxy:   Browser  →  Supabase
with proxy:      Browser  →  /api/services  →  Supabase
```

The browser doesn't know or care that Supabase exists. It just calls `/api/services` and gets JSON.

### Why not let the browser query Supabase directly?

It could — Supabase exposes a REST API, and the anon key + RLS would correctly limit public reads to approved rows. But going through a proxy gives us three things we can't get with a direct connection:

**1. Caching at the CDN layer.** The proxy sets `Cache-Control: s-maxage=300, stale-while-revalidate=600` on the response. This tells Vercel's CDN to cache the JSON for 5 minutes and serve stale data for up to 10 minutes while revalidating in the background. Result: most page loads never hit the database at all — they get a cached response from Vercel's edge network in milliseconds. Direct Supabase calls from the browser would bypass this entirely; every visitor would trigger a fresh database query.

**2. Response shaping.** The proxy decides which columns to return and in what format. The `services` table has columns the public should never see (`notes`, `submitted_at`, internal flags). The proxy filters these out server-side rather than trusting the client to ignore them. It can also transform the response — e.g., rename fields, flatten nested data, or add computed properties — without changing the database schema.

**3. Credential isolation.** The proxy uses the service key (which bypasses RLS and has full database access) but that key lives only in the Vercel environment — the browser never sees it. Without the proxy, the browser would need the Supabase URL and anon key embedded in the JavaScript bundle. While the anon key is designed to be public, not exposing any Supabase credentials to public visitors is a stronger security posture.

### Why the admin dashboard skips the proxy

The admin dashboard talks to Supabase directly (anon key + JWT) because it has different needs:

- It reads **and writes** all rows, including unapproved ones — a read-only proxy wouldn't help
- It needs **real-time** data (no 5-minute cache) to manage the review queue
- RLS already enforces admin-only access via the JWT claim, so the proxy's filtering isn't needed
- Adding a proxy for every admin operation would mean building a full CRUD API, which is the complexity Supabase is meant to eliminate

> **Related:** [technical-guide.md §6.1](technical-guide.md#61-public-read-path) — the full call chain from `useServices` hook to `fetchApprovedServices`.

---

## Client vs. server validation — "the server is authoritative"

The Add Service form validates input in two places: once in the browser (`AddServiceForm`) before submitting, and again on the server (`api/submit-service.js`) before inserting. The checks overlap — both verify required fields, email format, URL format, category allowlist, and length limits. This duplication is intentional.

### Why validate on the client at all?

For **user experience**. Client-side validation gives instant feedback — "email is required" appears the moment you blur the field, without a network round-trip. The form can highlight the exact field, scroll to it, and prevent submission before the user waits for a server response. Without it, every mistake means submitting the form, waiting for a 400 response, and parsing the error to figure out what went wrong.

### Why validate again on the server?

Because **the client can't be trusted**. Client-side validation runs in the user's browser — they can disable JavaScript, modify the form HTML, or send a `POST` request directly with `curl` or Postman, bypassing the form entirely. Any check that only exists in the browser is decorative — it improves the experience for honest users but provides zero security against someone crafting a malicious request.

The server is **authoritative** — meaning it has the final say. If the client and server disagree, the server wins. A request that passes client validation but fails server validation is rejected. A request that skips client validation entirely still faces the full server gauntlet (honeypot, required fields, category allowlist, format checks, length limits, image URL filtering, rate limiting).

### The practical split

```text
Client (AddServiceForm)          Server (api/submit-service.js)
──────────────────────           ──────────────────────────────
Required fields      ✓           Honeypot check           ✓
Email format         ✓           Required fields          ✓
Phone format         ✓           Category allowlist       ✓
URL format           ✓           Email/phone/URL format   ✓
                                 Length limits             ✓
                                 Image URL allowlist       ✓
                                 Rate limiting             ✓
                                 Insert row                ✓
```

The client checks are a subset — enough to catch typos and missing fields. The server adds checks the client can't do (rate limiting requires a database query) and re-runs the format checks because it can't assume the client ran them.

This is a general web security principle: **validate on the client for UX, on the server for trust**. Never rely on client-side checks for security.

> **Related:** [technical-guide.md §6.2](technical-guide.md#62-submission) — the exact validation chain with all field names and rules. [§13](technical-guide.md#13-local-api-vs-production-api--divergence-important) — local dev middleware skips most of these checks.

---

## Honeypot fields

A **honeypot** is an anti-spam technique that exploits how bots fill out forms. The idea: add a form field that is invisible to human users but visible to automated scripts. A real user never sees it, so they never fill it in. A bot parsing the HTML finds an input field and fills it automatically. If the field has a value when the form is submitted, the server knows it's a bot.

### How the honeypot is implemented

The Add Service form includes a hidden input field:

```jsx
// AddServiceForm.jsx
<div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}
     aria-hidden="true">
  <input type="text" name="url_confirm" tabIndex={-1} autoComplete="off" />
</div>
```

The field is hidden from humans in three ways: positioned off-screen (`left: -9999px`), marked as `aria-hidden="true"` so screen readers skip it, and `tabIndex={-1}` so keyboard navigation skips it too. The `name="url_confirm"` is deliberately generic — bots are more likely to fill fields that sound like real form fields.

On the server, it's the very first check — before any validation or database work:

```js
// api/submit-service.js
if (honeypot) {
  return res.status(200).json({ success: true });
}
```

Notice it returns **200 (success)**, not 400 or 403. This is intentional — if the server rejected honeypot submissions with an error status, a bot could detect that its submissions are being blocked and adapt. By returning a fake success response, the bot thinks its spam went through and doesn't try a different approach.

### What honeypots don't catch

Honeypots stop unsophisticated bots — scripts that blindly fill every field in a form. They don't stop:

- **Targeted attacks** — a human looking at the form would notice the hidden field and skip it
- **Headless browsers** — a bot using a real browser engine (like Puppeteer) that renders the page and only interacts with visible elements
- **API-direct spam** — someone sending `POST` requests directly to `/api/submit-service` without the honeypot field at all (this is why the server has additional checks: rate limiting, category allowlist, format validation)

The honeypot is a low-cost first line of defense, not a complete solution. It sits at the top of the validation chain because it's the cheapest check — no database query, no regex, just "is this field empty?"

---

## Unsigned Cloudinary uploads

When a user submits the Add Service form, images upload directly from their browser to Cloudinary — they never pass through our server:

```text
Browser  →  POST api.cloudinary.com/v1_1/<cloud>/image/upload  →  returns secure_url
```

This is called an **unsigned upload** because it uses a preset configured in the Cloudinary dashboard rather than a signed API request. The preset controls allowed formats, max file size, and the destination folder.

The returned `secure_url` (e.g. `https://res.cloudinary.com/...`) is what gets stored in the `images` field of the `services` table.

### Signed deletion — the Cloudinary Admin API

Uploading is unsigned (no secret needed), but **deleting** an image requires the Cloudinary Admin API, which uses **HTTP Basic Auth** with the API key and secret:

```js
// api/_lib/cloudinary.js
const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?public_ids[]=...`, {
  method: 'DELETE',
  headers: { Authorization: `Basic ${credentials}` },
});
```

This is called a **signed** request because it proves the caller's identity using a secret. The `Basic` scheme works by encoding `apiKey:apiSecret` as a Base64 string and sending it in the `Authorization` header. Cloudinary checks the credentials against the account — if they don't match, the request is rejected.

Why the asymmetry? Cloudinary is designed so anyone can **add** images (the upload preset constrains what they can add), but only the account owner can **remove** them. This prevents a malicious actor from deleting other people's images if they discover the cloud name.

The API secret (`CLOUDINARY_API_SECRET`) is a server-side environment variable — same isolation pattern as the Supabase service key. It lives in `process.env` on Vercel, never in the browser bundle. Three things use it:

- `/api/delete-image` — called by the admin dashboard (with Bearer token auth) when removing a single image from a listing
- `/api/telegram-webhook` — deletes all images when the admin taps Delete on a submission notification
- `/api/cleanup-images` — the weekly cron that removes orphaned images not referenced by any listing

### Upload is unsigned, delete is signed — why this matters

```text
Upload:  Browser  →  Cloudinary (unsigned preset, no secret)     ← anyone can do this
Delete:  Server   →  Cloudinary (API key + secret, Basic auth)   ← only our server can do this
```

This split means abandoned uploads (when a user starts the form but never submits) create orphaned images that the browser can't clean up — it doesn't have the credentials to delete them. The cleanup cron exists specifically to solve this: it runs weekly, finds Cloudinary images not referenced by any `services` row, and deletes them server-side.

> **Related:** [technical-guide.md §6.5](technical-guide.md#65-cloudinary-images) — upload constraints (`MAX_IMAGES=5`, `MAX_FILE_SIZE=5MB`), display transforms, and public ID regex.

---

## The Telegram bot — two roles in one

The Telegram bot serves as both a notification channel and a lightweight admin interface:

**Notification:** When a listing is submitted, `/api/submit-service` sends a Telegram message with the listing details and two inline buttons: Approve and Delete.

**Action handler:** When the admin taps a button, Telegram sends a callback to `/api/telegram-webhook`. The webhook verifies a shared secret header, then performs the action (flip `approved=true` or delete the row + its Cloudinary images) and edits the original message to show the result.

The callback data format is `approve_<uuid>` or `delete_<uuid>` — parsed at the first underscore. Both sides must keep this format in sync.

This is intentionally redundant with the web admin dashboard. The Telegram flow lets the admin approve from their phone without logging into the site.

> **Related:** [technical-guide.md §6.4](technical-guide.md#64-telegram-approvedelete-bot) — callback flow, idempotency guards, and webhook registration.

---

## HTML escaping in Telegram messages

Telegram messages are sent with `parse_mode: 'HTML'`, which means Telegram interprets certain characters as HTML tags. The message template in [api/_lib/telegram.js](../api/_lib/telegram.js) uses `<b>` for bold text:

```js
`<b>${escapeHtml(row.title)}</b>`
```

The problem: user-submitted data can contain characters that have special meaning in HTML. If a business is named `Tom & Jerry's <Best> Burgers`, sending it raw would break the message — Telegram would try to parse `<Best>` as an HTML tag, `&` as the start of an entity, and the message would either render incorrectly or fail entirely.

### The four characters that must be escaped

```js
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')   // & → &amp;  (must be first)
    .replace(/</g, '&lt;')    // < → &lt;
    .replace(/>/g, '&gt;')    // > → &gt;
    .replace(/"/g, '&quot;'); // " → &quot;
}
```

Each replacement converts a dangerous character into its HTML **entity** — a safe text representation that renders as the original character but isn't interpreted as markup:

| Character | Entity | Why it's dangerous |
| --- | --- | --- |
| `&` | `&amp;` | Starts an HTML entity (`&amp;`, `&lt;`, etc.) — a bare `&` can corrupt the following text |
| `<` | `&lt;` | Opens an HTML tag — `<script>` in a business name would be interpreted as markup |
| `>` | `&gt;` | Closes an HTML tag |
| `"` | `&quot;` | Closes an attribute value — dangerous inside `href="..."` or similar |

The `&` replacement must come first. If you replaced `<` → `&lt;` first and then `&` → `&amp;`, the `&` in `&lt;` would be double-escaped to `&amp;lt;`, which renders as the literal text `&lt;` instead of `<`.

### This is the same concept as XSS prevention

In web apps, inserting user input into HTML without escaping is a **Cross-Site Scripting (XSS)** vulnerability — an attacker could inject `<script>alert('hacked')</script>` into a field and it would execute in other users' browsers. The fix is the same: escape `&<>"` before inserting into HTML.

Telegram doesn't execute JavaScript, so there's no XSS risk here, but the escaping prevents the message from breaking or rendering incorrectly. The principle is the same: never insert untrusted strings into a markup language without escaping the characters that markup language treats as special.

---

## HTTP headers

An HTTP header is a key-value pair sent alongside a request or response. Headers carry metadata — instructions about how to handle the content, who's allowed to see it, and how long to cache it. They're invisible to the end user but control how the browser and server behave.

This project uses headers in two different ways: **security headers** on every page, and **functional headers** in API calls.

### Security headers (vercel.json)

[vercel.json](../vercel.json) configures Vercel to attach five headers to every response. These are instructions from the server to the browser — the browser reads them and enforces the rules:

**Content-Security-Policy (CSP)** — the most important one. It tells the browser exactly which domains are allowed to load scripts, styles, images, fonts, and make network requests. Everything else is blocked.

```text
script-src 'self' 'unsafe-inline' https://www.googletagmanager.com
img-src    'self' data: blob: https://res.cloudinary.com
connect-src 'self' https://*.supabase.co https://api.cloudinary.com ...
frame-src  'none'
object-src 'none'
```

What this means in practice: if an attacker somehow injected a `<script src="https://evil.com/steal.js">` into the page, the browser would **refuse to load it** because `evil.com` isn't in the `script-src` list. Similarly, images can only come from Cloudinary and the app itself — no external tracking pixels. `frame-src: 'none'` means the site can't be embedded in an iframe on another domain (prevents clickjacking).

**X-Content-Type-Options: nosniff** — tells the browser to trust the `Content-Type` header and not try to guess ("sniff") what type a file is. Without this, a browser might interpret an uploaded file as HTML and execute scripts inside it.

**X-Frame-Options: DENY** — an older version of `frame-src: 'none'` (same effect, broader browser support). Prevents the site from being loaded inside an iframe.

**Referrer-Policy: strict-origin-when-cross-origin** — controls what information the browser sends in the `Referer` header when navigating away from the site. This setting sends the origin (`https://spilno.us`) but strips the path (`/admin/services`) for cross-origin requests, preventing URL-based information leaks.

**Permissions-Policy: camera=(), microphone=(), geolocation=()** — explicitly disables browser APIs the site doesn't use. Even if injected code tries to access the camera or microphone, the browser denies the request. The empty `()` means "no one is allowed, not even the site itself."

### Functional headers in API calls

Beyond security, headers carry operational information in this project:

**Cache-Control** (`api/services.js`) — tells Vercel's CDN how long to cache the response:

```text
Cache-Control: s-maxage=300, stale-while-revalidate=600
```

`s-maxage=300` means the CDN serves cached data for 5 minutes. `stale-while-revalidate=600` means after 5 minutes, it still serves the stale data immediately but fetches a fresh copy in the background — the next visitor gets the updated version. This is why the read proxy pattern works: these two headers turn a per-request database query into an edge-cached response.

**Authorization** (`api/delete-image.js`) — the admin dashboard sends the Supabase session token so the server can verify the caller is an admin:

```text
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

The `Bearer` prefix is a convention meaning "here's a token that proves who I am." The server extracts the token, passes it to Supabase's `getUser()`, and checks if the user exists and has the admin role.

**x-telegram-bot-api-secret-token** (`api/telegram-webhook.js`) — a custom header Telegram sends with every webhook callback. The server compares it to the stored `TELEGRAM_WEBHOOK_SECRET`. If it doesn't match, the request is rejected with 401. This prevents anyone from forging Telegram callbacks by hitting the webhook URL directly.

**Content-Type: application/json** — tells the receiver that the body is JSON. Without this, the server might try to parse the body as form data or plain text and fail.

---

## Part 4 — Deployment & Configuration

## vercel.json — what it does and why

[vercel.json](../vercel.json) is a configuration file that tells Vercel how to serve the deployed app. It's not application code — it never runs in the browser or in a serverless function. Vercel reads it at deploy time and configures its edge network accordingly. This project uses it for two things: security headers and SPA routing.

### The SPA rewrite rule

```json
"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
```

This is the line that makes client-side routing work in production. Without it, navigating directly to `https://spilno.us/add-service` would return a 404 — Vercel would look for a file called `add-service` on the server and not find one, because there is no such file. The app is a **Single Page Application** (SPA): there's only one HTML file (`index.html`), and React Router handles all route changes in the browser.

The rewrite rule says: "for any URL path, serve `index.html`." Vercel does this silently — the browser still sees `/add-service` in the address bar, but the server always returns the same HTML file. Once loaded, React Router reads the URL and renders the right page component.

This is different from a **redirect** (which would change the URL in the address bar to `/index.html`). A rewrite is invisible to the browser.

### Security headers

```json
"headers": [{
  "source": "/(.*)",
  "headers": [
    { "key": "Content-Security-Policy", "value": "default-src 'self'; ..." },
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
  ]
}]
```

The `"source": "/(.*)"` pattern means these headers are attached to **every response** — HTML pages, API responses, static assets, everything. Each header is an instruction to the browser about what it's allowed to do with the content. See the "HTTP headers" section above for what each one does.

### What's NOT in vercel.json

Some things you might expect here are configured elsewhere:

- **Cron schedules** — defined in `vercel.json` on the `development` branch (`"crons"` field), but not visible on this feature branch yet
- **Environment variables** — set in the Vercel dashboard, not in config files (they'd be committed to git, which is a security risk for secrets)
- **Build command** — Vercel auto-detects Vite and runs `npm run build`. You can override it in vercel.json, but the default works
- **Serverless functions** — any `.js` file in the `api/` directory is automatically deployed as a serverless function. No configuration needed

---

## Cron jobs

A **cron job** is a task that runs automatically on a schedule — no user action triggers it. The name comes from the Unix `cron` daemon, a process that wakes up every minute, checks a schedule table, and runs commands whose time has come.

### Cron expressions

The schedule is written as a **cron expression** — five fields separated by spaces:

```text
┌───────── minute (0–59)
│ ┌─────── hour (0–23)
│ │ ┌───── day of month (1–31)
│ │ │ ┌─── month (1–12)
│ │ │ │ ┌─ day of week (0–6, Sunday=0)
│ │ │ │ │
* * * * *
```

`*` means "every." Some examples:

| Expression | Meaning |
| --- | --- |
| `0 0 * * *` | Every day at midnight UTC |
| `0 3 * * 0` | Every Sunday at 3:00 AM UTC |
| `*/15 * * * *` | Every 15 minutes |
| `0 9 1 * *` | First day of every month at 9:00 AM UTC |

### How Vercel runs cron jobs

Traditional cron runs on a server that's always on. Vercel is serverless — there's no persistent server. Instead, Vercel's cron scheduler acts as the clock: at the scheduled time, it sends an HTTP `GET` request to the function's URL. The function runs as a normal serverless invocation and returns a response.

The schedule is declared by exporting a `config` object from the function file:

```js
// api/keep-alive.js
export default async function handler(req, res) {
  // ... do work ...
  res.status(200).json({ ok: true });
}

export const config = {
  schedule: '0 0 * * *'   // daily at midnight UTC
};
```

Vercel reads the `config.schedule` at deploy time and registers the cron. The function itself is identical to any other serverless function — it receives `req` and `res`, does its work, and returns. It doesn't know or care that it was triggered by a cron; it could also be called manually via `GET /api/keep-alive`.

### The two cron jobs in this project

**keep-alive** (`0 0 * * *` — daily midnight UTC) — runs `SELECT id FROM services LIMIT 1`. This trivial query exists because Supabase free-tier projects are paused after a week of inactivity. One query per day keeps the project awake.

Why daily and not weekly? Strictly speaking, one query inside any 7-day window is enough to prevent the pause. Daily is deliberately more frequent to leave a safety margin: if up to six consecutive runs fail to fire (a cron hiccup, a deploy gap, a Vercel incident), the project still gets pinged before the 7-day timer elapses. The query is trivial and the invocation cost is negligible, so there's no reason to run it less often — the margin is free insurance. Weekly would be too tight: a single missed run would let the project idle.

**cleanup-images** (`0 3 * * 0` — Sunday 3 AM UTC) — lists all images in Cloudinary, cross-references against the `services` table, and deletes any image not referenced by a listing and older than 48 hours. Sends a Telegram alert with the count or any errors. This cleans up orphaned uploads from abandoned form sessions.

### Why cron and not event-driven?

An alternative design would be to clean up images immediately when a form session is abandoned. But "abandoned" is hard to detect in a stateless system — the browser might close, the network might drop, or the user might just leave the tab open for hours. There's no reliable "session ended" event.

A cron that runs periodically and reconciles the actual state (what's in Cloudinary vs. what's in the database) is simpler and more reliable. The 48-hour grace period prevents deleting images from sessions that are still in progress.

> **Related:** [technical-guide.md §7](technical-guide.md#7-api-reference) — API reference table with all endpoints, methods, and schedules.

---

## Part 5 — The Frontend

## Lazy loading (code splitting)

When Vite builds the app, it bundles all the JavaScript into files that the browser downloads. By default, everything goes into one bundle — the homepage code, the form, the admin dashboard, all of it. Every visitor downloads the admin dashboard code even though only one person ever uses it.

**Lazy loading** splits the bundle so that some code is only downloaded when it's actually needed. In React, this is done with `React.lazy()` and `Suspense`:

```jsx
// App.jsx — static imports (always in the main bundle)
import { HomePage } from './pages/HomePage';
import { AddServicePage } from './pages/AddServicePage';

// dynamic imports (separate chunks, loaded on demand)
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage')
  .then((m) => ({ default: m.AdminLoginPage })));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout')
  .then((m) => ({ default: m.AdminLayout })));
```

The `import()` call tells Vite to put that module and its dependencies into a separate file (a "chunk"). The browser only downloads it when React tries to render the component for the first time — i.e., when someone navigates to `/admin`.

`Suspense` is the wrapper that tells React what to show while the chunk is loading:

```jsx
<Route path="/admin/login" element={<Suspense><AdminLoginPage /></Suspense>} />
```

Here `Suspense` has no `fallback` prop, so it renders nothing during the brief download. For larger chunks, you could pass `fallback={<LoadingSpinner />}`.

### What's lazy-loaded in this project

Only the **admin pages** — `AdminLoginPage`, `AdminLayout`, `AdminQueuePage`, and `AdminServicesPage`. Everything else (homepage, add service form, privacy/terms pages) is in the main bundle because public visitors are likely to see those pages.

### The `.then()` wrapper

The `lazy()` calls have a `.then((m) => ({ default: m.AdminLoginPage }))` that looks odd. This is because `React.lazy` expects the dynamic import to return a module with a `default` export, but this project uses **named exports** for components. The `.then()` adapter remaps the named export to `default` so `lazy()` can consume it.

> **Related:** [technical-guide.md §8](technical-guide.md#8-frontend) — full route table with components and notable behaviors.

---

## Hot Module Replacement (HMR)

During development, you run `npm run dev` which starts Vite's dev server. When you edit a file and save, the change appears in the browser almost instantly — without a full page reload. This is **Hot Module Replacement (HMR)**.

### How it works

Traditional development flow: edit file → rebuild entire app → refresh browser → lose all state (scroll position, form inputs, expanded menus).

HMR flow: edit file → Vite detects the change → sends just the updated module to the browser over a WebSocket → React swaps the component in place → state is preserved.

The key is that Vite doesn't rebundle the entire project on every save. It serves each module individually as a native ES module during development. When a file changes, Vite only needs to invalidate and re-serve that one file and its direct dependents — not the entire dependency tree.

### Why Vite's HMR is fast

Bundlers like Webpack also support HMR, but Vite is faster because of a fundamental architecture difference:

- **Webpack** bundles all modules into a few large files before serving. A change means re-bundling part of that output, which gets slower as the project grows.
- **Vite** skips bundling entirely during development. It serves source files as native ES modules (`import`/`export`) and lets the browser resolve them. A change means re-serving one file — the project size doesn't matter.

This is why the technical guide lists Vite as "Fast HMR" — it's the main developer experience advantage over older build tools.

### HMR is dev-only

In production (`npm run build`), Vite uses Rollup to create optimized, minified bundles — the same traditional approach as any bundler. HMR and the dev server don't exist in production. The distinction matters: if something works in dev but breaks in a production build (or vice versa), the different serving mechanisms are the first place to look.

---

## Design tokens and dark mode

### What a design token is

A design token is a named value (color, shadow, font) defined once and referenced everywhere. Instead of writing `#00205B` in 40 places, you define `--color-dark-blue: #00205B` once and use `text-dark-blue` in Tailwind classes. Change the definition — every usage updates.

### Where they're defined

[src/index.css](../src/index.css) defines all tokens inside an `@theme` block, which registers them with Tailwind CSS v4:

```css
@theme {
  --color-dark-blue: #00205B;
  --color-brand-blue: #0057B7;
  --color-brand-red: #E52459;
  --color-text: #091832;
  --color-gray: #EBEBEB;
  --color-light-gray: #F5F5F5;
  --color-stroke: rgba(0, 32, 91, 0.15);
  --shadow-card: 0 4px 44px rgba(0, 0, 0, 0.12);
}
```

The `@theme` block tells Tailwind to generate utility classes for these values. `--color-dark-blue` becomes `text-dark-blue`, `bg-dark-blue`, `border-dark-blue`, etc. `--shadow-card` becomes `shadow-card`. You never use the CSS custom properties directly — Tailwind classes are the only interface.

### How dark mode swaps token values

Below the `@theme` block, the same file redefines a subset of tokens under `html.dark`:

```css
html.dark {
  --color-dark-blue: #7BA8E8;
  --color-text: #E2E8F0;
  --color-gray: #1E3A5F;
  --color-light-gray: #0A1628;
  --color-stroke: rgba(255, 255, 255, 0.12);
  --shadow-card: 0 4px 44px rgba(0, 0, 0, 0.4);
}
```

This is the key trick: **the class names don't change, only the values behind them**. A component that uses `text-dark-blue` gets `#00205B` in light mode and `#7BA8E8` in dark mode — no conditional logic, no `dark:` prefix needed for these tokens.

Here's what happens step by step:

1. The user clicks the theme toggle in the header
2. `ThemeContext` adds or removes the `dark` class on the `<html>` element
3. CSS specificity kicks in — `html.dark { --color-dark-blue: #7BA8E8 }` overrides `@theme { --color-dark-blue: #00205B }` because `html.dark` is more specific
4. Every element using `text-dark-blue` instantly re-renders with the new value — CSS custom properties are live, no JavaScript re-render needed

### When you still need `dark:` prefixes

The token swap only works for colors that have a dark-mode override in `html.dark`. Notice that `--color-brand-blue` and `--color-brand-red` are not redefined — they stay the same in both themes.

For one-off dark mode adjustments (a different background on a specific card, a border that only appears in dark mode), you still use Tailwind's `dark:` variant:

```jsx
<div className="bg-white dark:bg-gray-800 border dark:border-gray-700">
```

The `dark:` prefix works because [src/index.css](../src/index.css) defines a custom variant `@custom-variant dark (&:where(.dark, .dark *))` — this tells Tailwind that `dark:` means "when the element is inside an `html.dark` parent." It's a CSS selector, not JavaScript.

> **Related:** [technical-guide.md §15](technical-guide.md#15-key-patterns) — the token naming convention and the full list of semantic color names.

---

## i18n without a library

The app supports English and Ukrainian without react-intl or similar libraries. Instead:

**Two JSON files** ([src/i18n/en.json](../src/i18n/en.json), [src/i18n/ua.json](../src/i18n/ua.json)) contain all UI strings as nested objects.

**LanguageContext** ([src/context/LanguageContext.jsx](../src/context/LanguageContext.jsx)) provides a `t()` function that takes a dot-path key and looks it up in the active language's JSON:

```jsx
const { t } = useLanguage();
t('hero.title')  // → "Find Ukrainian Services" or "Знайдіть українські послуги"
```

The active language is stored in `localStorage['lang']` and toggled via the header language selector.

Service descriptions have separate `description_en` and `description_ua` database columns. The API resolves which to return based on the `lang` query parameter, falling back to the other language if one is empty.

> **Related:** [technical-guide.md §6.6](technical-guide.md#66-frontend-filtering--i18n) — filtering logic (mutually exclusive search/category) and language persistence.
