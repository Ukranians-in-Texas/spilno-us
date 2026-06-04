# Project Decisions

Key architectural and technical decisions for the Ukrainians in Texas service directory platform.

---

## Decision 1: Database — Airtable vs Alternatives

**Decision:** ~~Airtable~~ → **Supabase** (migrated 2026-03-08)
**Date:** 2026-02-15 (original) / 2026-03-08 (migration)
**Status:** ✅ Accepted

### Alternatives Considered

| Option | Pros | Cons | Complexity |
| -------- | ------ | ------ | ------------ |
| **Airtable** | Spreadsheet-like UI, visual, perfect for manual approval, no SQL needed, 1,200 records free | Need Vercel proxy for security, paid tier after 1,200 records ($20/month), no built-in auth | ⭐⭐⭐⭐⭐ Very Simple |
| **Supabase** | Better free tier (unlimited records), built-in Row Level Security, PostgreSQL, built-in auth | No spreadsheet UI, requires basic SQL knowledge | ⭐⭐⭐ Medium |
| **Firebase/Firestore** | Google product, generous free tier, real-time, NoSQL | Firebase console is complex, security rules tricky, pricing scales up | ⭐⭐⭐ Medium |
| **Google Sheets** | Extremely simple, free forever, everyone knows it | NOT designed for production, slow API, security issues, no proper database features | ⭐⭐⭐⭐⭐ Very Simple (but not production-ready) |

### Why Supabase?

Started with Airtable for simplicity, but migrated to Supabase when we decided to build a custom admin dashboard with authentication.

1. **Built-in Auth**
   - Supabase Auth (email + password) powers the admin login
   - No need for a separate auth service
   - Session management handled automatically

2. **Row Level Security (RLS)**
   - Public users can only read approved listings (enforced at DB level)
   - Authenticated admin gets full access — no extra serverless functions needed
   - Admin can call Supabase directly from the browser using the anon (publishable) key

3. **Better free tier**
   - Unlimited records (Airtable caps at 1,200 on free tier)
   - Built-in database, auth, and storage in one service

4. **Standard PostgreSQL**
   - Familiar SQL for querying and migrations
   - Schema defined in `supabase/schema.sql`

### Why Not Airtable (original choice)?

Airtable worked well for MVP but lacked:
- Built-in authentication (needed for admin dashboard)
- Row-level security (hard to enforce access control)
- Free tier was capped at 1,200 records

---

## Decision 2: Hosting — Vercel vs Netlify vs Cloudflare

**Decision:** Use **Vercel**
**Date:** 2026-02-15
**Status:** ✅ Accepted

### Alternatives Considered

| Option | Pros | Cons | Best For |
|--------|------|------|----------|
| **Vercel** | Free tier generous, easy React deploy, serverless functions integrated, auto-detects Vite, excellent DX | Vendor lock-in, serverless functions cold start | React apps with API routes |
| **Netlify** | Free tier generous, built-in forms, serverless functions, similar to Vercel, good docs | Similar vendor lock-in, slightly slower builds | Static sites, Jamstack |
| **Cloudflare Pages** | Fast global CDN, free tier, Workers for API, generous limits, good performance | Smaller ecosystem, Workers different from standard Node.js, less React-focused | Static sites, edge computing |

### Why Vercel?

1. **Perfect for React + Vite**
   - Auto-detects Vite projects
   - Zero-config deployment
   - Optimized for React apps

2. **Serverless functions integrated**
   - `/api` folder automatically becomes serverless functions
   - No extra configuration needed

3. **Developer experience**
   - Deploy previews for every PR
   - One-click rollbacks
   - Built-in analytics
   - Excellent documentation

4. **Free tier is generous**
   - 100GB bandwidth/month
   - Unlimited serverless function invocations
   - Perfect for MVP and beyond

5. **Single platform for frontend + API**
   - No need to manage two separate services
   - Environment variables in one place
   - Simplified deployment

### When to Reconsider

- If Vercel pricing becomes too expensive at scale → Cloudflare Pages
- If vendor lock-in becomes a concern → self-host on VPS

---

## Decision 3: Image Hosting — Google Drive vs Alternatives

**Decision:** Use **Cloudinary**
**Date:** 2026-03-05
**Status:** ✅ Accepted (migrated from Google Drive)

### Alternatives Considered

| Option | Pros | Cons | Cost |
|--------|------|------|------|
| **Google Drive** | Free, integrates with Google Forms, unlimited storage (15GB free), simple for users | No automatic optimization, manual URL conversion needed, not designed for web hosting | Free (15GB) |
| **Cloudinary** | Automatic optimization, image transformations, CDN, purpose-built for images | Free tier limited (25 credits/month) | Free tier limited |
| **Vercel Blob** | Integrated with Vercel, simple API, good DX | Paid only ($0.15/GB storage + $0.30/GB bandwidth) | Paid ($0.15/GB) |
| **AWS S3** | Cheap, scalable, industry standard | Complex setup, need to configure CloudFront CDN, overkill for MVP | Very cheap but complex |

### Why Cloudinary?

1. **Purpose-built for images**
   - Automatic optimization (WebP/AVIF delivery)
   - Resizing and transformation on the fly
   - Global CDN for fast delivery

2. **Direct upload from browser**
   - Users upload images via unsigned upload preset in the Add Service form
   - No backend code needed for uploads
   - Cloudinary URLs stored in Supabase (comma-separated in `images` field)

3. **Free tier sufficient for MVP**
   - 25 credits/month covers typical usage
   - No infrastructure to manage

### When to Reconsider

- If we exceed free tier limits → upgrade Cloudinary plan or migrate to Vercel Blob
- If cost becomes a concern → AWS S3 + CloudFront

---

## Decision 4: Forms — Google Forms vs Custom Form

**Decision:** ~~Google Forms~~ → **Custom React Form** (migrated 2026-03-01)
**Date:** 2026-02-15 (original) / 2026-03-01 (migration)
**Status:** ✅ Accepted

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Google Forms** | Zero infrastructure, built-in spam protection, free, no code needed | No custom branding, separate from site, manual data import to database |
| **Custom React Form** | Matches site design, submits directly to Supabase, better UX, image upload built-in | Requires spam protection, more code to maintain |

### Why Custom Form?

1. **Integrated experience**
   - Form lives at `/add-service` within the site
   - Matches the site's design and language (English/Ukrainian)
   - No redirect to an external Google Form

2. **Direct Supabase integration**
   - Submissions go directly to the `services` table (`approved = false`)
   - No manual import step — admin sees pending submissions immediately in the dashboard queue

3. **Built-in image upload**
   - Users upload photos directly via Cloudinary unsigned preset
   - Images attached to the submission automatically

4. **Custom validation**
   - Ukrainian phone formats, URL validation, required fields
   - Bilingual error messages

### Spam protection

Custom form includes:
- Honeypot field (bots fill it, humans don't)
- Manual review: all submissions start as `approved = false` and require admin approval

---

## Decision 5: Repository Structure — Monorepo vs Separate Repos

**Decision:** **Monorepo** (single repository)
**Date:** 2026-02-15
**Status:** ✅ Accepted

### Structure

```
community-frontend/
├── api/              # Vercel serverless functions (server-side)
├── src/              # React frontend (client-side)
├── supabase/         # SQL schema and RLS policies
├── docs/             # Documentation
├── public/           # Static assets
└── package.json
```

### Why Monorepo?

1. **Vercel's default pattern**
   - Vercel automatically detects `/api` folder
   - Deploys both frontend and API in one go
   - No configuration needed

2. **Simpler for small team**
   - One repo to clone
   - One set of dependencies
   - One deployment

3. **Shared code**
   - Categories, constants, types shared between frontend and API
   - No need for npm packages or git submodules

4. **No CORS issues**
   - API and frontend on same domain
   - `/api/services` is relative path

---

## Summary

| Decision | Choice | Why |
|----------|--------|-----|
| **Database** | Supabase | Built-in auth + RLS, needed for admin dashboard |
| **Hosting** | Vercel | Best DX for React + serverless functions |
| **Images** | Cloudinary | Optimized delivery, direct upload from browser |
| **Forms** | Custom React form | Integrated UX, direct Supabase submission |
| **Repo Structure** | Monorepo | Simple, standard Vercel pattern |

**Philosophy:** For MVP, prioritize **simplicity and speed** over **optimization and scale**. We can always migrate later if needed.
