# Admin Dashboard

## Overview

The admin dashboard lives at `/admin` and is only accessible to authenticated users. It is lazy-loaded — the admin JS bundle is not included in the public app and only downloads when `/admin` is visited.

## Authentication

- Uses **Supabase Auth** (email + password)
- Login page: `/admin/login`
- After login, Supabase stores the session in `localStorage` automatically
- `AdminLayout` checks the session on mount and subscribes to auth state changes — if the session is missing or expires, the user is redirected to `/admin/login`
- To create an admin user: Supabase dashboard → Authentication → Users → Add user

## Authorization (Row Level Security)

The `services` table has RLS enabled in Supabase:

- **Public** (anon key): can only read rows where `approved = true`
- **Authenticated** (admin): full access — read, insert, update, delete all rows

This means the admin pages call Supabase directly from the browser using the anon key (`VITE_SUPABASE_ANON_KEY`). No separate admin API is needed — Supabase enforces permissions server-side based on the session JWT.

The RLS policy for admin access is in `supabase/admin-rls.sql`.

## Pages

### Queue (`/admin`)
Shows all pending submissions (`approved = false`), newest first.

- **Approve** — sets `approved = true`, removes the item from the queue view
- **Delete** — permanently deletes the record after confirmation

### Services (`/admin/services`)
Shows all services (approved and pending) in a table with search and status filter.

- Search by name, category, or email
- Filter by All / Approved / Pending
- Click any row to open the **Edit Panel**

#### Edit Panel
A slide-over panel on the right side with all editable fields:

- Approved / Featured toggles
- Business name
- Category (dropdown from `src/data/categories.js`)
- Description in English and Ukrainian
- Contact fields: phone, email, address, website, Instagram, Facebook, LinkedIn, Messenger
- Internal notes (not shown publicly)
- Image thumbnails (read-only preview)

Save calls `supabase.update()`, Delete calls `supabase.delete()` with a confirmation dialog.

## File Structure

```
src/
  lib/
    supabaseClient.js        # Browser-side Supabase client (anon key)
  pages/
    admin/
      AdminLoginPage.jsx     # Login form
      AdminLayout.jsx        # Auth guard, header nav, outlet
      AdminQueuePage.jsx     # Pending submissions
      AdminServicesPage.jsx  # All services table + edit panel
supabase/
  schema.sql                 # Table definition + public read RLS policy
  admin-rls.sql              # Admin full-access RLS policy (run once in SQL Editor)
```

## Environment Variables

```
VITE_SUPABASE_URL=...        # Public — used by browser-side client
VITE_SUPABASE_ANON_KEY=...   # Public (publishable) — safe to expose; RLS enforces security
```
