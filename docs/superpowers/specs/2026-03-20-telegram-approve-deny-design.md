# Telegram Approve/Deny for Service Submissions

> **Historical** — Completed. Telegram inline buttons are live. See [technical-guide.md](../../technical-guide.md) for current state.

**Date:** 2026-03-20
**Status:** Approved

## Summary

Add ✅ Approve and ❌ Delete inline keyboard buttons to the Telegram notification sent when a new service listing is submitted. Tapping a button from Telegram performs the action directly — no need to open the admin panel.

## Goals

- Admin can approve or delete a pending submission directly from the Telegram notification
- Deleting via Telegram also removes associated Cloudinary images (consistent with admin panel behavior)
- After taking action, the message updates to show the result and buttons are removed

## Non-goals

- Email notification to the submitter on rejection
- Telegram user ID allowlist (secret token validation is sufficient)
- Any changes to the admin panel UI

## Architecture

### Files modified

**`api/submit-service.js`**

Change `.insert(record)` to `.insert(record).select('id').single()` to retrieve the new row's UUID. Pass the ID to `sendTelegramNotification(record, id)`.

**`api/_lib/telegram.js`**

- `sendTelegramNotification(record, serviceId)` gains a `serviceId` parameter
- Message body includes an `inline_keyboard` with two buttons:
  - `[✅ Approve]` → callback_data: `approve_<uuid>`
  - `[❌ Delete]` → callback_data: `delete_<uuid>`
- Extract message text construction into a named helper `buildMessageText(row)` — used both when sending and when reconstructing for edits in the webhook
- `buildMessageText` accepts an object with fields `title`, `category`, `phone`, `email`, `address`, `website` — these match both the `record` shape passed at submission time and the Supabase column names returned by a `select('*')` query, so the same function works in both contexts
- All user-supplied string fields are HTML-escaped before interpolation (replace `&`, `<`, `>`, `"` with their HTML entities) to prevent malformed submissions from breaking `parse_mode: 'HTML'` and causing `sendMessage`/`editMessageText` to fail

**`api/_lib/telegram.js`** also exports `buildMessageText` so the webhook can reconstruct the original HTML body.

### Files created

**`api/_lib/cloudinary.js`**

Shared helper:

```js
export async function deleteCloudinaryImages(imagesCsv) { ... }
```

- If `imagesCsv` is falsy or empty, returns immediately (no-op)
- Parses comma-separated URLs, extracts public IDs via inline regex (duplicated from `src/utils/imageUrl.js` — server-side files cannot import from `src/`)
- Deletes each image independently in a `Promise.allSettled` loop using the same Cloudinary Resources API endpoint as `delete-image.js` (`DELETE /v1_1/<cloud>/resources/image/upload?public_ids[]=<id>`) — individual failures are logged but do not stop remaining images and do not throw; duplicate calls for the same ID are benign (Cloudinary returns success)
- `delete-image.js` is updated to import and use this helper (no behavior change to that endpoint)

**`api/telegram-webhook.js`**

New Vercel serverless POST handler. Vercel gives serverless functions in `/api/` priority over `rewrites` in `vercel.json`, so the existing catch-all rewrite does not intercept this endpoint — no `vercel.json` changes are needed. Verify after deploying by checking the webhook registration response.

**Important:** Telegram requires `answerCallbackQuery` within 10 seconds or the spinner never dismisses. The handler calls it as early as possible — immediately after validating the secret and parsing the callback, before any Supabase or Cloudinary operations. All paths after the secret check return HTTP 200 (Telegram retries on non-200; returning 200 immediately prevents duplicate delivery).

Handler steps:

1. Validate `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET` — return **401** if missing or wrong (the only non-200 response)
2. Parse `callback_query` from the request body — return **200** immediately if absent (non-button update)
3. Call `answerCallbackQuery(callbackQueryId)` immediately to dismiss the spinner — errors from this call are logged but ignored; the handler continues regardless
4. Extract `action` and `serviceId` from `callback_data`:
   - Split on the first `_` only: `const sep = data.indexOf('_'); action = data.slice(0, sep); serviceId = data.slice(sep + 1)`
   - Validate `serviceId` against UUID regex (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) — if invalid, call `editMessageText` with `⚠️ Invalid request` and return 200
   - If `action` is not `approve` or `delete`, call `editMessageText` with `⚠️ Unknown action` and return 200
5. Fetch the service row from Supabase: `select('*').eq('id', serviceId).single()`
   - If Supabase returns error code `PGRST116` (no rows): call `editMessageText` with `⚠️ Not found` and return 200
   - If Supabase returns any other error: call `editMessageText` with `⚠️ Error: <message>` and return 200
6. **Approve path:**
   - If `row.approved === true`: call `editMessageText` with `ℹ️ Already approved` and return 200
   - Otherwise: `supabase.update({ approved: true }).eq('id', serviceId)`
   - On success: call `editMessageText` with `✅ Approved`
   - On Supabase error: call `editMessageText` with `⚠️ Error: <message>` and return 200
7. **Delete path:**
   - `await deleteCloudinaryImages(row.images)` — awaited so it completes before the function returns (prevents Vercel from freezing the context mid-flight); individual failures are logged and do not abort the remaining images or the DB delete
   - `supabase.delete().eq('id', serviceId)`
   - On success: call `editMessageText` with `🗑 Deleted`
   - On Supabase error: call `editMessageText` with `⚠️ Error: <message>` and return 200
8. `editMessageText` parameters:
   - `chat_id` = `callback_query.message.chat.id`
   - `message_id` = `callback_query.message.message_id`
   - `text` = `buildMessageText(row)` + `\n\n<result line>` — reconstructed from the fetched service data, **not** from `callback_query.message.text` (which strips HTML tags)
   - `parse_mode: 'HTML'` — must match the original send to preserve `<b>` tags
   - `reply_markup: { inline_keyboard: [] }` — removes the buttons

## Data Flow

```text
User submits form
  → submit-service.js inserts record, gets UUID back
  → sendTelegramNotification(record, id) sends message with inline buttons

Admin taps button in Telegram
  → Telegram POSTs callback_query to /api/telegram-webhook
  → Webhook validates secret header (401 if bad)
  → answerCallbackQuery called immediately (dismisses spinner)
  → Parses and validates action + UUID from callback_data
  → Fetches service row from Supabase (handles not-found for both paths)
  → Performs approve or delete operation
  → editMessageText with reconstructed HTML + status (parse_mode: HTML, buttons removed)
  → Returns 200
```

## Security

- `X-Telegram-Bot-Api-Secret-Token` header validated on every request — 401 on failure
- `serviceId` validated against UUID regex before any DB operation
- Service IDs are Supabase-generated UUIDs — unguessable
- All Supabase operations use the service role key (server-side only)
- `chat_id` from `callback_query.message.chat.id` is used for message edits rather than env var, ensuring edits target the correct chat
- All non-401 paths return 200 to prevent Telegram retry loops
- **Accepted risk:** The webhook secret validates that the request originates from Telegram's infrastructure but does not restrict which Telegram user pressed the button. Any user who can interact with the bot (e.g., in the same group chat) and knows the callback format could trigger approve/delete. For a private admin bot where the chat is not publicly accessible, this is an acceptable trade-off. If the bot is ever added to a public group, a Telegram user ID allowlist should be added.

## Environment Variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | Vercel (existing) | Bot API calls |
| `TELEGRAM_CHAT_ID` | Vercel (existing) | Where to send notifications |
| `TELEGRAM_WEBHOOK_SECRET` | Vercel (new) | Validate incoming webhook requests — use a random string of 32+ characters |

## One-time Setup

After deploying to production, register the webhook URL once:

```bash
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://<your-app>.vercel.app/api/telegram-webhook&secret_token=${TELEGRAM_WEBHOOK_SECRET}"
```

Use shell variable substitution (`$VAR`) rather than pasting secrets inline to avoid them appearing in shell history.

Expected response: `{"ok":true,"result":true,"description":"Webhook was set"}`

**Important operational notes:**

- Only one webhook URL can be active per bot at a time — re-registering replaces the previous URL
- Vercel preview deployments get unique URLs; setting the webhook to a preview URL breaks production. To test on a preview branch, use a dedicated staging bot token (`TELEGRAM_BOT_TOKEN_STAGING`) and keep production untouched
- To verify the current webhook: `curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo"`

## Error Handling

| Scenario | HTTP | User-visible feedback |
| --- | --- | --- |
| Invalid/missing secret header | 401 | None (not a Telegram request) |
| Non-button update (no `callback_query`) | 200 | None |
| Invalid UUID in `callback_data` | 200 | `⚠️ Invalid request` in message |
| Unknown `action` prefix | 200 | `⚠️ Unknown action` in message |
| Service not found (deleted or bad ID) | 200 | `⚠️ Not found` in message |
| Already approved (double-tap approve) | 200 | `ℹ️ Already approved` in message |
| Supabase operation fails | 200 | `⚠️ Error: <message>` in message |
| Cloudinary deletion fails (partial) | 200 | Not shown — logged server-side only |
| Double-tap delete | 200 | `⚠️ Not found` (row already gone) |

## Testing

Unit tests:

- `sendTelegramNotification` sends `inline_keyboard` with correct callback_data when `serviceId` is provided
- `buildMessageText` returns the same HTML string regardless of optional fields presence, and produces identical output whether called with the submission `record` shape or a fetched Supabase row (field names match)
- Webhook returns 401 on missing/wrong secret header
- Webhook returns 200 with no-op on non-button update
- Webhook calls `answerCallbackQuery` before any Supabase call
- Webhook returns 200 with edit on invalid UUID in `callback_data`
- Approve path: fetches row first, updates with `approved: true`, edits message with `✅ Approved`
- Approve path: already-approved row returns `ℹ️ Already approved`
- Approve path: missing row returns `⚠️ Not found`
- Delete path: fetches row, calls `deleteCloudinaryImages`, calls `supabase.delete`, edits message with `🗑 Deleted`
- Delete path: missing row returns `⚠️ Not found`
- `editMessageText` call always includes `parse_mode: 'HTML'` and `reply_markup: { inline_keyboard: [] }`
- `deleteCloudinaryImages` is a no-op when called with null or empty string
- `deleteCloudinaryImages` attempts all images even when one fails (per-image isolation)

Manual:

- Submit a test listing, tap Approve in Telegram — verify `approved = true` in DB, message updates to show ✅, buttons removed
- Submit a test listing, tap Delete in Telegram — verify row deleted from DB, Cloudinary images removed, message shows 🗑
- Tap Approve twice rapidly — first shows ✅ Approved, second shows ℹ️ Already approved
- Tap Delete on an already-deleted message — shows ⚠️ Not found
