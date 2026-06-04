# Rate Limiting

## What's Already in Place

Email-based rate limiting in `api/submit-service.js`: max 3 submissions per email per 24 hours, checked against the Supabase `services` table.

## Options (Free, Ranked by Effort)

### 1. Cloudflare Free Tier — zero code

Point DNS through Cloudflare to get DDoS protection, bot filtering, and configurable rate limiting rules with no code changes.

Best for: general protection, DDoS mitigation, bot traffic.

### 2. Upstash Redis + `@upstash/ratelimit` — minimal code

Upstash free tier: 10k requests/day. Best for IP-based rate limiting inside Vercel serverless functions.

**Install:**
```bash
npm install @upstash/ratelimit @upstash/redis
```

**Add to `.env`:**
```
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

Best for: per-IP limiting on specific endpoints (e.g., `/api/submit-service`).

### 3. In-memory — don't use

State is lost between invocations in serverless environments. Not viable.

## Recommendation

- **Form spam covered** — existing email-based limit is sufficient for `/api/submit-service`.
- **Want general protection** — add Cloudflare (DNS change only).
- **Need per-IP limiting in code** — use Upstash.
