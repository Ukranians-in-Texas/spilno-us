# Telegram Approve/Deny Implementation Plan

> **Historical** — Completed. Telegram inline buttons are live. See [technical-guide.md](../../technical-guide.md) for current state.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ✅ Approve / ❌ Delete inline buttons to Telegram new-submission notifications, backed by a Vercel serverless webhook that performs the action directly in Supabase.

**Architecture:** Four tasks in dependency order — (1) extract Cloudinary deletion into a shared helper, (2) add `buildMessageText` + inline keyboard to the Telegram helper, (3) update the submit handler to capture the inserted row ID and pass it to the notification, (4) implement the new `telegram-webhook.js` handler. Each task produces tested, committed code.

**Tech Stack:** Node.js (Vercel serverless), Supabase JS client, Telegram Bot API, Cloudinary Resources API, Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-03-20-telegram-approve-deny-design.md`

---

## File Map

| Action | File | Responsibility |
| --- | --- | --- |
| Create | `api/_lib/cloudinary.js` | `deleteCloudinaryImageById(publicId)` and `deleteCloudinaryImages(imagesCsv)` |
| Create | `api/_lib/cloudinary.test.js` | Tests for both exports |
| Modify | `api/delete-image.js` | Use `deleteCloudinaryImageById` instead of inline fetch |
| Modify | `api/_lib/telegram.js` | Add `buildMessageText`, HTML escaping, inline keyboard to `sendTelegramNotification` |
| Create | `api/_lib/telegram.test.js` | Tests for `buildMessageText` and `sendTelegramNotification` |
| Modify | `api/submit-service.js` | `.insert(record).select('id').single()` → pass ID to notification |
| Modify | `api/submit-service.test.js` | Update insert mock for chained `.select().single()` |
| Modify | `vite.config.js` | Local dev middleware: same insert change |
| Create | `api/telegram-webhook.js` | POST handler for Telegram callback queries |
| Create | `api/telegram-webhook.test.js` | Full webhook handler tests |

---

## Task 1: Cloudinary Shared Helper

**Files:**

- Create: `api/_lib/cloudinary.js`
- Create: `api/_lib/cloudinary.test.js`
- Modify: `api/delete-image.js`

- [ ] **Step 1.1: Write failing tests for `deleteCloudinaryImages`**

Create `api/_lib/cloudinary.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
  process.env.CLOUDINARY_API_KEY = 'key';
  process.env.CLOUDINARY_API_SECRET = 'secret';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
});

import { deleteCloudinaryImages, deleteCloudinaryImageById } from './cloudinary.js';

describe('deleteCloudinaryImages', () => {
  it('is a no-op when imagesCsv is null', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await deleteCloudinaryImages(null);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is a no-op when imagesCsv is empty string', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await deleteCloudinaryImages('');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls Cloudinary delete for each valid URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await deleteCloudinaryImages(
      'https://res.cloudinary.com/testcloud/image/upload/v1/folder/img1.jpg,' +
      'https://res.cloudinary.com/testcloud/image/upload/folder/img2.png'
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('folder%2Fimg1');
    expect(fetchMock.mock.calls[1][0]).toContain('folder%2Fimg2');
  });

  it('skips non-Cloudinary URLs', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await deleteCloudinaryImages(
      'https://res.cloudinary.com/testcloud/image/upload/v1/img.jpg,' +
      'https://evil.com/img.jpg'
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('continues deleting remaining images when one fails', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await deleteCloudinaryImages(
      'https://res.cloudinary.com/testcloud/image/upload/v1/img1.jpg,' +
      'https://res.cloudinary.com/testcloud/image/upload/v1/img2.jpg'
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('deleteCloudinaryImageById', () => {
  it('calls the Cloudinary Resources API with correct publicId and auth', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    await deleteCloudinaryImageById('folder/my-image');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain('testcloud');
    expect(url).toContain(encodeURIComponent('folder/my-image'));
    expect(opts.method).toBe('DELETE');
    expect(opts.headers.Authorization).toMatch(/^Basic /);
  });

  it('throws when Cloudinary returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, text: async () => 'Not Found' }));
    await expect(deleteCloudinaryImageById('missing/img')).rejects.toThrow();
  });
});
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
npm test -- api/_lib/cloudinary.test.js
```

Expected: FAIL — `Cannot find module './_lib/cloudinary.js'`

- [ ] **Step 1.3: Create `api/_lib/cloudinary.js`**

```js
function getPublicIdFromUrl(url) {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^/.]+$/);
  return match ? match[1] : null;
}

export async function deleteCloudinaryImageById(publicId) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?public_ids[]=${encodeURIComponent(publicId)}`,
    { method: 'DELETE', headers: { Authorization: `Basic ${credentials}` } },
  );
  if (!response.ok) throw new Error(await response.text());
}

export async function deleteCloudinaryImages(imagesCsv) {
  if (!imagesCsv) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return;

  const urls = imagesCsv
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.startsWith('https://res.cloudinary.com/'));

  await Promise.allSettled(
    urls.map(async (url) => {
      const publicId = getPublicIdFromUrl(url);
      if (!publicId) return;
      try {
        await deleteCloudinaryImageById(publicId);
      } catch (err) {
        console.error('Cloudinary delete failed for', publicId, err);
      }
    }),
  );
}
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
npm test -- api/_lib/cloudinary.test.js
```

Expected: PASS — all 6 tests green.

- [ ] **Step 1.5: Update `api/delete-image.js` to use the shared helper**

Replace the entire file:

```js
import { deleteCloudinaryImageById } from './_lib/cloudinary.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { publicId } = req.body || {};
  if (!publicId || typeof publicId !== 'string') {
    return res.status(400).json({ error: 'Missing publicId' });
  }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    await deleteCloudinaryImageById(publicId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete image' });
  }
}
```

- [ ] **Step 1.6: Run all tests to confirm nothing broke**

```bash
npm test
```

Expected: All existing tests still pass.

- [ ] **Step 1.7: Commit**

```bash
git add api/_lib/cloudinary.js api/_lib/cloudinary.test.js api/delete-image.js
git commit -m "feat: extract Cloudinary deletion into shared helper"
```

---

## Task 2: Telegram Helper — `buildMessageText` + HTML Escaping + Inline Keyboard

**Files:**

- Modify: `api/_lib/telegram.js`
- Create: `api/_lib/telegram.test.js`

- [ ] **Step 2.1: Write failing tests**

Create `api/_lib/telegram.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildMessageText, sendTelegramNotification } from './telegram.js';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_CHAT_ID;
});

describe('buildMessageText', () => {
  const base = {
    title: 'Test Business',
    category: 'Manicure / Nail Services',
    phone: '+1 (512) 555-0001',
    email: 'test@example.com',
  };

  it('includes title, category, phone, email', () => {
    const text = buildMessageText(base);
    expect(text).toContain('<b>Test Business</b>');
    expect(text).toContain('Manicure / Nail Services');
    expect(text).toContain('+1 (512) 555-0001');
    expect(text).toContain('test@example.com');
  });

  it('omits address and website lines when not provided', () => {
    const text = buildMessageText(base);
    expect(text).not.toContain('📍');
    expect(text).not.toContain('🌐');
  });

  it('includes address and website when provided', () => {
    const text = buildMessageText({ ...base, address: '123 Main St', website: 'https://example.com' });
    expect(text).toContain('📍 123 Main St');
    expect(text).toContain('🌐 https://example.com');
  });

  it('HTML-escapes < > & " in user fields', () => {
    const text = buildMessageText({ ...base, title: '<script>alert("xss")</script>' });
    expect(text).toContain('&lt;script&gt;');
    expect(text).not.toContain('<script>');
  });

  it('produces identical output from record shape and Supabase row shape (same field names)', () => {
    // Supabase column names match the record fields used in the message
    const record = { title: 'Biz', category: 'Cat', phone: '123', email: 'a@b.com' };
    const row = { title: 'Biz', category: 'Cat', phone: '123', email: 'a@b.com', description_en: 'ignored', approved: false };
    expect(buildMessageText(record)).toBe(buildMessageText(row));
  });
});

describe('sendTelegramNotification', () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_CHAT_ID = '12345';
  });

  it('does nothing when env vars are missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await sendTelegramNotification({ title: 'T', category: 'C', phone: '1', email: 'e@e.com' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a message with parse_mode HTML', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await sendTelegramNotification({ title: 'T', category: 'C', phone: '1', email: 'e@e.com' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.parse_mode).toBe('HTML');
    expect(body.chat_id).toBe('12345');
  });

  it('includes inline_keyboard with approve and delete buttons when serviceId is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await sendTelegramNotification(
      { title: 'T', category: 'C', phone: '1', email: 'e@e.com' },
      'abc-uuid-123'
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const buttons = body.reply_markup.inline_keyboard[0];
    expect(buttons[0].callback_data).toBe('approve_abc-uuid-123');
    expect(buttons[1].callback_data).toBe('delete_abc-uuid-123');
  });

  it('does not include inline_keyboard when serviceId is omitted', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    await sendTelegramNotification({ title: 'T', category: 'C', phone: '1', email: 'e@e.com' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reply_markup).toBeUndefined();
  });
});
```

- [ ] **Step 2.2: Run tests to confirm they fail**

```bash
npm test -- api/_lib/telegram.test.js
```

Expected: FAIL — `buildMessageText is not a function` (not yet exported)

- [ ] **Step 2.3: Update `api/_lib/telegram.js`**

Replace the entire file:

```js
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildMessageText(row) {
  return [
    '📋 <b>New service submission</b>',
    '',
    `<b>${escapeHtml(row.title)}</b>`,
    `📂 ${escapeHtml(row.category)}`,
    `📞 ${escapeHtml(row.phone)}`,
    `✉️ ${escapeHtml(row.email)}`,
    row.address ? `📍 ${escapeHtml(row.address)}` : null,
    row.website ? `🌐 ${escapeHtml(row.website)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function sendTelegramNotification(record, serviceId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text = buildMessageText(record);
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };

  if (serviceId) {
    body.reply_markup = {
      inline_keyboard: [[
        { text: '✅ Approve', callback_data: `approve_${serviceId}` },
        { text: '❌ Delete', callback_data: `delete_${serviceId}` },
      ]],
    };
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 2.4: Run tests to confirm they pass**

```bash
npm test -- api/_lib/telegram.test.js
```

Expected: PASS — all tests green.

- [ ] **Step 2.5: Run all tests to confirm nothing broke**

```bash
npm test
```

Expected: All existing tests still pass. (Note: `submit-service.test.js` mocks the entire `telegram.js` module, so the `sendTelegramNotification` signature change is transparent to it.)

- [ ] **Step 2.6: Commit**

```bash
git add api/_lib/telegram.js api/_lib/telegram.test.js
git commit -m "feat: add buildMessageText, HTML escaping, and inline keyboard to Telegram helper"
```

---

## Task 3: Submit Service — Capture Inserted ID

**Files:**

- Modify: `api/submit-service.js`
- Modify: `api/submit-service.test.js`
- Modify: `vite.config.js`

- [ ] **Step 3.1: Update the Supabase mock in `submit-service.test.js` and add an ID-passing test**

In `api/submit-service.test.js`, find the `mockSupabase` helper and replace `insert`:

```js
// Old:
insert: vi.fn().mockResolvedValue({ error: insertError }),

// New — chain supports .select('id').single():
insert: vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: insertError ? null : { id: 'test-uuid-123' },
      error: insertError ?? null,
    }),
  }),
}),
```

Also add this import at the top of the file (after the existing `vi.mock` lines):

```js
import { sendTelegramNotification } from './_lib/telegram.js';
```

And add this test inside the `'success and error paths'` describe block:

```js
it('passes the inserted row id to sendTelegramNotification', async () => {
  mockSupabase();
  const res = makeRes();
  await handler(makeReq(), res);
  expect(sendTelegramNotification).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Test Business' }),
    'test-uuid-123'
  );
});
```

- [ ] **Step 3.2: Run tests to confirm the new test fails (others pass)**

```bash
npm test -- api/submit-service.test.js
```

Expected: Most tests pass; the new `passes the inserted row id` test FAILS because `submit-service.js` still uses the old insert call.

- [ ] **Step 3.3: Update `api/submit-service.js`**

Find this block (lines 113–118):

```js
const { error } = await supabase.from('services').insert(record);
if (error) throw error;

await sendTelegramNotification(record)
  .then(() => console.log('Telegram notification sent'))
  .catch((err) => console.error('Telegram notification failed:', err));
```

Replace with:

```js
const { data: inserted, error } = await supabase
  .from('services')
  .insert(record)
  .select('id')
  .single();
if (error) throw error;

await sendTelegramNotification(record, inserted?.id)
  .then(() => console.log('Telegram notification sent'))
  .catch((err) => console.error('Telegram notification failed:', err));
```

- [ ] **Step 3.4: Run tests to confirm all pass**

```bash
npm test -- api/submit-service.test.js
```

Expected: PASS — all tests including the new one.

- [ ] **Step 3.5: Update local dev middleware in `vite.config.js`**

Find this block in `vite.config.js` (inside the `/api/submit-service` middleware):

```js
const { error: sbError } = await supabase.from('services').insert(record)
if (sbError) throw sbError

await sendTelegramNotification(record)
```

Replace with:

```js
const { data: inserted, error: sbError } = await supabase
  .from('services')
  .insert(record)
  .select('id')
  .single()
if (sbError) throw sbError

await sendTelegramNotification(record, inserted?.id)
```

- [ ] **Step 3.6: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 3.7: Commit**

```bash
git add api/submit-service.js api/submit-service.test.js vite.config.js
git commit -m "feat: pass inserted service ID to Telegram notification"
```

---

## Task 4: Telegram Webhook Handler

**Files:**

- Create: `api/telegram-webhook.js`
- Create: `api/telegram-webhook.test.js`

- [ ] **Step 4.1: Write failing tests**

Create `api/telegram-webhook.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./_lib/supabase.js', () => ({ getSupabaseAdmin: vi.fn() }));
vi.mock('./_lib/cloudinary.js', () => ({ deleteCloudinaryImages: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./_lib/telegram.js', () => ({
  buildMessageText: vi.fn().mockReturnValue('📋 <b>Test Business</b>'),
}));

import handler from './telegram-webhook.js';
import { getSupabaseAdmin } from './_lib/supabase.js';
import { deleteCloudinaryImages } from './_lib/cloudinary.js';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const WEBHOOK_SECRET = 'test-webhook-secret-32chars-long!!';

function makeReq({ secret = WEBHOOK_SECRET, body = {}, method = 'POST' } = {}) {
  return {
    method,
    headers: { 'x-telegram-bot-api-secret-token': secret },
    body,
  };
}

function makeRes() {
  const res = { _status: 200, _body: null };
  res.status = (code) => { res._status = code; return res; };
  res.json = (body) => { res._body = body; return res; };
  return res;
}

function makeCbq({ data = `approve_${VALID_UUID}`, chatId = 42, messageId = 7 } = {}) {
  return {
    callback_query: {
      id: 'cq-id-1',
      data,
      message: { chat: { id: chatId }, message_id: messageId, text: 'original' },
    },
  };
}

function mockSupabase({ row = null, fetchError = null, updateError = null, deleteError = null } = {}) {
  const single = vi.fn().mockResolvedValue({ data: row, error: fetchError });
  const updateEq = vi.fn().mockResolvedValue({ error: updateError });
  const deleteEq = vi.fn().mockResolvedValue({ error: deleteError });

  const fromMock = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }),
    update: vi.fn().mockReturnValue({ eq: updateEq }),
    delete: vi.fn().mockReturnValue({ eq: deleteEq }),
  });
  getSupabaseAdmin.mockReturnValue({ from: fromMock });
  return { single, updateEq, deleteEq };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.TELEGRAM_BOT_TOKEN = 'bot-token';
  process.env.TELEGRAM_WEBHOOK_SECRET = WEBHOOK_SECRET;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;
});

// --- auth ---

describe('authentication', () => {
  it('returns 401 when secret header is missing', async () => {
    const res = makeRes();
    await handler(makeReq({ secret: undefined }), res);
    expect(res._status).toBe(401);
  });

  it('returns 401 when secret header is wrong', async () => {
    const res = makeRes();
    await handler(makeReq({ secret: 'wrong-secret' }), res);
    expect(res._status).toBe(401);
  });

  it('returns 200 for a valid request', async () => {
    mockSupabase({ row: { id: VALID_UUID, approved: false, images: null, title: 'T', category: 'C', phone: '1', email: 'e@e.com' } });
    const res = makeRes();
    await handler(makeReq({ body: makeCbq() }), res);
    expect(res._status).toBe(200);
  });
});

// --- non-button updates ---

describe('non-button updates', () => {
  it('returns 200 with no Supabase calls when callback_query is absent', async () => {
    const res = makeRes();
    await handler(makeReq({ body: { message: { text: 'hello' } } }), res);
    expect(res._status).toBe(200);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });
});

// --- answerCallbackQuery timing ---

describe('answerCallbackQuery timing', () => {
  it('calls answerCallbackQuery before any Supabase operation', async () => {
    const calls = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      calls.push(url.includes('answerCallbackQuery') ? 'answer' : 'other');
      return Promise.resolve({ ok: true });
    }));
    mockSupabase({ row: { id: VALID_UUID, approved: false, images: null, title: 'T', category: 'C', phone: '1', email: 'e@e.com' } });

    const res = makeRes();
    await handler(makeReq({ body: makeCbq() }), res);

    expect(calls[0]).toBe('answer');
  });
});

// --- callback_data validation ---

describe('callback_data validation', () => {
  it('returns 200 and edits message for invalid UUID', async () => {
    const res = makeRes();
    await handler(makeReq({ body: makeCbq({ data: 'approve_not-a-uuid' }) }), res);
    expect(res._status).toBe(200);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
    const editCall = JSON.parse(global.fetch.mock.calls.find(([url]) => url.includes('editMessageText'))[1].body);
    expect(editCall.text).toContain('⚠️ Invalid request');
  });

  it('returns 200 and edits message for unknown action', async () => {
    const res = makeRes();
    await handler(makeReq({ body: makeCbq({ data: `unknown_${VALID_UUID}` }) }), res);
    expect(res._status).toBe(200);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });
});

// --- approve path ---

describe('approve path', () => {
  it('fetches the row, updates approved=true, edits message with ✅ Approved', async () => {
    mockSupabase({ row: { id: VALID_UUID, approved: false, images: null, title: 'T', category: 'C', phone: '1', email: 'e@e.com' } });
    const res = makeRes();
    await handler(makeReq({ body: makeCbq({ data: `approve_${VALID_UUID}` }) }), res);

    expect(res._status).toBe(200);
    const editCall = JSON.parse(global.fetch.mock.calls.find(([url]) => url.includes('editMessageText'))[1].body);
    expect(editCall.text).toContain('✅ Approved');
    expect(editCall.parse_mode).toBe('HTML');
    expect(editCall.reply_markup).toEqual({ inline_keyboard: [] });
  });

  it('shows ℹ️ Already approved when row.approved is true', async () => {
    mockSupabase({ row: { id: VALID_UUID, approved: true, images: null, title: 'T', category: 'C', phone: '1', email: 'e@e.com' } });
    const res = makeRes();
    await handler(makeReq({ body: makeCbq({ data: `approve_${VALID_UUID}` }) }), res);

    const editCall = JSON.parse(global.fetch.mock.calls.find(([url]) => url.includes('editMessageText'))[1].body);
    expect(editCall.text).toContain('ℹ️ Already approved');
  });

  it('shows ⚠️ Not found when row is missing (PGRST116)', async () => {
    mockSupabase({ fetchError: { code: 'PGRST116', message: 'No rows' } });
    const res = makeRes();
    await handler(makeReq({ body: makeCbq({ data: `approve_${VALID_UUID}` }) }), res);

    const editCall = JSON.parse(global.fetch.mock.calls.find(([url]) => url.includes('editMessageText'))[1].body);
    expect(editCall.text).toContain('⚠️ Not found');
  });

  it('shows ⚠️ Error on other DB fetch errors', async () => {
    mockSupabase({ fetchError: { code: '500', message: 'connection refused' } });
    const res = makeRes();
    await handler(makeReq({ body: makeCbq({ data: `approve_${VALID_UUID}` }) }), res);

    const editCall = JSON.parse(global.fetch.mock.calls.find(([url]) => url.includes('editMessageText'))[1].body);
    expect(editCall.text).toContain('⚠️ Error');
  });

  it('shows ⚠️ Error when Supabase update fails', async () => {
    mockSupabase({
      row: { id: VALID_UUID, approved: false, images: null, title: 'T', category: 'C', phone: '1', email: 'e@e.com' },
      updateError: { message: 'update failed' },
    });
    const res = makeRes();
    await handler(makeReq({ body: makeCbq({ data: `approve_${VALID_UUID}` }) }), res);

    const editCall = JSON.parse(global.fetch.mock.calls.find(([url]) => url.includes('editMessageText'))[1].body);
    expect(editCall.text).toContain('⚠️ Error');
  });
});

// --- delete path ---

describe('delete path', () => {
  it('calls deleteCloudinaryImages, deletes from DB, edits message with 🗑 Deleted', async () => {
    const { deleteEq } = mockSupabase({ row: { id: VALID_UUID, approved: false, images: 'https://res.cloudinary.com/demo/image/upload/v1/img.jpg', title: 'T', category: 'C', phone: '1', email: 'e@e.com' } });
    const res = makeRes();
    await handler(makeReq({ body: makeCbq({ data: `delete_${VALID_UUID}` }) }), res);

    expect(deleteCloudinaryImages).toHaveBeenCalledWith('https://res.cloudinary.com/demo/image/upload/v1/img.jpg');
    expect(deleteEq).toHaveBeenCalledWith('id', VALID_UUID);
    expect(res._status).toBe(200);
    const editCall = JSON.parse(global.fetch.mock.calls.find(([url]) => url.includes('editMessageText'))[1].body);
    expect(editCall.text).toContain('🗑 Deleted');
  });

  it('shows ⚠️ Not found when row is missing (PGRST116)', async () => {
    mockSupabase({ fetchError: { code: 'PGRST116', message: 'No rows' } });
    const res = makeRes();
    await handler(makeReq({ body: makeCbq({ data: `delete_${VALID_UUID}` }) }), res);

    const editCall = JSON.parse(global.fetch.mock.calls.find(([url]) => url.includes('editMessageText'))[1].body);
    expect(editCall.text).toContain('⚠️ Not found');
  });
});

// --- editMessageText format ---

describe('editMessageText format', () => {
  it('always uses parse_mode HTML and clears inline_keyboard', async () => {
    mockSupabase({ row: { id: VALID_UUID, approved: false, images: null, title: 'T', category: 'C', phone: '1', email: 'e@e.com' } });
    const res = makeRes();
    await handler(makeReq({ body: makeCbq() }), res);

    const editCall = JSON.parse(global.fetch.mock.calls.find(([url]) => url.includes('editMessageText'))[1].body);
    expect(editCall.parse_mode).toBe('HTML');
    expect(editCall.reply_markup).toEqual({ inline_keyboard: [] });
  });
});
```

- [ ] **Step 4.2: Run tests to confirm they fail**

```bash
npm test -- api/telegram-webhook.test.js
```

Expected: FAIL — `Cannot find module './telegram-webhook.js'`

- [ ] **Step 4.3: Create `api/telegram-webhook.js`**

```js
import { getSupabaseAdmin } from './_lib/supabase.js';
import { buildMessageText } from './_lib/telegram.js';
import { deleteCloudinaryImages } from './_lib/cloudinary.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function callTelegram(token, method, body) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error(`Telegram ${method} failed:`, err);
  }
}

async function editMessage(token, chatId, messageId, baseText, statusLine) {
  await callTelegram(token, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: `${baseText}\n\n${statusLine}`,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: [] },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (!secret || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const cbq = req.body?.callback_query;
  if (!cbq) return res.status(200).json({ ok: true });

  // Dismiss Telegram's loading spinner immediately — must happen within 10 seconds.
  // Errors are intentionally swallowed; the handler continues regardless.
  await callTelegram(token, 'answerCallbackQuery', { callback_query_id: cbq.id });

  const chatId = cbq.message?.chat?.id;
  const messageId = cbq.message?.message_id;

  const data = cbq.data || '';
  const sep = data.indexOf('_');
  const action = sep > -1 ? data.slice(0, sep) : '';
  const serviceId = sep > -1 ? data.slice(sep + 1) : '';

  if (!UUID_REGEX.test(serviceId)) {
    await editMessage(token, chatId, messageId, '', '⚠️ Invalid request');
    return res.status(200).json({ ok: true });
  }

  if (action !== 'approve' && action !== 'delete') {
    await editMessage(token, chatId, messageId, '', '⚠️ Unknown action');
    return res.status(200).json({ ok: true });
  }

  const supabase = getSupabaseAdmin();
  const { data: row, error: fetchError } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single();

  if (fetchError) {
    const statusLine = fetchError.code === 'PGRST116'
      ? '⚠️ Not found'
      : `⚠️ Error: ${fetchError.message}`;
    await editMessage(token, chatId, messageId, '', statusLine);
    return res.status(200).json({ ok: true });
  }

  const messageBase = buildMessageText(row);

  if (action === 'approve') {
    if (row.approved) {
      await editMessage(token, chatId, messageId, messageBase, 'ℹ️ Already approved');
      return res.status(200).json({ ok: true });
    }
    const { error } = await supabase
      .from('services')
      .update({ approved: true })
      .eq('id', serviceId);
    if (error) {
      await editMessage(token, chatId, messageId, messageBase, `⚠️ Error: ${error.message}`);
      return res.status(200).json({ ok: true });
    }
    await editMessage(token, chatId, messageId, messageBase, '✅ Approved');
    return res.status(200).json({ ok: true });
  }

  // delete path
  await deleteCloudinaryImages(row.images);
  const { error: deleteError } = await supabase.from('services').delete().eq('id', serviceId);
  if (deleteError) {
    await editMessage(token, chatId, messageId, messageBase, `⚠️ Error: ${deleteError.message}`);
    return res.status(200).json({ ok: true });
  }
  await editMessage(token, chatId, messageId, messageBase, '🗑 Deleted');
  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 4.4: Run tests to confirm they pass**

```bash
npm test -- api/telegram-webhook.test.js
```

Expected: PASS — all tests green.

- [ ] **Step 4.5: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4.6: Commit**

```bash
git add api/telegram-webhook.js api/telegram-webhook.test.js
git commit -m "feat: add Telegram webhook handler for approve/deny actions"
```

---

## Task 5: Final Commit and Setup Instructions

- [ ] **Step 5.1: Run the full test suite one last time**

```bash
npm test
```

Expected: All tests pass with no warnings.

- [ ] **Step 5.2: Final commit (if any files remain unstaged)**

All files should already be committed by their respective task commits. If anything remains unstaged, add explicitly:

```bash
git status  # confirm nothing unexpected
git commit --allow-empty -m "feat: Telegram approve/deny via inline keyboard and webhook" || true
```

- [ ] **Step 5.3: Deploy and register the webhook**

1. Push to your deployment branch and wait for Vercel to deploy
2. Add `TELEGRAM_WEBHOOK_SECRET` to Vercel environment variables (Settings → Environment Variables) — use a 32+ character random string, e.g.:

   ```bash
   openssl rand -hex 24
   ```

3. Register the webhook (run in your terminal with env vars set):

   ```bash
   curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://<your-app>.vercel.app/api/telegram-webhook&secret_token=${TELEGRAM_WEBHOOK_SECRET}"
   ```

   Expected response: `{"ok":true,"result":true,"description":"Webhook was set"}`
4. Verify: `curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"`

- [ ] **Step 5.4: Manual smoke test**

Submit a test service listing via the form → confirm the Telegram notification arrives with ✅ Approve and ❌ Delete buttons → tap Approve → confirm:

- DB row has `approved = true`
- Telegram message updated with `✅ Approved`, buttons removed

Submit another listing → tap Delete → confirm:

- DB row is gone
- Cloudinary images removed
- Telegram message updated with `🗑 Deleted`, buttons removed
