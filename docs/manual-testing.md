# Manual Testing Guide — spilno.us

Unit tests cover pure logic (validation, URL parsing, API handler rules). This guide covers everything that requires a running app: UI flows, auth, security headers, and edge cases that are impractical to unit-test.

---

## Setup

```bash
npm run dev        # starts local dev server + API functions
```

Requires `.env.local` with all env vars (Supabase, Cloudinary). See CLAUDE.md for the full list.

---

## 1. Public Site

### 1.1 Language & Theme

| # | Steps | Expected |
|---|-------|----------|
| 1 | Click the language toggle (EN ↔ UA) | All text updates immediately — header, hero, service cards, footer |
| 2 | Reload the page | Selected language persists (stored in `localStorage`) |
| 3 | Click the theme toggle (light ↔ dark) | All components update — no white flash, no unstyled elements |
| 4 | Reload the page | Selected theme persists |

### 1.2 Category Filter + Search Mutual Exclusivity

| # | Steps | Expected |
|---|-------|----------|
| 5 | Select a category from the dropdown | Services filter to that category; search bar is cleared |
| 6 | Type in the search bar | Category filter clears; services filter by search query |
| 7 | Clear the search text (backspace to empty) | Category does NOT restore; both filters remain off |
| 8 | Click "Clear filters" badge | Both search and category reset; all services shown |
| 9 | Search for a partial word (e.g. "clean") | Matches title, description, category, and address |
| 10 | Select a category from the header combobox | Same filtering behavior as step 5; search clears |

### 1.3 Service Card & Lightbox

| # | Steps | Expected |
|---|-------|----------|
| 11 | Click a service image | Lightbox opens full-screen |
| 12 | Click next/prev in lightbox | Navigates between images |
| 13 | Press Escape | Lightbox closes |
| 14 | Click a phone number link | `tel:` link triggers device dialer |
| 15 | Click website/social links | Opens in new tab with correct URL |

### 1.4 Mobile

| # | Steps | Expected |
|---|-------|----------|
| 16 | Resize to < 768px | Hamburger menu appears; language/theme toggles disappear from header |
| 17 | Open hamburger menu | Full-screen menu opens with category accordion |
| 18 | Expand a category in mobile menu | Subcategories expand; others collapse |
| 19 | Select a subcategory | Menu closes; services filter to that category |
| 20 | Scroll down ~3 screens | "Back to top" button appears in bottom-right corner |
| 21 | Click "Back to top" | Scrolls to top; button disappears |

---

## 2. Add Service Form

### 2.1 Happy Path

| # | Steps | Expected |
|---|-------|----------|
| 22 | Navigate to `/add-service` | Form renders with all fields |
| 23 | Fill all required fields with valid data, submit | Loading spinner appears; success screen shown with green checkmark |
| 24 | Click "Submit Another" on success screen | Form resets completely — all fields cleared, images gone |
| 25 | Check Supabase `services` table | New row with `approved = false` |

### 2.2 Validation UX

| # | Steps | Expected |
|---|-------|----------|
| 26 | Focus then blur "Business Name" without typing | Error message appears under the field |
| 27 | Type an invalid email, blur | "Invalid email" error shown |
| 28 | Type a valid email | Error clears immediately |
| 29 | Click Submit with all fields empty | All required field errors shown at once; page scrolls to first error |
| 30 | Enter `example.com` (no protocol) in Website | Error: "Invalid website URL" |
| 31 | Enter `https://twitter.com/user` in Instagram field | Error: "Invalid Instagram URL" |
| 32 | Enter `https://instagram.com/user` in Instagram field | No error |

### 2.3 Character Counters

| # | Steps | Expected |
|---|-------|----------|
| 33 | Type in Business Name — normal length | Counter shows gray `X/100` |
| 34 | Type 90+ characters in Business Name | Counter turns red |
| 35 | Try to type past 100 characters | Input stops accepting characters (`maxLength` attribute) |
| 36 | Type 550+ characters in Description EN | Counter turns red, still allows typing up to 600 |

### 2.4 Category Combobox

| # | Steps | Expected |
|---|-------|----------|
| 37 | Click category field | Dropdown opens grouped by parent category |
| 38 | Type "den" | Filters to subcategories containing "den" (case-insensitive) |
| 39 | Type "XYZ" (no match) | "No results" message shown |
| 40 | Press Backspace to clear | All categories shown again |
| 41 | Select a subcategory | Dropdown closes; field shows selected value |

### 2.5 Image Upload

| # | Steps | Expected |
|---|-------|----------|
| 42 | Click "+" and select a valid image | Upload spinner → thumbnail appears on success |
| 43 | Drag and drop an image onto the upload area | Same as above |
| 44 | Upload 5 images | "+" button disappears (max reached) |
| 45 | Try to drop a `.pdf` or `.txt` file | File is silently ignored; no error, no upload |
| 46 | Try to upload an image > 5MB | Error shown: "imageTooLarge" |
| 47 | Click the ✕ on a thumbnail | Image removed from UI; Cloudinary deletion fires in background |
| 48 | Drag thumbnail to a new position | Images reorder; dragged item shows 40% opacity; drop target shows blue ring |
| 49 | Start uploading an image, immediately click ✕ | Image removed; after upload completes in background, Cloudinary deletion fires |
| 50 | Upload images, then navigate away | `sendBeacon` fires to delete uploaded images (check Network tab — `DELETE /api/delete-image`) |
| 51 | Submit while an image is still uploading | Submit button disabled and shows "Please wait for images to upload" |

---

## 3. Admin

### 3.1 Auth & Access Control

| # | Steps | Expected |
|---|-------|----------|
| 52 | Navigate to `/admin` without being logged in | Immediate redirect to `/admin/login`; no admin content visible even briefly |
| 53 | Navigate to `/admin/services` without auth | Same redirect; no flash of content |
| 54 | Log in with valid credentials | Redirected to `/admin` queue |
| 55 | Log in with wrong password | Error message shown; no redirect |
| 56 | Log in, then manually expire session in Supabase dashboard | Should redirect to `/admin/login` automatically (auth state listener) |
| 57 | Log in, click "Sign out" | Redirected to `/admin/login` |
| 58 | After signing out, click browser back button | Returns to `/admin/login` (not cached admin page) |

### 3.2 Queue

| # | Steps | Expected |
|---|-------|----------|
| 59 | Submit a service via the form (test 22) | New entry appears in admin queue |
| 60 | Click "Approve" on a pending service | Item disappears from queue; check Supabase — `approved = true` |
| 61 | Click "Delete", then Cancel in confirmation | Nothing happens |
| 62 | Click "Delete", then OK | Item disappears from queue; row deleted from Supabase |
| 63 | Approve all items | "✓ No pending submissions" empty state shown |

### 3.3 Services List & Edit

| # | Steps | Expected |
|---|-------|----------|
| 64 | Search by title in services list | Filters results in real time |
| 65 | Filter by "Pending" | Only shows `approved = false` services |
| 66 | Click any row | Edit panel slides in from right; overlay covers left side |
| 67 | Press Escape | Panel closes |
| 68 | Click the overlay area | Panel closes |
| 69 | Toggle "Approved" checkbox | Changes immediately in form state (not saved until "Save") |
| 70 | Check "Featured", set order to 2, save | Service appears in featured section on homepage in position 2 |
| 71 | Uncheck "Featured", save | `featured_order` clears; service leaves featured section |
| 72 | Reorder images in edit panel, save | Image order persists on next open; homepage shows new order |
| 73 | Save with empty required field | Error message shown in panel |
| 74 | Click "Delete" in edit panel, confirm | Service deleted; panel closes; list updates |

---

## 4. Security

### 4.1 HTTP Security Headers

Open DevTools → Network tab → click any request → Response Headers.

| # | Header | Expected value |
|---|--------|----------------|
| 75 | `Content-Security-Policy` | Contains `default-src 'self'`, `frame-src 'none'`, `object-src 'none'` |
| 76 | `X-Frame-Options` | `DENY` |
| 77 | `X-Content-Type-Options` | `nosniff` |
| 78 | `Referrer-Policy` | `strict-origin-when-cross-origin` |
| 79 | `Permissions-Policy` | Contains `camera=()`, `microphone=()`, `geolocation=()` |

Or via curl:
```bash
curl -I https://spilno.us | grep -iE "content-security|x-frame|x-content-type|referrer|permissions"
```

### 4.2 Rate Limiting

| # | Steps | Expected |
|---|--------|----------|
| 80 | Submit 3 services with the same email address | All 3 accepted |
| 81 | Submit a 4th with the same email within 24h | HTTP 429 — "Too many submissions. Please try again later." |
| 82 | Submit with a different email | Accepted (limit is per-email) |

### 4.3 Honeypot

```bash
curl -X POST https://spilno.us/api/submit-service \
  -H "Content-Type: application/json" \
  -d '{"honeypot":"filled","businessName":"Bot","email":"bot@x.com","phone":"555","category":"Massage","descriptionEn":"x","descriptionUa":"x"}'
```
**Expected:** HTTP 200 `{"success":true}` (silent accept — bot doesn't know it was rejected)

### 4.4 Cloudinary Delete Protection

```bash
# Should fail — path not in configured upload folder
curl -X POST https://spilno.us/api/delete-image \
  -H "Content-Type: application/json" \
  -d '{"publicId":"../../etc/passwd"}'
```
**Expected:** HTTP 400 — forbidden path

```bash
# Should fail — no publicId
curl -X POST https://spilno.us/api/delete-image \
  -H "Content-Type: application/json" \
  -d '{}'
```
**Expected:** HTTP 400

---

## 5. Edge Cases

| # | Scenario | Expected |
|---|----------|----------|
| 83 | Navigate to `/nonexistent-route` | Custom 404 page shown (not a blank page) |
| 84 | Service with no images | Card renders without image section; no broken image icons |
| 85 | Service with broken image URL | Image hidden (`onError` handler); other images still show |
| 86 | Very long business name | Card layout doesn't break; text wraps or truncates gracefully |
| 87 | Switch language while services are loading | No crash; language applies when services render |
| 88 | Open the site with JavaScript disabled | Does not apply (React SPA requires JS) |
