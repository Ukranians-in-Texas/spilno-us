# Rate Limiting & Security

## What's in Place

### Email-based rate limiting (`api/submit-service.js`)

Before inserting, it counts `services` rows where `email` matches (case-insensitive
`ilike`) and `submitted_at` is within the last 24h; if the count is `>= 3` it
returns `429`. **Fails closed** — if the count query errors, the endpoint returns
`500` instead of allowing the submission through.

**Know its limits — it is weak by design:**

- **Keyed on email, not IP.** Changing the email defeats it completely. It stops
  accidental duplicate submissions, not a determined bot.
- **Deleting a row frees the slot.** The limit counts live `services` rows, so an
  approved-then-deleted (or Telegram-deleted) submission no longer counts toward the 3.
- **Only counts persisted rows.** Honeypot-rejected and validation-failed requests
  never reach the insert, so they don't count (fine for the limit, but it means the
  limit only sees "successful" submissions).

### Authenticated `/api/delete-image`

Requires a valid Supabase Bearer token (admin session). Returns `401` without one.
The public add-service form no longer calls this endpoint — orphaned images from
abandoned form sessions are cleaned up server-side instead (see below).

### Orphaned image cleanup cron (`api/cleanup-images.js`)

Weekly cron (Sunday 3 AM UTC) that deletes Cloudinary images not referenced by any
`services` row. Safety mechanisms:

- **48-hour grace period** — skips images uploaded less than 48h ago, protecting
  in-progress form sessions
- **Fail-closed** — aborts if the Supabase query errors or returns null data (never
  proceeds with an empty referenced set from a failed query; an empty array from a
  successful query is fine)
- **Telegram alerts** — sends notifications on success (with count), partial failure,
  or full failure

## Exposed Surfaces

| Surface | Risk | Current protection |
| --- | --- | --- |
| `POST /api/submit-service` | Form spam | Email limit (fail-closed) + honeypot + manual approval |
| `POST /api/delete-image` | Image deletion abuse | Supabase auth (Bearer token) |
| Direct Cloudinary upload | Storage/cost abuse via unsigned preset | Cloudinary preset settings only |
| `GET /api/services` | Read scraping | Cached (`s-maxage=300`), low risk |
| `POST /api/telegram-webhook` | Forged callbacks | Secret-token header (adequate) |

The remaining gap is **direct Cloudinary uploads** that bypass the backend entirely.

## Options for Additional Protection (Free, Ranked by Effort)

### 0. Vercel Firewall / BotID — native, zero extra vendor

The platform Firewall gives custom WAF rules, per-path rate limiting, IP blocking,
Attack Mode, and automatic DDoS mitigation; **BotID** adds bot verification. No new
account needed — configured in the Vercel dashboard or `vercel.json` / CLI.

Best for: per-IP/path rate limiting and bot filtering across *all* `/api` routes.

### 1. Cloudflare Free Tier — zero code

Point DNS through Cloudflare for DDoS protection, bot filtering, and rate-limiting
rules with no code changes. Overlaps heavily with the Vercel Firewall — pick one,
not both.

Best for: general protection if you prefer Cloudflare's tooling.

### 2. Upstash Redis + `@upstash/ratelimit` — minimal code

Upstash free tier: 10k requests/day. Best for IP-based limiting *inside* a specific
serverless function (e.g. `/api/submit-service`).

**Install:**

```bash
npm install @upstash/ratelimit @upstash/redis
```

**Add to `.env`:**

```env
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

**Usage in any `/api` function:**

```js
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 req/min per IP
});

const ip = req.headers["x-forwarded-for"] ?? "anonymous";
const { success } = await ratelimit.limit(ip);
if (!success) return res.status(429).json({ error: "Too many requests" });
```

Best for: per-IP limiting on specific endpoints when you want it in code.

### 3. In-memory — don't use

State is lost between invocations in serverless environments. Not viable.

## Remaining Recommendations

1. **Constrain the Cloudinary upload preset** — set folder, allowed formats, max
   file size, and (ideally) signed uploads so direct uploads can't be abused for
   arbitrary storage.
2. **Add the Vercel Firewall** (option 0) for per-IP/path limiting + bot filtering
   across all `/api` routes — covers what the email limit cannot.
