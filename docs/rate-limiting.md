# Rate Limiting

## What's Already in Place

Email-based rate limiting in `api/submit-service.js`: before inserting, it counts
`services` rows where `email` matches (case-insensitive `ilike`) and `submitted_at`
is within the last 24h; if the count is `>= 3` it returns `429`.

**Know its limits — it is weak by design:**

- **Keyed on email, not IP.** Changing the email defeats it completely. It stops
  accidental duplicate submissions, not a determined bot.
- **Fails open.** The check is `if (!countError && count >= 3)`. If the count query
  errors, the submission proceeds with no limit.
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
| `POST /api/delete-image` | **Unauthenticated** — anyone with a Cloudinary `publicId` can delete images, and it's unthrottled (Cloudinary Admin API abuse / cost) | None |
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

1. **Authenticate `/api/delete-image`** — verify a Supabase admin JWT (or move
   deletion behind the Telegram webhook / RLS). This is the highest-value fix; a
   rate limit only slows the abuse, auth stops it.
2. **Constrain the Cloudinary upload preset** — set folder, allowed formats, max file
   size, and (ideally) signed uploads so direct uploads can't be abused for arbitrary
   storage.
3. **Add the Vercel Firewall** (option 0) for per-IP/path limiting + bot filtering
   across all `/api` routes — covers what the email limit cannot.
4. **Keep the email limit** as cheap defense-in-depth for casual duplicate submits,
   but don't treat it as real spam protection. Consider also failing *closed* on a
   count error.

If you only do one thing: **authenticate `/api/delete-image`**. The email limit
guards the least-exposed endpoint; the unauthenticated delete is the actual hole.
