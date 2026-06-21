# Rate Limiting

## What's Already in Place

Email-based rate limiting in `api/submit-service.js`: before inserting, it counts
`services` rows where `email` matches (case-insensitive `ilike`) and `submitted_at`
is within the last 24h; if the count is `>= 3` it returns `429`.

**Know its limits — it is weak by design:**

- **Keyed on email, not IP.** Changing the email defeats it completely. It stops
  accidental duplicate submissions, not a determined bot.
- ~~**Fails open.**~~ **Fixed — now fails closed.** If the count query errors, the
  submission is rejected with a 500 instead of proceeding.
- **Deleting a row frees the slot.** The limit counts live `services` rows, so an
  approved-then-deleted (or Telegram-deleted) submission no longer counts toward the 3.
- **Only counts persisted rows.** Honeypot-rejected and validation-failed requests
  never reach the insert, so they don't count (fine for the limit, but it means the
  limit only sees "successful" submissions).

## Exposed Surfaces (what actually needs protection)

The submit endpoint is the *least* exposed surface. These are unprotected today:

| Surface | Risk | Current protection |
| --- | --- | --- |
| `POST /api/submit-service` | Form spam | Email limit (weak, above) |
| `POST /api/delete-image` | ~~Unauthenticated~~ **Fixed — requires Supabase admin JWT.** Orphaned images cleaned up by weekly cron (`api/cleanup-images.js`). | Auth (Bearer token) |
| Direct Cloudinary upload | Form uploads go **straight to Cloudinary** via the unsigned preset — they never hit `/api`, so storage/cost can be abused without ever submitting | Cloudinary preset settings only |
| `GET /api/services` | Read scraping | Cached (`s-maxage=300`), low risk |
| `POST /api/telegram-webhook` | Forged callbacks | Secret-token header (adequate) |

Two gaps matter most: the **unauthenticated `/api/delete-image`** and **direct
Cloudinary uploads that bypass the backend entirely**. No request-rate limit fixes
those alone — see fixes below.

## Options (Free, Ranked by Effort)

### 0. Vercel Firewall / BotID — native, zero extra vendor

You are already on Vercel. The platform Firewall gives custom WAF rules, per-path
rate limiting, IP blocking, Attack Mode, and automatic DDoS mitigation; **BotID**
adds bot verification. This is the natural first choice — no new account, configured
in the Vercel dashboard or `vercel.json` / `vercel firewall` CLI.

Best for: per-IP/path rate limiting and bot filtering across *all* `/api` routes,
including `/api/delete-image`, without app code.

### 1. Cloudflare Free Tier — zero code

Point DNS through Cloudflare for DDoS protection, bot filtering, and rate-limiting
rules with no code changes. Overlaps heavily with the Vercel Firewall — pick one,
not both.

Best for: general protection if you prefer Cloudflare's tooling.

### 2. Upstash Redis + `@upstash/ratelimit` — minimal code

Upstash free tier: 10k requests/day. Best for IP-based limiting *inside* a specific
serverless function (e.g. add it to `/api/delete-image` and `/api/submit-service`).

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

## Recommendation

Rate limiting alone is not the whole answer — close the structural gaps too:

1. ~~**Authenticate `/api/delete-image`**~~ — **Done.** Requires a Supabase admin
   JWT via `Authorization: Bearer <token>` header. Client-side delete calls removed
   from the public form; orphaned Cloudinary images cleaned up by a weekly cron
   (`api/cleanup-images.js`, Sundays 3 AM UTC).
2. **Constrain the Cloudinary upload preset** — set folder, allowed formats, max file
   size, and (ideally) signed uploads so direct uploads can't be abused for arbitrary
   storage. *(Still open.)*
3. **Add the Vercel Firewall** (option 0) for per-IP/path limiting + bot filtering
   across all `/api` routes — covers what the email limit cannot. *(Still open —
   configure in Vercel Dashboard → Firewall → Custom Rules.)*
4. ~~**Keep the email limit / fail closed**~~ — **Done.** Email limit now fails
   closed: count query errors return 500 instead of allowing the submission through.
