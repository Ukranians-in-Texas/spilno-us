# Spilno.us Documentation

Documentation for **Spilno.us** — a bilingual (English/Ukrainian) Ukrainian professional services directory for the Texas community, built with React 19 + Vite 7 + Tailwind v4, deployed on Vercel with a Supabase backend. Live at [spilno.us](https://www.spilno.us/).

> Project root reference: [`../CLAUDE.md`](../CLAUDE.md) (conventions, tech stack, env vars).
>
> Docs tagged **(historical)** describe superseded designs (e.g. Airtable, Google Drive) kept for context — they point to the current source of truth.

## Start here

| If you want to… | Read |
| --- | --- |
| Understand what the system is and why | [technical-guide.md](technical-guide.md) |
| See a feature traced end-to-end through the code | [walkthrough.md](walkthrough.md) |
| Understand an unfamiliar pattern (RLS, proxy, JWT…) | [concepts.md](concepts.md) |
| Run or extend the test suite | [testing.md](testing.md) |
| Manually QA flows that need a running app | [manual-testing.md](manual-testing.md) |

These four — `technical-guide`, `concepts`, `walkthrough`, `testing` — are the living core and cross-reference each other (*what/why* vs. *how/how-it-connects*).

## Top-level guides

- [technical-guide.md](technical-guide.md) — The authoritative, self-contained technical reference: architecture, file map, run/deploy, and non-obvious decisions. Unconfirmed items are marked **[Assumption]**.
- [concepts.md](concepts.md) — Explains the patterns the project uses (read proxy, RLS, serverless functions, JWT, data model), anchored to this codebase.
- [walkthrough.md](walkthrough.md) — Narrative end-to-end traces of each major flow (browse, submit, approve) with annotated code excerpts.
- [testing.md](testing.md) — Test-suite guide: unit vs. component vs. E2E, how to run (Vitest + Playwright), and how to add tests.
- [manual-testing.md](manual-testing.md) — Manual QA checklist for UI flows, auth, security headers, and edge cases impractical to unit-test.
- [rate-limiting.md](rate-limiting.md) — Current submission/abuse protections: email rate limit (fails closed), authenticated `delete-image`, and the orphaned-image cleanup cron — with their known limits.
- [security-audit.md](security-audit.md) — Security audit (2026-03-12) with findings by severity; fixed items struck through and dated.

## architecture/

System design, decisions, and original scope.

- [decisions.md](architecture/decisions.md) — Architecture/tech decision log (e.g. Airtable → Supabase migration), with dates and status.
- [security-concerns.md](architecture/security-concerns.md) — Deep dive into security issues and their resolution status.
- [system-graph/](architecture/system-graph/) — Interactive system graph — open `index.html` in a browser for clickable nodes and animated flows (`data.json` is the source).
- [mvp-document.md](architecture/mvp-document.md) — *(historical)* Original MVP spec; superseded by `technical-guide.md`.
- [mvp-gaps.md](architecture/mvp-gaps.md) — *(historical)* Gaps found during the MVP, mostly since addressed.

## data/

Database and source-data reference.

- [airtable-schema.md](data/airtable-schema.md) — *(historical)* Column definitions — still accurate for the Supabase `services` table; authoritative schema is [`supabase/schema.sql`](../supabase/schema.sql).
- [airtable-hashtags.md](data/airtable-hashtags.md) — *(historical)* Old Airtable hashtag values; replaced by the category/subcategory system in [`src/data/categories.js`](../src/data/categories.js).

## implementation/

How specific subsystems are built.

- [admin-dashboard.md](implementation/admin-dashboard.md) — The lazy-loaded `/admin` dashboard: Supabase Auth, review queue, search, edit panel.
- [theming.md](implementation/theming.md) — Light/dark theming via `localStorage`, an `<html>` class, CSS variables, and Tailwind `dark:` utilities.
- [i18n.md](implementation/i18n.md) — Context-based en/ua internationalization (no i18n library); key files and string layout.
- [google-drive-images.md](implementation/google-drive-images.md) — *(historical)* Google Drive image handling; replaced by Cloudinary — see technical-guide §7.
- [google-analytics.md](implementation/google-analytics.md) — *(not yet implemented)* Ready-to-follow GA4 setup; CSP allows it, but the gtag snippet isn't wired up.
- [implementation-notes.md](implementation/implementation-notes.md) — Assumptions, resolved conflicts, and open questions tracked during the MVP.

## plans/

Planning and research docs — mostly **(historical)**, completed and superseded.

- [rate-limiting-plan.md](plans/rate-limiting-plan.md) — Plan and outcome for closing the `delete-image` auth gap and adding IP rate limiting (see `rate-limiting.md` for current state).
- [add-service-form-plan.md](plans/add-service-form-plan.md) — *(historical)* Plan for the native `/add-service` form (completed).
- [cloudinary-plan.md](plans/cloudinary-plan.md) — *(historical)* Plan for the Cloudinary image integration (completed).
- [admin-dashboard-research-prompt.md](plans/admin-dashboard-research-prompt.md) — *(historical)* Research prompt that informed the admin dashboard.
- [admin-dashboard-research-results.md](plans/admin-dashboard-research-results.md) — *(historical)* Research findings/recommended stack for the admin dashboard.

## superpowers/

Feature specs and plans authored via the Superpowers workflow — both **(historical)**, completed.

- [specs/2026-03-20-telegram-approve-deny-design.md](superpowers/specs/2026-03-20-telegram-approve-deny-design.md) — Design spec for Telegram inline Approve/Delete buttons.
- [plans/2026-03-20-telegram-approve-deny.md](superpowers/plans/2026-03-20-telegram-approve-deny.md) — Task-by-task implementation plan for the same feature.
