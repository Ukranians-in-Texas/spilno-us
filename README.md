# Spilno.us — Ukrainians in Texas

A bilingual service directory connecting Ukrainian professionals in Texas with people seeking their services. Live at **[spilno.us](https://www.spilno.us/)**.

## Overview

The platform lets visitors browse, search, and filter Ukrainian service providers across Texas. Providers submit listings through a public form; each submission is reviewed and approved by an admin — via a Telegram bot or the web admin dashboard — before it appears on the site.

**Key features:**

- 🔍 Browse, search, and filter providers
- 🏷️ 21 service categories (105 subcategories)
- 🌐 Bilingual UI (English / Ukrainian)
- 🌓 Light / dark theme
- 📱 Mobile-responsive design
- 🔒 Spam-protected submissions (honeypot, validation, rate limiting)

## Tech Stack

### Frontend

- **React 19** + **Vite 7**
- **Tailwind CSS v4** for styling
- **React Router 7** for client-side routing

### Backend

- **Vercel Serverless Functions** (`/api`) — read proxy, submission handler, image delete, Telegram webhook, keep-alive cron
- **Supabase** (Postgres) — single `services` table, protected by Row Level Security
- **Cloudinary** — image hosting (unsigned client upload, signed server delete)
- **Telegram Bot API** — submission notifications with inline Approve / Delete buttons

### Architecture

- Single repo (frontend + serverless API)
- Public reads go through `/api/services` (server-side service key, cached); the public app never queries Supabase directly
- The admin dashboard talks to Supabase directly from the browser (anon key + RLS)
- See **[docs/technical-guide.md](docs/technical-guide.md)** for the full architecture.

## Project Structure

```
spilno-us/
├── api/              # Vercel serverless functions + _lib helpers
├── src/              # React frontend (components, pages, hooks, context, i18n)
├── supabase/         # schema.sql + admin-rls.sql
├── docs/             # Documentation
├── vite.config.js    # Vite config + local /api dev middleware
├── vercel.json       # Security headers (CSP) + SPA rewrite
└── package.json
```

## Documentation

- **[Technical Guide](docs/technical-guide.md)** — current architecture, data model, subsystems, and operations (start here)
- **[MVP Specification](docs/architecture/mvp-document.md)** — original technical spec and design system
- **[Technology Decisions](docs/architecture/decisions.md)** — rationale behind stack choices
- **[Security Concerns](docs/architecture/security-concerns.md)** — security deep dive
- **[MVP Gaps](docs/architecture/mvp-gaps.md)** — edge cases, accessibility, SEO, performance

> Note: some files under `docs/architecture/` and `docs/plans/` predate the current stack (they reference an earlier Airtable / Google Forms design). The Technical Guide and [CLAUDE.md](CLAUDE.md) are the accurate, up-to-date sources.

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Accounts for Supabase, Cloudinary, and (optionally) a Telegram bot

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd spilno-us

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Fill in the values (see Environment Variables below)

# Run the dev server (Vite serves /api locally via middleware)
npm run dev
```

### Environment Variables

**Client-side** (prefixed `VITE_`, exposed to the browser):

```env
VITE_CONTACT_EMAIL=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**Server-side** (Vercel functions only — never exposed to the client):

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_WEBHOOK_SECRET=
```

See [.env.example](.env.example) for the full list.

## Development

```bash
npm run dev         # start local dev server (+ local /api middleware)
npm run build       # production build
npm run preview     # serve the production build
npm run lint        # ESLint
npm test            # run all tests once
npm run test:watch  # tests in watch mode
```

## Testing

Unit tests use [Vitest](https://vitest.dev/) (works natively with Vite, no extra config). External services (Supabase, Telegram, Cloudinary) are mocked — no real network or DB calls. Test files live next to the source they cover:

| File | Covers |
| --- | --- |
| `src/utils/validation.test.js` | `formatPhone`, `isValidURL`, `getSafeHref`, `getDomain` |
| `src/utils/imageUrl.test.js` | `getCloudinaryPublicId`, `parseImageUrls` |
| `api/submit-service.test.js` | Validation, honeypot, rate limiting, image filtering, success/error paths |
| `api/telegram-webhook.test.js` | Secret check, approve/delete callbacks, idempotency |
| `api/_lib/telegram.test.js` | Message building and escaping |
| `api/_lib/cloudinary.test.js` | Public-id extraction, single/CSV delete |

## Deployment

**Platform:** Vercel (SPA + serverless `/api` functions).

1. Connect the GitHub repository to Vercel.
2. Add all environment variables in the Vercel dashboard.
3. Push to `main` — Vercel auto-deploys.

SPA routing and security headers (CSP, `X-Frame-Options`, etc.) are configured in [vercel.json](vercel.json). A daily `keep-alive` cron pings the database to keep the Supabase project warm.

## Contributing

This is a community project — contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

## Contact

Questions or support: [info@spilno.us](mailto:info@spilno.us)

---

**Built with ❤️ for the Ukrainian community in Texas**
