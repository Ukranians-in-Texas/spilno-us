# MVP Gaps & Considerations

Areas to consider that may not be fully addressed in the main MVP document.

---

## Security Concerns

| Issue | Risk | Status |
|-------|------|--------|
| Database credentials | Exposing service key in browser gives full DB access | ✅ **RESOLVED** — Service key server-side only; anon key + RLS in browser |
| Form spam | Bot submissions filling the database | ✅ **RESOLVED** — Honeypot field + all submissions require manual admin approval |
| XSS vulnerabilities | User-submitted content could contain malicious scripts | ✅ **RESOLVED** — React default escaping (no `dangerouslySetInnerHTML`) |
| URL validation | Malicious URLs in social/website fields | ✅ **RESOLVED** — Protocol whitelist (http/https) enforced on submit and render |

---

## Missing UI Elements

### Footer

✅ **Done** — Footer includes contact email, Privacy Policy, and Terms of Service links.

### Error & Empty States

| State | When | Status |
|-------|------|--------|
| Empty search results | Search returns nothing | ✅ Done — "No services found. Try a different search term." |
| API error | Supabase/API is down | ✅ Done — Friendly error message + retry button |
| 404 page | Invalid route | ✅ Done — Branded 404 with "Back to home" button |
| Empty category | Category has no listings | ✅ Done — Message + Add service CTA |

### Loading States

- ✅ Loading text shown while services fetch
- ✅ Skeleton loaders implemented — 6 `animate-pulse` placeholder cards render in `ServiceList` while data loads

---

## Form UX

Custom React form at `/add-service`. All UX handled in-app.

| Consideration | Status |
|---------------|--------|
| Images | ✅ Cloudinary direct upload (up to 5 photos, 5MB each) |
| Description | ✅ Max 600 chars, validated client + server side |
| Phone | ✅ Validated format |
| Duplicate detection | ⚠️ Manual check by admin during review |
| Form errors | ✅ Inline bilingual error messages |
| Success state | ✅ In-app confirmation with "Submit another" option |

---

## SEO & Discoverability

### Meta Tags

✅ Done — title and description set in `index.html`.

### Open Graph (Social Sharing)

✅ Done — og:title, og:description, og:url, og:image, og:type all set.

⚠️ **Pending:** `public/og-image.jpg` (1200×630px) still needs to be created and added.

### Structured Data

Consider adding LocalBusiness or Service schema for better Google results. (Post-MVP)

### URL Structure

Current routes:
- `/` — Homepage
- `/add-service` — Submit a listing
- `/privacy` — Privacy Policy
- `/terms` — Terms of Service
- `/admin` — Admin dashboard (authenticated)

Post-MVP (optional):
- `/services/cleaning` — Category-specific page
- `/services/:id` — Individual listing page

---

## Operational Considerations

### Deployment

✅ **Resolved** — Vercel. Auto-deploys on push to `main`.

### Admin Notifications

How does admin know when new submissions arrive?

- ⚠️ Currently: must check `/admin` queue manually
- Option A: Supabase webhook → email notification on new row
- Option B: Zapier/Make trigger on new Supabase record

### Provider Edit Requests

How can a provider update their listing?

- Option A: Email link in footer ("Need to update your listing? Contact us") ← current approach
- Option B: Edit link sent in confirmation email (requires unique token)

### Analytics Setup

- ⚠️ Not yet set up
- Recommended: Google Analytics 4 or Plausible (privacy-friendly)
- Track: page views, search queries, category clicks, form submissions

---

## Legal Requirements

### Privacy Policy

✅ **Done** — `/privacy` page, linked in footer. Bilingual (EN/UA).

### Terms of Service

✅ **Done** — `/terms` page, linked in footer. Bilingual (EN/UA).

### Cookie Consent

⚠️ Not yet implemented. Required if Google Analytics is added (EU visitors).

---

## Performance Considerations

### Pagination Strategy

| Approach | Pros | Cons |
|----------|------|------|
| Load all | Simple, instant filtering | Slow with 500+ listings |
| Pagination | Predictable, good for SEO | Harder to browse |
| Infinite scroll | Good UX for browsing | Harder to implement, back button issues |

**Current:** Load all. Add pagination if listings exceed 200.

### Image Optimization

✅ Using Cloudinary — images are automatically optimized and served via CDN.

### Caching Strategy

✅ Supabase API responses cached for 5 min, stale-while-revalidate 10 min (via Vercel serverless response headers).

---

## Accessibility (a11y)

| Area | Requirement |
|------|-------------|
| Color contrast | Ensure text meets WCAG AA (4.5:1 ratio) |
| Keyboard navigation | All interactive elements focusable and operable |
| Focus states | Visible focus indicators on buttons, links, inputs |
| ARIA labels | Label icon-only buttons (hamburger, social icons) |
| Alt text | All images need descriptive alt text |
| Form labels | All inputs must have associated labels |
| Skip link | "Skip to main content" for screen readers |

---

## Browser & Device Support

### Target Browsers

- Chrome (last 2 versions)
- Safari (last 2 versions)
- Firefox (last 2 versions)
- Edge (last 2 versions)
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 10+)

### Known Gotchas

- iOS Safari: `position: fixed` issues with keyboard open
- Safari: Some CSS gap support issues in older versions
- Mobile: `tel:` links should work; test on actual devices

---

## Testing Strategy

### Manual Testing Checklist

- [ ] Homepage loads with services
- [ ] Search filters correctly
- [ ] Category dropdown works (desktop + mobile)
- [ ] Add service form submits successfully
- [ ] Images upload to Cloudinary and display correctly
- [ ] Language switcher works (EN/UA)
- [ ] Mobile menu opens/closes
- [ ] All links (phone, email, website) work
- [ ] Social icons open correct URLs
- [ ] Admin login works at `/admin/login`
- [ ] Admin queue shows pending submissions
- [ ] Approve/delete actions work in admin
- [ ] 404 page shows for unknown routes
- [ ] Privacy Policy and Terms of Service pages load

### Automated Testing (Post-MVP)

- Unit tests for utility functions
- Integration tests for API calls
- E2E tests with Playwright or Cypress

---

## Questions Resolved

| Question | Decision |
|----------|----------|
| Domain name | `spilno.us` ✅ |
| Contact email | `info@spilno.us` ✅ |
| Database | Supabase (migrated from Airtable) ✅ |
| Image hosting | Cloudinary (migrated from Google Drive) ✅ |
| Approval criteria | Manual review by admin — all submissions start as `approved = false` ✅ |
| Rejection flow | Not in MVP — listings are silently not approved or deleted |
| Featured logic | Newest 6 approved listings shown in "Featured" section ✅ |
