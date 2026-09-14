# DB Pause — Recovery & Prevention Plan

## Implementation status (2026-09-13)

**Code changes made so far — `api/keep-alive.js`, `api/cleanup-images.js`, `vercel.json`,
`api/cleanup-images.test.js`:**

- ✅ `keep-alive.js` throws on supabase-js `{ error }` (a paused/unreachable DB used to slip past the catch).
- ✅ `keep-alive.js` sends `sendTelegramAlert(...)` on failure (Phase 3 / Layer 1).
- ✅ `keep-alive.js` pings `HEALTHCHECK_URL` on success — dead-man's-switch hook (Phase 5); no-op until the env var is set.
- ✅ Both crons registered in `vercel.json`; dead `config.schedule` exports removed (Phase 2).
- ✅ `CRON_SECRET` guard added to both `keep-alive.js` and `cleanup-images.js` (Phase 2 blocker).
- Tests: 147 passing. **Still not committed** — everything above is uncommitted working-tree
  changes on branch `sergey`.

**Not started:** `api/services.js` error logging (Phase 3), all doc fixes (Phase 4),
graceful degradation / backup / Pro decision (Phase 5), and every **dashboard** step (setting the
`CRON_SECRET` and `HEALTHCHECK_URL` env vars in Vercel, UptimeRobot, healthchecks account). Also
nothing has been committed, pushed, or merged toward `main` yet — the fix isn't live in production.

> ⚠️ Until `CRON_SECRET` is set in Vercel, the guard fails closed for *everyone*, including the
> real cron — so even after this ships, both crons will 401 until that env var exists (dashboard
> step, see below). And until this reaches `main`, `cleanup-images.js` stays live and unguarded on
> prod exactly as it is today.

---

## What YOU need to do (everything else is code I can do for you)

These require a dashboard login, a third-party account, or a decision — I can't do them. Roughly
in order:

1. **Restore Supabase** (now — unblocks the live site). Dashboard → resume the paused project →
   confirm `curl https://www.spilno.us/api/services` returns `200`.
2. ✅ **Production deploy branch confirmed: `main`.** (Live prod is `b622990`, Jun 22.) Note:
   `main` is currently **3 commits behind `dev`**, and my code changes sit on branch `sergey`. So
   the fix must be merged through to `main` to reach production — a PR into `main` (your existing
   flow, e.g. #89) will carry it. You just need to merge/approve that PR.
3. **Add env var `CRON_SECRET`** in Vercel. Generate with `openssl rand -hex 32` (run it yourself
   so the value stays out of any log). Name must be **exactly** `CRON_SECRET` — Vercel then
   auto-sends it as `Authorization: Bearer <value>` on cron calls. Placeholder is already in
   `.env.example`. Needed before the `cleanup-images` cron can safely go live.
4. **Create the healthchecks.io check** (Period 1d / Grace 1d) → copy its ping URL →
   **add env var `HEALTHCHECK_URL`** in Vercel → connect its **Telegram** integration.
5. **Create the UptimeRobot monitor** on `https://www.spilno.us/api/services` → add a **Telegram**
   alert contact.
6. **Confirm Supabase pause-warning emails** go to an inbox you actually read.
7. **Decide: stay on free + crons, or upgrade to Supabase Pro ($25/mo)** (never pauses). A
   judgment call only you can make.
8. **Review + approve the code changes, then merge through to prod.** Confirmed merge path:
   **`sergey` → `dev` → `main`** via PRs. ⚠️ When `dev` → `main` merges, the 3 currently-unreleased
   `dev` commits ship to prod alongside the fix — make sure those are ready. I stage the commits on
   `sergey`; you open/approve the PRs.

**What I'll do in code when you say go (no dashboard needed):** register both crons in
`vercel.json`, add the `CRON_SECRET` guard to `cleanup-images.js` (+ `keep-alive.js`), remove the
dead `config.schedule` exports, add real error logging to `api/services.js`, fix all the docs
(Phase 4), and implement graceful degradation in `useServices.js`. The keep-alive Telegram alert +
healthcheck ping are already written.

> Fastest unblock: do **step 1 alone** and the site comes back. Steps 2–8 are prevention so it
> doesn't recur.

---

## Problem

Production (`spilno.us`) shows **"Failed to load services."**

Root-cause chain:

1. Page calls `/api/services` → returns **HTTP 500** `{"error":"Failed to fetch services"}`.
2. The serverless function can't reach Supabase; the real error is swallowed by the catch in `api/services.js`.
3. The Supabase project (`scvinvmithmqcgiqlqkc.supabase.co`) is **paused** (free-tier auto-pause after ~7 days idle).
4. The keep-alive cron that was supposed to prevent this **never ran** — it's declared via `export const config = { schedule }` inside `api/keep-alive.js`, which Vercel **ignores**. Crons are registered only from a `"crons"` array in `vercel.json`, and **no branch** (`dev`, `main`, `origin/*`) has one.

### Collateral finding

`api/cleanup-images.js` (weekly orphan-image cleanup, `0 3 * * 0`) uses the **same broken
`config.schedule` pattern** — so it has **also never run**. Orphaned Cloudinary images from
abandoned upload sessions have been accumulating unchecked. Same fix applies.

### Security finding (⚠️ the fix activates a hole)

`api/cleanup-images.js` has **no auth check** — it's a public HTTP endpoint that **deletes
Cloudinary images**. Today it's harmless only because it's never invoked. **The moment Phase 2
registers it as a cron, the URL goes live**, and anyone hitting
`https://www.spilno.us/api/cleanup-images` can trigger a mass-deletion pass. Must be gated on
`CRON_SECRET` **in the same change** that enables the cron (see Phase 2).

### Docs are wrong

Multiple docs describe these crons as working and describe `config.schedule` as the registration
mechanism — both false. Must be corrected (see Phase 4):

- `CLAUDE.md` (lines ~66, ~144)
- `docs/concepts.md` (~868 claims crons live in `vercel.json` on a `development` branch — that
  branch doesn't exist; ~909-926 describe `config.schedule` as how Vercel registers crons)
- `docs/technical-guide.md` (~284, ~401, ~406)
- `docs/walkthrough.md` (~502, ~600)
- `docs/architecture/system-graph/{data.json,index.html}`

---

## Phase 1 — Restore service (unblock prod)

- [ ] Log into Supabase dashboard → confirm project is **Paused** (not deleted).
- [ ] Click **Restore** / **Resume**. Wait for status → Active (a few minutes).
- [ ] Verify DNS resolves again: `nslookup scvinvmithmqcgiqlqkc.supabase.co` (should no longer be NXDOMAIN).
- [ ] Hit the API directly: `curl -s https://www.spilno.us/api/services` → expect `200` + JSON array.
- [ ] Load `spilno.us` in a browser → services render, no error banner.
- [x] **Production deploy branch confirmed: `main`** (Vercel → Settings → Git; live prod =
      `b622990`, Jun 22). `main` is **3 commits behind `dev`**; the cron fix currently lives on
      `sergey` and must be merged through to `main` (PR into `main`, per the existing flow) to
      actually ship. Landing it only on `dev`/`sergey` would **silently never deploy** — the exact
      failure mode that caused this incident.

> If the project turns out to be **deleted** (not just paused): create a new project, run
> `supabase/schema.sql` + `supabase/admin-rls.sql`, restore data from backup, and update all
> four env vars (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `VITE_SUPABASE_URL`,
> `VITE_SUPABASE_ANON_KEY`) in Vercel **and** local `.env`.

---

## Phase 2 — Fix the cron (stop recurrence)

- [x] Add `crons` array to `vercel.json` for **both** crons.
- [x] Remove the dead `export const config = { schedule }` from `api/keep-alive.js`
      **and** `api/cleanup-images.js`.
- [x] 🔴 **BLOCKER — gate the destructive endpoint before enabling its cron.** Added the
      `CRON_SECRET` guard to both `cleanup-images.js` and `keep-alive.js`
      (``if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).end();``).
      Tests updated in `cleanup-images.test.js` (auth header on every call plus two new
      401 cases); 147 passing. **Note:** until `CRON_SECRET` is actually set in Vercel
      (step 3 below), `process.env.CRON_SECRET` is `undefined`, so the guard fails closed —
      every call including the real cron gets `401` — this is intentional (never silently
      open) but means step 3 is now required before either cron does anything useful.
- [ ] Commit + push → Vercel redeploys.
- [ ] Confirm registration: Vercel dashboard → **Settings → Cron Jobs** lists both paths.
- [ ] Manually trigger once: `curl -H "Authorization: Bearer $CRON_SECRET" https://www.spilno.us/api/keep-alive`
      → `{"ok":true}` (without the header → expect `401`, and that's now true immediately).

> ⚠️ **Already found live before this fix shipped:** `cleanup-images.js` had no auth guard and was
> reachable directly (not via cron) at `https://www.spilno.us/api/cleanup-images` — a plain GET,
> even one made just to check the status code, executes a real orphan-deletion pass. Confirmed by
> hitting it once during this session; it returned `200`. It only deletes images >48h old and
> unreferenced by any service row, and alerts Telegram on any deletion, so impact should be
> limited to true orphans — but this was a live hole on prod, worth checking Telegram history for.
> This guard fix needs to reach `main` to close it there.
>
> Hobby-plan caveats: free crons run **once per day max** and can fire ~1h off-schedule (daily
> keep-alive is within limits and sufficient — Supabase idle threshold ~7 days). Hobby also caps
> at **2 cron jobs total** — these two use the whole budget, so no room for a third without
> upgrading.

---

## Phase 3 — Observability (catch it next time)

- [ ] Surface the real error in `api/services.js` — log `error.message`/`error.code` (don't only
      return the generic string) so an outside `curl` / log shows the actual cause.
- [x] Make `keep-alive` **alert on failure**: reuse the existing Telegram wiring
      (`api/_lib/telegram.js`) to send a message when the ping throws, instead of silently
      returning 500. A cron that fails quietly is how we got here.
      **Done in `keep-alive.js`** (also fixed it to throw on supabase-js `{ error }`); only fires
      once the cron is registered (Phase 2) or on a manual `curl`.
- [ ] **Monitor the symptom, not just the cause** — add an external uptime check on
      `/api/services` (UptimeRobot / Better Stack, both free). It catches *every* cause of "site
      is down," not only keep-alive failures, and is independent of Vercel/Supabase.
- [ ] **Confirm Supabase's own pause-warning emails** go to an inbox someone actually reads
      (Supabase emails before pausing a free project).

> Note: a *failure* alert can't fire if the cron **never runs** (the original bug). Detecting
> "the job stopped firing" needs the dead-man's-switch in Phase 5, not a failure handler.

### Telegram alerting — what notifies you, and how

Goal: get a Telegram message when "something like this" breaks. Two layers, because no single
mechanism covers both failure modes:

| Failure mode | Example | Caught by | Status |
| --- | --- | --- | --- |
| **A — job runs, but errors** | DB query fails mid-run | `sendTelegramAlert` in the handler's catch | ✅ done in `keep-alive.js`; already in `cleanup-images.js` |
| **B — job never runs / site down** | cron unregistered, Supabase paused | **external** monitor that alerts on *silence* | ⬜ Phase 5 / below |

- [x] **Layer 1 (Mode A)** — `keep-alive.js` now calls `sendTelegramAlert(...)` on failure and
      correctly throws on `{ error }` (supabase-js doesn't throw on query errors). Fires only once
      the cron is registered (Phase 2) or on a manual `curl`.
- [ ] **Layer 2 (Mode B)** — set up the two external watchers below; both deliver to the **same
      Telegram chat**, so all alerts land in one place.

**UptimeRobot** (catches the user-facing symptom — DB paused, bad deploy, Vercel outage):

1. Create a free account → **Add New Monitor**.
2. Type **HTTP(s)** (or **Keyword**, matching `"businessName"` to assert real data, not just 200).
3. URL: `https://www.spilno.us/api/services`. Interval: 5 min.
4. **My Settings → Add Alert Contact → Telegram** → follow the bot-link flow → enable it on the monitor.

**healthchecks.io** (the *only* thing that catches "the cron silently stopped" — the original bug):

1. Create a free account → **Add Check**. Name it `spilno keep-alive`.
2. Set **Period = 1 day**, **Grace = 1 day** (matches the daily cron + slack for Hobby jitter).
3. Copy the check's ping URL (`https://hc-ping.com/<uuid>`).
4. In Vercel → project → **Settings → Environment Variables**, add `HEALTHCHECK_URL` = that URL
   (Production scope). Redeploy.
5. **Integrations → Telegram** on the check → connect the bot → assign to this check.
6. Verify: hit `https://www.spilno.us/api/keep-alive` once → the check flips to **up** in healthchecks.

> Code side is already wired: `keep-alive.js` pings `HEALTHCHECK_URL` on success (success-only —
> a failed run is already reported immediately by the Layer-1 Telegram alert, so pinging `/fail`
> too would double-notify). The ping is a no-op until `HEALTHCHECK_URL` is set, so it's safe to
> deploy before the check exists.
>
> Add `HEALTHCHECK_URL` to the env-var lists in `CLAUDE.md` / `docs/technical-guide.md` (Phase 4).

---

## Phase 4 — Fix the docs (they currently lie)

Reconcile every doc that describes the crons as working / describes `config.schedule` as the
registration mechanism. Correct mechanism: crons are registered from the `"crons"` array in
`vercel.json`; the function file is a plain handler with no schedule.

- [ ] `CLAUDE.md` — keep-alive line (~144): note schedule lives in `vercel.json`, not the function.
- [ ] `docs/concepts.md` — remove the "defined on the `development` branch" claim (~868, no such
      branch); rewrite the "How Vercel runs cron jobs" section (~902-920) so it shows the
      `vercel.json` `"crons"` array, not `config.schedule`.
- [ ] `docs/technical-guide.md` — fix ~401 ("via the `config.schedule` export") and the
      §7 API-reference / cross-ref lines (~284, ~406).
- [ ] `docs/walkthrough.md` — fix the cleanup-cron registration description (~502, ~600).
- [ ] `docs/architecture/system-graph/{data.json,index.html}` — details already say
      `Vercel Cron 0 0 * * *`; just confirm they don't reference `config.schedule`.
- [ ] (Optional) Add a short "Incident: DB paused 2026-06" note so the failure mode is recorded.

---

## Phase 5 — Resilience (stop this class of failure, not just this instance)

The root cause was *a silent background job nobody knew had stopped* + *a single point of failure
with no fallback*. These items address the class, not the instance.

- [ ] **Dead-man's-switch / heartbeat** — keep-alive pings an external monitor
      (healthchecks.io, free) on each successful run; if the ping doesn't arrive on schedule, **you**
      get alerted. This is the only thing that detects "the cron never fired" — a failure handler
      can't, because a job that doesn't run can't report failure.
      **Code wired** in `keep-alive.js` (pings `HEALTHCHECK_URL`); still need the healthchecks
      account, the `HEALTHCHECK_URL` env var, and the Telegram integration — see the setup steps
      under Phase 3 → *Telegram alerting*.
- [ ] **Graceful degradation** — `src/hooks/useServices.js` currently renders nothing on a fetch
      error. Cache last-known-good services (build-time JSON snapshot, or `localStorage`) so a
      transient Supabase blip doesn't blank the whole directory. Today Supabase is a single point
      of total failure for the product.
- [ ] **Back up the data** — the `services` table *is* the product, and a 90-day pause →
      **deletion** with no export loses everything. Add a cheap periodic export (`pg_dump` or a
      JSON dump committed to git). Free-tier backups are short-window and don't survive deletion.
- [ ] **Decide on Supabase Pro ($25/mo)** consciously — it never pauses, removing the entire
      cron-keepalive dependency. For a community production site, weigh this vs. the band-aid.
      A decision, not a default.

---

## Verification checklist (done = green)

- [ ] `curl https://www.spilno.us/api/services` → `200`
- [ ] Homepage renders service cards
- [ ] Vercel **Cron Jobs** shows `/api/keep-alive` **and** `/api/cleanup-images` scheduled
- [ ] `curl https://www.spilno.us/api/keep-alive` → `{"ok":true}`
- [ ] `curl https://www.spilno.us/api/cleanup-images` (no auth header) → `401`
- [ ] Production deploy branch confirmed; cron fix landed on it
- [ ] Telegram alert fires on a forced keep-alive failure (test once)
- [ ] Heartbeat monitor shows keep-alive checking in on schedule
- [ ] Frontend still renders services from cache with the API forced to fail
