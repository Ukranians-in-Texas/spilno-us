# Spilno.us — Walkthroughs

Narrative traces of features end-to-end. Use these to see how the layers connect in practice. Flows match the entries in [architecture/system-graph/data.json](architecture/system-graph/data.json). For pattern explanations, see [concepts.md](concepts.md). For implementation details and API tables, see [technical-guide.md](technical-guide.md).

---

## Browse listings — from page load to rendered cards

**Files touched:** `HomePage` → `useServices` → `fetchServices` → `GET /api/services` → `fetchApprovedServices` → Supabase → cached response → `ServiceList`

### 1. The page mounts (browser)

`HomePage` renders and calls the `useServices` hook, passing the current language:

```jsx
// pages/HomePage.jsx
const { services, loading, error, refetch } = useServices({ lang: language });
```

### 2. `useServices` — data fetching with cancellation (browser)

```js
// hooks/useServices.js
useEffect(() => {
  let cancelled = false;
  async function load() {
    const data = await fetchServices({ lang });
    if (!cancelled) setServices(data);
  }
  load();
  return () => { cancelled = true; };
}, [lang]);
```

The `cancelled` flag prevents a state update if the component unmounts or the language changes before the response arrives. This avoids React's "can't update an unmounted component" warning and ensures stale responses from a previous language don't overwrite fresh ones.

### 3. `fetchServices` — the network call (browser)

```js
// services/api.js
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const url = `${API_BASE}/services${params.toString() ? `?${params}` : ''}`;
const response = await fetch(url);
```

The browser calls `GET /api/services?lang=en` (or `lang=ua`). The `VITE_API_BASE_URL` override exists for `vite preview`, which has no local API server.

### 4. `api/services.js` — the serverless function (server)

```js
// api/services.js
const services = await fetchApprovedServices({ category, limit, lang });
res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
return res.status(200).json(services);
```

Two things happen: query the database, then set cache headers. `s-maxage=300` tells Vercel's CDN to serve this response for 5 minutes without hitting the function again. Most visitors get a cached response in milliseconds.

### 5. `fetchApprovedServices` — the Supabase query (server)

```js
// api/_lib/supabase.js
let query = supabase
  .from('services')
  .select('*')
  .eq('approved', true)
  .order('submitted_at', { ascending: false });
```

Uses the **service key** (bypasses RLS). The mapper adds a language-resolved `description` field — falls back to the other language if the requested one is empty.

### 6. Filtering and display (browser)

Back in `HomePage`, the returned `services` array feeds into `useMemo` hooks that split them into:

- **Highlighted** (up to 6) — featured services first (sorted by `featured_order`), then recent
- **Rest** — everything not in the highlighted set

Search and category filters are mutually exclusive — activating one clears the other.

### Browse — end to end

```text
Browser
  └─ HomePage mounts
       └─ useServices({ lang })
            └─ fetchServices({ lang })
                 └─ GET /api/services?lang=en
                      └─ fetchApprovedServices()   [api/_lib/supabase.js]
                           └─ SELECT * FROM services WHERE approved=true
                                ORDER BY submitted_at DESC
                                └─ Supabase (service key)
                      └─ Cache-Control: s-maxage=300, stale-while-revalidate=600
            └─ services[] → HomePage state
       └─ highlightedServices (up to 6, featured first)
       └─ restServices (remainder)
       └─ ServiceList → ServiceCard[] → rendered
```

> **Related:** [concepts.md — The read proxy pattern](concepts.md#the-read-proxy-pattern) — why public reads go through `/api` instead of hitting Supabase directly. [concepts.md — Serverless functions](concepts.md#serverless-functions) — how Vercel deploys `api/` files. [technical-guide.md §6.1](technical-guide.md#61-public-read-path) — the full call chain.

---

## Submit a listing — from form to Telegram notification

**Files touched:** `AddServiceForm` → `uploadToCloudinary` → Cloudinary → `POST /api/submit-service` → validation gauntlet → Supabase insert → `sendTelegramNotification` → Telegram

### 1. Image upload (browser → Cloudinary)

Before the form is submitted, each selected image uploads directly from the browser to Cloudinary. No server involved:

```js
// components/AddServiceForm/AddServiceForm.jsx
async function uploadToCloudinary(file, signal) {
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", uploadPreset);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body, signal },
  );
  const data = await res.json();
  return data.secure_url;
}
```

This is an **unsigned upload** — the preset (configured in the Cloudinary dashboard) controls allowed formats, file size, and folder. The returned `secure_url` is held in the form's state until submission. Images larger than 5 MB are rejected client-side before the upload starts.

### 2. Client-side validation (browser)

```js
// components/AddServiceForm/AddServiceForm.jsx
const allErrors = validate(formData);
if (Object.keys(allErrors).length > 0) {
  document.getElementById(firstKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
  return;
}
```

The `validate` function checks required fields, email/phone/URL format, and field lengths. On failure, the form scrolls to the first error. This is for UX only — the server re-validates everything.

### 3. The POST (browser → server)

```js
// components/AddServiceForm/AddServiceForm.jsx
const res = await fetch("/api/submit-service", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ...formData,
    imageUrls: images.filter((i) => i.status === "done").map((i) => i.cloudUrl),
  }),
});
```

Only images with `status === "done"` are included — uploads that were in-progress or failed are silently dropped.

### 4. The validation gauntlet (server)

`api/submit-service.js` runs nine checks in order. The first one that fails stops the request:

```js
// api/submit-service.js

// 1. Honeypot — bot trap
if (honeypot) {
  return res.status(200).json({ success: true }); // fake success to fool bots
}

// 2. Required fields
if (!category || !businessName?.trim() || !descriptionEn?.trim() || !descriptionUa?.trim() || !email?.trim()) {
  return res.status(400).json({ error: 'Missing required fields' });
}

// 3. Category allowlist — must be one of 105 known subcategories
if (!VALID_CATEGORIES.has(category)) {
  return res.status(400).json({ error: 'Invalid category' });
}

// 4–5. Format validation + length limits (email, phone, URLs)

// 6. Image URL allowlist — only Cloudinary URLs, max 5
const validImageUrls = Array.isArray(imageUrls)
  ? imageUrls.filter((u) => typeof u === 'string' && u.startsWith('https://res.cloudinary.com/'))
    .slice(0, 5)
  : [];
```

### 5. Rate limit — fail closed (server)

```js
// api/submit-service.js
const normalizedEmail = email.trim().toLowerCase();
const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const { count, error: countError } = await supabase
  .from('services')
  .select('*', { count: 'exact', head: true })
  .ilike('email', normalizedEmail)
  .gte('submitted_at', cutoff);

if (countError) {
  return res.status(500).json({ error: 'Unable to process submission. Please try again.' });
}
if (count >= 3) {
  return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
}
```

The key detail: if the count query errors, it returns **500**, not "let it through." This is **fail-closed** — an unknown state is treated as a rejection, not a pass.

### 6. Insert + Telegram notification (server)

```js
// api/submit-service.js
const { data: inserted, error } = await supabase
  .from('services')
  .insert(record)  // approved: false
  .select('id')
  .single();

await sendTelegramNotification(record, inserted?.id)
  .catch((err) => console.error('Telegram notification failed:', err));
```

The insert uses the service key (bypasses RLS). The Telegram notification includes inline Approve/Delete buttons. If Telegram fails, the error is logged but the submission still succeeds — the listing is in the database regardless.

### Submit — end to end

```text
Browser
  └─ AddServiceForm
       ├─ uploadToCloudinary(file)       [× N images]
       │    └─ POST api.cloudinary.com   (unsigned preset, returns secure_url)
       ├─ validate(formData)             [client — UX only]
       └─ POST /api/submit-service       [api/submit-service.js]
            ├─ Honeypot check            → 200 (fake success) if filled
            ├─ Required fields           → 400 if missing
            ├─ Category allowlist        → 400 if not in 105 subcategories
            ├─ Format validation         → 400 on bad email/phone/URL
            ├─ Length limits             → 400 if exceeded
            ├─ Image URL filter          → strips non-Cloudinary, caps at 5
            ├─ Rate limit                → 429 if ≥3 from this email in 24h
            │    └─ DB query error       → 500 (fail closed)
            ├─ INSERT services           (approved=false, service key)
            └─ sendTelegramNotification  (Approve/Delete buttons)
                 └─ failure is logged, not fatal
```

> **Related:** [concepts.md — Client vs. server validation](concepts.md#client-vs-server-validation--the-server-is-authoritative) — why validation runs in both places. [concepts.md — Honeypot fields](concepts.md#honeypot-fields) — the hidden field trick and its limitations. [concepts.md — Unsigned Cloudinary uploads](concepts.md#unsigned-cloudinary-uploads) — unsigned upload / signed delete asymmetry. [technical-guide.md §6.2](technical-guide.md#62-submission) — the exact validation chain. [§14](technical-guide.md#14-security-model) — rate limiting details and fail-closed behavior.

---

## Approve via Telegram — from button tap to approved listing

**Files touched:** Telegram → `POST /api/telegram-webhook` → secret check → `answerCallbackQuery` → Supabase update → `editMessageText`

### 1. The admin taps "Approve" (Telegram)

The notification message (sent during submission) has two inline buttons: Approve and Delete. Each carries callback data in the format `approve_<uuid>` or `delete_<uuid>`.

When the admin taps Approve, Telegram sends a POST to the webhook URL with a `callback_query` object containing the button's data and a secret header.

### 2. Secret verification (server)

```js
// api/telegram-webhook.js
const secret = req.headers['x-telegram-bot-api-secret-token'];
if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

This header was configured once when registering the webhook with Telegram's `setWebhook` API. Anyone hitting the URL without it gets 401.

### 3. Dismiss the loading spinner (server)

```js
// api/telegram-webhook.js
await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cbq.id });
```

Telegram shows a loading spinner when a user taps an inline button. `answerCallbackQuery` dismisses it. This must happen within 10 seconds or Telegram shows an error to the user. The handler calls it immediately, before doing any database work.

### 4. Parse and validate the callback data (server)

```js
// api/telegram-webhook.js
const data = cbq.data || '';
const sep = data.indexOf('_');
const action = sep > -1 ? data.slice(0, sep) : '';
const serviceId = sep > -1 ? data.slice(sep + 1) : '';

if (!UUID_REGEX.test(serviceId)) { /* edit message: "Invalid request" */ }
if (action !== 'approve' && action !== 'delete') { /* edit message: "Unknown action" */ }
```

The callback data `approve_<uuid>` is split at the first underscore. Both the action and UUID are validated before any database call.

### 5. Approve — idempotent (server)

```js
// api/telegram-webhook.js
if (row.approved) {
  await editMessage(token, chatId, messageId, messageBase, 'ℹ️ Already approved');
  return res.status(200).json({ ok: true });
}

const { error } = await supabase
  .from('services')
  .update({ approved: true })
  .eq('id', serviceId);

await editMessage(token, chatId, messageId, messageBase, '✅ Approved');
```

If the row is already approved (someone approved it from the dashboard), the handler doesn't error — it tells the admin it was already done. The Telegram message is edited in place: the original listing details stay, the buttons are removed, and a status line is appended.

### Approve — end to end

```text
Telegram
  └─ Admin taps "✅ Approve" on notification message
       └─ POST /api/telegram-webhook
            ├─ x-telegram-bot-api-secret-token  → 401 if missing/wrong
            ├─ answerCallbackQuery               → dismiss loading spinner (≤10s)
            ├─ parse "approve_<uuid>"            → validate UUID format
            ├─ SELECT * FROM services WHERE id = uuid
            │    └─ already approved?            → edit message: "Already approved"
            ├─ UPDATE services SET approved=true WHERE id = uuid
            └─ editMessageText                   → "✅ Approved", buttons removed
```

> **Related:** [concepts.md — The Telegram bot](concepts.md#the-telegram-bot--two-roles-in-one) — dual notification/action role. [concepts.md — HTML escaping](concepts.md#html-escaping-in-telegram-messages) — why `escapeHtml` exists. [concepts.md — HTTP headers](concepts.md#http-headers) — the `x-telegram-bot-api-secret-token` header. [technical-guide.md §6.4](technical-guide.md#64-telegram-approvedelete-bot) — idempotency guards and webhook registration.

---

## Delete via Telegram — row + Cloudinary images removed

**Files touched:** Telegram → `POST /api/telegram-webhook` → secret check → `deleteCloudinaryImages` → Supabase delete → `editMessageText`

### 1–4. Same as Approve

The secret check, `answerCallbackQuery`, and callback parsing are identical — the handler branches at step 5.

### 5. Delete — images first, then the row (server)

```js
// api/telegram-webhook.js
await deleteCloudinaryImages(row.images);

const { error: deleteError } = await supabase
  .from('services')
  .delete()
  .eq('id', serviceId);

await editMessage(token, chatId, messageId, messageBase, '🗑 Deleted');
```

Images are deleted first. `deleteCloudinaryImages` splits the CSV `images` field, extracts the public ID from each URL via regex, and calls the Cloudinary Admin API (signed with `apiKey:apiSecret`). Each deletion is independent — `Promise.allSettled` ensures one failure doesn't block the rest.

The database row is deleted after the images. If the row delete fails, the message shows the error, but the images are already gone. There's no transaction wrapping both — Cloudinary and Supabase are separate systems.

### Delete — end to end

```text
Telegram
  └─ Admin taps "❌ Delete" on notification message
       └─ POST /api/telegram-webhook
            ├─ (same: secret check, answerCallbackQuery, parse/validate)
            ├─ SELECT * FROM services WHERE id = uuid
            ├─ deleteCloudinaryImages(row.images)   [api/_lib/cloudinary.js]
            │    └─ for each URL: extract public_id, DELETE via Admin API (Basic auth)
            ├─ DELETE FROM services WHERE id = uuid
            └─ editMessageText → "🗑 Deleted", buttons removed
```

> **Related:** [concepts.md — Unsigned Cloudinary uploads](concepts.md#signed-deletion--the-cloudinary-admin-api) — signed deletion with Basic Auth. [technical-guide.md §6.5](technical-guide.md#65-cloudinary-images) — `deleteCloudinaryImages` CSV handling and `Promise.allSettled`.

---

## Admin dashboard — login, review queue, and delete with images

**Files touched:** `AdminLoginPage` → `supabase.auth.signInWithPassword` → `AdminLayout` (auth guard) → `AdminQueuePage` → Supabase direct + `/api/delete-image` → Cloudinary

### 1. Login (browser)

```js
// pages/admin/AdminLoginPage.jsx
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (!error) navigate('/admin', { replace: true });
```

This calls Supabase Auth directly from the browser using the **anon key**. Supabase verifies the credentials and returns a JWT with `app_metadata.role = 'admin'`. The `supabase-js` client stores this JWT and sends it with every subsequent request.

### 2. Auth guard (browser)

```js
// pages/admin/AdminLayout.jsx
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session) navigate('/admin/login', { replace: true });
  });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) navigate('/admin/login', { replace: true });
  });
  return () => subscription.unsubscribe();
}, [navigate]);
```

Two checks: `getSession()` on mount (handles a direct URL visit), and `onAuthStateChange` (handles sign-out while the dashboard is open). Both redirect to the login page if no session exists.

### 3. Review queue — direct Supabase reads (browser)

```js
// pages/admin/AdminQueuePage.jsx
const { data, error } = await supabase
  .from('services')
  .select('*')
  .eq('approved', false)
  .order('submitted_at', { ascending: false });
```

The admin dashboard talks to Supabase directly — no serverless function proxy. The anon key + the admin's JWT satisfy the RLS admin policy, which grants full access to all rows. No cache headers, no stale data — the admin always sees live state.

### 4. Approve (browser → Supabase)

```js
// pages/admin/AdminQueuePage.jsx
const { error } = await supabase
  .from('services')
  .update({ approved: true })
  .eq('id', id);
```

One line. RLS checks the JWT's `app_metadata.role = 'admin'` claim before allowing the write. The row becomes visible to public visitors through `/api/services` (after the cache expires).

### 5. Delete — images via API, row via Supabase (browser)

```js
// pages/admin/AdminQueuePage.jsx
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

// Delete images through the serverless function (needs Cloudinary secret)
await Promise.allSettled(
  urls.map((url) => {
    const publicId = getCloudinaryPublicId(url);
    return fetch('/api/delete-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ publicId }),
    });
  })
);

// Delete the row directly from Supabase (RLS allows it)
const { error } = await supabase.from('services').delete().eq('id', id);
```

The split: images go through `/api/delete-image` (because the Cloudinary API secret is server-side only), but the row is deleted directly via Supabase (because RLS allows it). The Bearer token in the image delete request is the Supabase session JWT — the serverless function extracts it, calls `supabase.auth.getUser(token)` to verify it's a real user, then proceeds with the Cloudinary deletion.

### Admin dashboard — end to end

```text
Browser
  └─ AdminLoginPage
       └─ supabase.auth.signInWithPassword()   → JWT with role=admin
  └─ AdminLayout (auth guard)
       └─ getSession() + onAuthStateChange     → redirect if no session
       └─ pending count query                  → badge in nav
  └─ AdminQueuePage
       ├─ SELECT * FROM services WHERE approved=false   [Supabase direct, anon key + JWT]
       ├─ Approve:
       │    └─ UPDATE services SET approved=true WHERE id=…   [Supabase direct]
       └─ Delete:
            ├─ POST /api/delete-image (× N images)   [Bearer token → Cloudinary Admin API]
            └─ DELETE FROM services WHERE id=…        [Supabase direct]
```

> **Related:** [concepts.md — JWT](concepts.md#jwt-json-web-token) — how the session token carries identity claims. [concepts.md — Row Level Security](concepts.md#row-level-security-rls) — why the admin dashboard can write directly to Supabase. [concepts.md — Service key vs. anon key](concepts.md#why-the-admin-dashboard-uses-the-anon-key-not-the-service-key) — why the dashboard uses the anon key. [technical-guide.md §6.3](technical-guide.md#63-authentication--authorization) — auth implementation and admin provisioning.

---

## Orphaned image cleanup — the weekly cron

**Files touched:** Vercel cron → `GET /api/cleanup-images` → Cloudinary (list resources) → Supabase (list referenced images) → Cloudinary (delete orphans) → Telegram (alert)

### 1. The trigger (Vercel)

```js
// api/cleanup-images.js
export const config = {
  schedule: '0 3 * * 0',  // Sunday 3 AM UTC
};
```

Vercel reads this at deploy time and sends a `GET` request to the function at the scheduled time. The function doesn't know or care that a cron triggered it.

### 2. List all Cloudinary images (server → Cloudinary)

```js
// api/cleanup-images.js
async function fetchAllCloudinaryResources() {
  const resources = [];
  let nextCursor = null;
  do {
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?max_results=500${nextCursor ? `&next_cursor=${nextCursor}` : ''}`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    const data = await response.json();
    resources.push(...(data.resources || []));
    nextCursor = data.next_cursor || null;
  } while (nextCursor);
  return resources;
}
```

Cloudinary paginates at 500 resources per page. The `do…while` loop follows the cursor until all images are fetched. This uses the signed Admin API (Basic auth with `apiKey:apiSecret`).

### 3. The 48-hour grace period (server)

```js
// api/cleanup-images.js
const cutoff = Date.now() - GRACE_PERIOD_MS;  // 48 hours ago
const candidates = resources.filter(
  (r) => new Date(r.created_at).getTime() < cutoff,
);
```

Images uploaded less than 48 hours ago are skipped. This protects in-progress form sessions — someone might be filling the form right now with images already uploaded to Cloudinary but not yet submitted.

### 4. Cross-reference against the database (server)

```js
// api/cleanup-images.js
const { data: services, error } = await supabase
  .from('services')
  .select('images')
  .not('images', 'is', null);

if (error || services === null) {
  await sendTelegramAlert('⚠️ Image cleanup failed — Supabase query error');
  return res.status(500).json({ error: 'Failed to query services' });
}

const referencedIds = new Set();
for (const svc of services) {
  for (const url of svc.images.split(',')) {
    const id = getPublicIdFromUrl(url.trim());
    if (id) referencedIds.add(id);
  }
}

const orphans = candidates.filter((r) => !referencedIds.has(r.public_id));
```

This is the **fail-closed** pattern: if the Supabase query fails, the cron aborts entirely rather than deleting every image (which would happen if it proceeded with an empty `referencedIds` set from a failed query). An empty set from a **successful** query is fine — it means no services have images.

### 5. Delete orphans and alert (server)

```js
// api/cleanup-images.js
const results = await Promise.allSettled(
  orphans.map((r) => deleteCloudinaryImageById(r.public_id)),
);

const failed = results.filter((r) => r.status === 'rejected').length;
const deleted = orphans.length - failed;

if (failed > 0) {
  await sendTelegramAlert(`⚠️ Image cleanup partial failure — Deleted ${deleted}, failed ${failed}.`);
} else if (deleted > 0) {
  await sendTelegramAlert(`🧹 Image cleanup — Deleted ${deleted} orphaned images.`);
}
```

`Promise.allSettled` ensures one failed deletion doesn't abort the rest. The Telegram alert reports the count on success, partial failure, or full failure.

### Cleanup — end to end

```text
Vercel cron (Sunday 3 AM UTC)
  └─ GET /api/cleanup-images
       ├─ fetchAllCloudinaryResources()       [paginated, Basic auth]
       ├─ filter by 48h grace period          → candidates
       ├─ SELECT images FROM services         [Supabase, service key]
       │    └─ query error?                   → abort + Telegram alert (fail closed)
       ├─ build referencedIds set             [split CSV, extract public_id]
       ├─ orphans = candidates NOT in referencedIds
       ├─ deleteCloudinaryImageById(× N)      [Promise.allSettled]
       └─ sendTelegramAlert                   → success count / partial failure / full failure
```

> **Related:** [concepts.md — Cron jobs](concepts.md#cron-jobs) — cron expressions, `config.schedule`, and why cron beats event-driven cleanup. [concepts.md — Unsigned Cloudinary uploads](concepts.md#upload-is-unsigned-delete-is-signed--why-this-matters) — why orphaned images exist in the first place. [technical-guide.md §7](technical-guide.md#7-api-reference) — API reference with schedule.
