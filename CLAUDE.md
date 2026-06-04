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

Test files live next to the source files they cover (`*.test.js`):

| File | What's covered |
| --- | --- |
| `src/utils/validation.test.js` | `formatPhone`, `isValidURL`, `getSafeHref`, `getDomain` |
| `src/utils/imageUrl.test.js` | `getCloudinaryPublicId`, `parseImageUrls` |
| `api/submit-service.test.js` | All validation rules, honeypot, rate limiting, image filtering, success/error paths |
| `api/telegram-webhook.test.js` | Approve/delete callbacks, secret check, UUID/action validation, idempotency |
| `api/_lib/telegram.test.js` | Message building + HTML escaping |
| `api/_lib/cloudinary.test.js` | Public-id extraction, single/CSV delete |

Supabase, Telegram, and Cloudinary are mocked via `vi.mock()`. No real DB or API calls are made during tests.

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
  context/          # ThemeContext, LanguageContext
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
  keep-alive.js     # GET — daily cron, pings DB to keep Supabase warm
  _lib/supabase.js  # Supabase client + fetchApprovedServices
  _lib/telegram.js  # buildMessageText + sendTelegramNotification
  _lib/cloudinary.js # delete by public_id / delete CSV of image URLs
supabase/
  schema.sql        # Table definition + public read RLS policy
  admin-rls.sql     # Admin full-access RLS policy (run once in SQL Editor)
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
- `useServices` hook handles data fetching with cancellation flag

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
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `TELEGRAM_WEBHOOK_SECRET`

## Images

- Uploaded to Cloudinary via unsigned upload preset; URLs stored in Supabase `images` field (comma-separated)
- Parsed and validated in `src/utils/imageUrl.js` and `src/utils/validation.js`
- Gallery with Lightbox component for full-size viewing

## Deployment

- Push to `main` → auto-deploys to Vercel
- Set env vars in Vercel dashboard
- `vercel.json` rewrites all routes to `/index.html` for SPA routing
- Daily `keep-alive` cron (`api/keep-alive.js`, `0 0 * * *`) pings the DB to keep Supabase from idling
