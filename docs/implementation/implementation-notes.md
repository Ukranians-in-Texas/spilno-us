# Implementation Notes

Assumptions, conflicts, and open questions tracked during MVP implementation.

---

## Conflicts Resolved

### Font: Inter vs Lato
- **docs/MVP_DOCUMENT.md** specifies `Inter`
- **Figma design** uses `Lato` throughout all frames
- **Decision:** Using **Lato** (Figma is the design source of truth for visual details)
- Per docs/DECISIONS.md: Figma designs take precedence for visual/styling decisions

---

## Assumptions

1. **Routing** — Uses React Router 7. Main public routes: `/`, `/add-service`, `/privacy`. Admin routes: `/admin/login`, `/admin`, `/admin/services`.
2. **Add Service form** — Custom React form at `/add-service`. Submits directly to Supabase via `/api/submit-service`. No Google Forms.
3. **Featured listings** — Showing newest 6 approved listings (no separate "featured" flag per MVP doc).
4. **Client-side filtering** — All approved services loaded at once; search/filter happens in browser (per MVP_GAPS.md recommendation for <200 listings).
5. **Footer** — Minimal footer added.
6. **Image handling** — Images uploaded to Cloudinary via unsigned preset; URLs stored in Supabase `images` field (comma-separated). Fallback placeholder shown on load error.

---

## Open Questions

1. **Domain name** — `spilno.us` ✅ resolved
2. **Contact email** — `info@spilno.us` ✅ resolved
3. **Database** — Supabase ✅ resolved (migrated from Airtable 2026-03-08)
4. **Image hosting** — Cloudinary ✅ resolved (migrated from Google Drive)

---

## Implementation Log

| Date | Milestone | Notes |
|------|-----------|-------|
| 2026-02-15 | Project scaffold | Vite + React + Tailwind initialized |
