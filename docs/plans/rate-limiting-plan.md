# Rate Limiting Implementation Plan

## Context

The project had one DB-backed email rate limit on `/api/submit-service` (3 per email per 24h). Two structural gaps remained (documented in `docs/rate-limiting.md`):

1. `/api/delete-image` was unauthenticated — anyone with a Cloudinary `publicId` could delete images
2. No IP-based rate limiting on any endpoint

## What was done

### 1. Authenticate `/api/delete-image`

Requires a Supabase session token in the `Authorization: Bearer <token>` header. Returns 401 if missing or invalid.

| File                             | Change                              |
| -------------------------------- | ----------------------------------- |
| `api/delete-image.js`            | Added auth check before delete logic |
| `src/pages/admin/AdminQueuePage.jsx`    | Added `Authorization` header to fetch |
| `src/pages/admin/AdminServicesPage.jsx` | Same                                |

### 2. Remove client-side image cleanup from the public form

**File:** `src/components/AddServiceForm/AddServiceForm.jsx`

Removed all four `/api/delete-image` call sites:

- `deleteFromCloudinary()` helper — removed entirely
- `removeImage()` — removed the delete call; kept revoke preview URL + filter state
- `beforeunload` handler — removed `sendBeacon` delete loop; kept `abort()` calls
- Unmount cleanup — removed delete loop; kept `abort()` calls

Orphaned uploads are now handled by the cleanup cron (§3).

### 3. Orphaned-image cleanup cron

**New file:** `api/cleanup-images.js` — runs weekly (Sunday 3 AM UTC).

1. Fetches all Cloudinary uploads via Admin API, paginating with `next_cursor`
2. Skips images younger than 48 hours (grace period for in-progress submissions)
3. Queries all `images` values from the `services` table
4. Deletes any Cloudinary resource not referenced by a service row

**Safety:** Aborts with 500 if Supabase query errors or returns `null` data. An empty array (no services) is fine — old orphans still get cleaned up.

**Monitoring:** Sends Telegram alerts on success ("deleted N orphans"), partial failure, or full failure. No message when nothing to clean.

**Prerequisite:** Exported `getPublicIdFromUrl` from `api/_lib/cloudinary.js`.

### 4. Harden the email rate limit — fail closed

**File:** `api/submit-service.js`

Changed from fail-open to fail-closed: if the count query errors, returns 500 instead of allowing the submission through.

### 5. Telegram alerts

**File:** `api/_lib/telegram.js`

Added `sendTelegramAlert(message)` — a simple text-only alert function reused by the cleanup cron.

### 6. Vercel Firewall rate limits (manual — not yet configured)

Configure in Vercel Dashboard → Firewall → Custom Rules:

| Path                       | Limit  | Window |
| -------------------------- | ------ | ------ |
| `POST /api/submit-service` | 5 req  | 1 min  |
| `POST /api/delete-image`   | 10 req | 1 min  |
| `GET /api/services`        | 30 req | 1 min  |

Requires Pro plan.

## Tests

111 tests passing across 8 files. New/updated:

- `api/delete-image.test.js` — auth (401 cases), validation, Cloudinary errors, success
- `api/cleanup-images.test.js` — orphan deletion, grace period, pagination, safety aborts, Telegram alerts
- `api/submit-service.test.js` — added fail-closed test (count query error → 500)

## Out of scope

- Cloudinary upload preset hardening (separate task)
- Upstash Redis (overkill for current traffic)
