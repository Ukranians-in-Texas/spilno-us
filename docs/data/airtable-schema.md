# Database Schema

> **Historical** — Originally documented the Airtable schema. Column definitions below are still accurate for the Supabase `services` table. The authoritative schema is [supabase/schema.sql](../../supabase/schema.sql).

Supabase (PostgreSQL) — table: `services`

| Column | Type | Default | Notes |
| --- | --- | --- | --- |
| id | uuid | gen_random_uuid() | Primary key |
| title | text | — | Business name (required) |
| description_en | text | — | Description in English |
| description_ua | text | — | Description in Ukrainian |
| category | text | — | Category slug |
| address | text | — | |
| phone | text | — | |
| email | text | — | |
| website | text | — | URL |
| instagram | text | — | URL |
| facebook | text | — | URL |
| linkedin | text | — | URL |
| messenger | text | — | URL |
| images | text | — | Comma-separated Cloudinary URLs |
| approved | boolean | false | RLS: public reads only `approved = true` rows |
| featured | boolean | false | |
| notes | text | — | Internal admin notes (not shown publicly) |
| submitted_at | timestamptz | now() | Set on insert |
| created_at | timestamptz | now() | Set on insert |

## Row Level Security (RLS)

- **Public (anon key):** `SELECT` only where `approved = true`
- **Authenticated (admin):** full access — SELECT, INSERT, UPDATE, DELETE

SQL files in `supabase/`:

- `schema.sql` — table definition + public read policy
- `admin-rls.sql` — admin full-access policy (run once in Supabase SQL Editor)
