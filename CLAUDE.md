# CLAUDE.md

## Project Overview

Spilno.us — Ukrainian professional services directory web app for the Texas community. Bilingual (English/Ukrainian), with light/dark theme support.

For deep architecture/data/subsystem detail, see `docs/technical-guide.md`.

## Tech Stack

- **React** 19 + **Vite** 7 + **Tailwind CSS** v4
- **React Router** 7 for client-side routing
- **Vercel** for deployment (frontend + serverless API functions)
- **Supabase** (Postgres) as database (accessed via Vercel serverless functions)
- No Redux/Zustand — React Context API only

## Package Manager

**npm** (`npm run dev`, `npm run build`, `npm run lint`, `npm run preview`, `npm test`)

## Testing

- **Vitest** — test runner (works natively with Vite, no extra config needed)
- `npm test` — run all tests once
- `npm run test:watch` — watch mode
- `npm run test:e2e` — Playwright E2E (3 specs in `tests/e2e/`: browse, submit, navigation — API mocked via `page.route()`)

Test files live next to the source files they cover (`*.test.js` for unit/API handlers, `*.test.jsx` for components). 162 unit/component tests across 15 files as of this writing — full file-by-file breakdown in [docs/testing.md](docs/testing.md), not duplicated here to avoid the two drifting out of sync.

Supabase, Telegram, Cloudinary, and GitHub are mocked via `vi.mock()` in unit tests. No real DB or API calls are made during tests.

## Project Structure

```text
src/
  components/       # UI components (PascalCase folders)
    UI/             # Reusable primitives (Button, Icon, Tag, BackToTop)
    Header/         # Header, Logo, CategoryMenu, LanguageSelector, ThemeToggle, MobileMenu
    Hero/           # Hero, SearchBar
    ServiceCard/    # ServiceCard, ImageGallery, SocialLinks
    ServiceList/    # ServiceList
    Footer/         # Footer
    AddServiceForm/ # Form for submitting a new service listing
  pages/            # Page-level components (HomePage, PrivacyPage, AddServicePage, TermsPage, NotFoundPage)
    admin/          # AdminLoginPage, AdminLayout, AdminQueuePage, AdminServicesPage
  context/          # ThemeContext.js + ThemeProvider.jsx, LanguageContext.js + LanguageProvider.jsx
                    #   (split to keep Fast Refresh happy — a file exporting both a context
                    #   object and a component breaks it)
  hooks/            # useTheme, useLanguage, useServices
  lib/              # supabaseClient.js — browser-side Supabase client (anon key)
  services/         # api.js — fetch functions
  utils/            # validation.js, imageUrl.js
  data/             # categories.js (21 categories, 105 subcategories)
  i18n/             # en.json, ua.json — manual JSON translations
api/                # Vercel serverless functions
  services.js       # GET — fetch approved services
  submit-service.js # POST — submit new service listing
  delete-image.js   # DELETE — remove an image from Cloudinary
  telegram-webhook.js # POST — Telegram Approve/Delete button callbacks
  keep-alive.js     # GET — daily cron (vercel.json), pings DB to keep Supabase warm
  cleanup-images.js # GET — weekly cron (vercel.json); deletes orphaned Cloudinary images AND
                    #   commits a services-table JSON backup to GitHub (piggybacked — see below)
  _lib/supabase.js  # Supabase client + fetchApprovedServices
  _lib/telegram.js  # buildMessageText + sendTelegramNotification
  _lib/cloudinary.js # delete by public_id / delete CSV of image URLs
  _lib/github.js    # backupServicesToGitHub — commits a services.json snapshot to data-backups
supabase/
  schema.sql        # Table definition + public read RLS policy
  admin-rls.sql     # Admin full-access RLS policy (run once in SQL Editor)
tests/
  e2e/              # Playwright specs (browse, submit, navigation) — run via `npm run test:e2e`
```

## Key Conventions

- **Components:** PascalCase files and folders
- **Hooks:** camelCase with `use` prefix
- **Constants:** UPPER_SNAKE_CASE
- **Styling:** Tailwind utility classes only — no CSS modules, no separate per-component CSS
- **Dark mode:** `dark:` Tailwind prefix; toggled via `dark` class on root element
- **Custom colors:** Defined as CSS custom properties in `src/index.css` (`dark-blue`, `brand-red`, `brand-blue`)
- Named exports for components (not default exports as a rule, but mixed usage exists)

## State Management

- Theme and language stored in `localStorage` and managed via Context
- Filtering state lives in `HomePage` (search and category are mutually exclusive)
- `useServices` hook handles data fetching with cancellation flag; caches the last successful
  fetch to `localStorage` per language and falls back to it on failure, so a transient API/DB
  blip doesn't blank the page for a returning visitor

## i18n

- No i18n library — custom `LanguageContext` with dot-notation key lookup
- Translations in `src/i18n/en.json` and `src/i18n/ua.json`

## API

- Public app never calls Supabase directly — always via `/api/services` (Vercel serverless)
- Admin dashboard calls Supabase directly from the browser using the anon key + RLS policies
- During local dev, Vite middleware in `vite.config.js` serves `/api/*` locally
- ⚠️ The local Vite middleware reimplements `/api/submit-service` with **looser** validation (requires `phone`, skips category allowlist / format / length / rate-limit). The deployed `api/*.js` handlers are authoritative — verify submit behavior against prod.
- Cache headers: 5 min, stale-while-revalidate 10 min
- Supabase table: `services` — RLS enabled, public can only read `approved = true` rows; authenticated users have full access

## Telegram Bot (submission review)

- On submit, `/api/submit-service` sends a Telegram message with inline Approve/Delete buttons (`api/_lib/telegram.js`)
- Button taps hit `/api/telegram-webhook`, verified by the `x-telegram-bot-api-secret-token` header
- Approve flips `approved=true`; Delete removes the row + its Cloudinary images
- Redundant with the web admin queue — both flows are intentional (approve from phone vs. dashboard)

## Environment Variables

Client-side (prefix `VITE_`):

- `VITE_CONTACT_EMAIL`
- `VITE_CLOUDINARY_CLOUD_NAME`
- `VITE_CLOUDINARY_UPLOAD_PRESET`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-side (Vercel only, never in client):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_FOLDER` — optional; if set, `/api/delete-image` rejects any `publicId`
  outside this folder (403), on top of the admin-auth check. No-op if unset
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`
- `CRON_SECRET` — required for the `keep-alive` / `cleanup-images` crons to run; both 401 without it
- `HEALTHCHECK_URL` — optional; `keep-alive` pings it on success as a dead-man's-switch
- `GITHUB_TOKEN` — fine-grained PAT (Contents: Read and write) on this repo; `cleanup-images.js`
  uses it to commit a weekly `services` table JSON backup to the `data-backups` branch

## Images

- Uploaded to Cloudinary via unsigned upload preset; URLs stored in Supabase `images` field (comma-separated)
- Parsed and validated in `src/utils/imageUrl.js` and `src/utils/validation.js`
- Gallery with Lightbox component for full-size viewing

## Deployment

- Push to `main` → auto-deploys to Vercel
- Set env vars in Vercel dashboard
- `vercel.json` rewrites all routes to `/index.html` for SPA routing
- Both crons are registered in `vercel.json`'s `"crons"` array — **not** via any `config.schedule`
  export in the function file (Vercel ignores that; a past instance of this is why the keep-alive
  cron silently never ran — see `docs/db-pause-recovery-plan.md`)
  - Daily `keep-alive` cron (`0 0 * * *`) pings the DB to keep Supabase from idling
  - Weekly `cleanup-images` cron (`0 3 * * 0`) deletes orphaned Cloudinary images **and** commits a
    full `services` table JSON backup to the `data-backups` branch on GitHub. These two are
    bundled onto one cron because Vercel Hobby caps a project at 2 cron jobs total and both slots
    are already spoken for — see `docs/db-pause-recovery-plan.md` for the reasoning
  - Both handlers reject requests without a valid `Authorization: Bearer $CRON_SECRET` header
