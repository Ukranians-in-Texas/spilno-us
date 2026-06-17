# Add Service Form — Implementation Plan

## Overview

Replace the external Google Form link with a native `/add-service` page.
Submissions go directly to Airtable with `approved = false`. Admin reviews in Airtable and checks the `approved` checkbox to publish.

---

## Route

`/add-service` — new page, linked from the existing "Add service" buttons in Header and ServiceList.

---

## Form Fields

| # | Label (EN) | Label (UA) | Airtable Field | Type | Required |
| --- | --- | --- | --- | --- | --- |
| 1 | Category | Категорія | `category` | dropdown (subcategory list from `categories.js`) | yes |
| 2 | Business name | Назва бізнесу | `title` | text | yes |
| 3 | Description (English) | Опис англійською | `description_en` | textarea | yes |
| 4 | Description (Ukrainian) | Опис українською | `description_ua` | textarea | yes |
| 5 | Phone number | Номер телефону | `phone` | tel | yes |
| 6 | Email | Електронна пошта | `email` | email | yes |
| 7 | Address | Адреса | `address` | text | no |
| 8 | Website | Вебсайт | `website` | url | no |
| 9 | Instagram | Instagram | `instagram` | url | no |
| 10 | Facebook | Facebook | `facebook` | url | no |
| 11 | LinkedIn | LinkedIn | `linkedin` | url | no |

> **Images: deferred.** The Google Form stored Google Drive URLs in a `multilineText` field.
> Implementing file upload requires external storage (e.g. Cloudinary). Excluded from MVP.
> Admin can add images manually in Airtable after approval.
>
> **Messenger: deferred.** Will be added in a future iteration.

---

## Category Selector

Single searchable combobox — user types to filter and selects a **subcategory**.
Parent categories are non-selectable group headers in the dropdown (e.g. "Beauty & Wellness" as a heading, "Brow & Lash Services" as a selectable option underneath).

- Built with `@headlessui/react` `Combobox` component (handles ARIA, keyboard nav, focus management)
- Styled with Tailwind only (headlessui is fully unstyled)
- Only subcategories are selectable; parent categories are visual separators only
- Data source: `src/data/categories.js` (already in the project)
- New dependency: `npm install @headlessui/react` (v2.x — compatible with React 19)

---

## Validation

Validated client-side on blur + on submit. Required fields also validated server-side.

| Field | Rule |
| --- | --- |
| Category | Must be a value from the known subcategory list |
| Business name | Non-empty |
| Description EN | Non-empty |
| Description UA | Non-empty |
| Phone | Loose format — allows `+`, digits, spaces, `-`, `()` (covers US and Ukrainian numbers) |
| Email | Valid email format |
| Website | Must start with `https://` or `http://` (if provided) |
| Instagram | Must match `instagram.com/` domain (if provided) |
| Facebook | Must match `facebook.com/` domain (if provided) |
| LinkedIn | Must match `linkedin.com/` domain (if provided) |

Error messages shown inline below each field on blur and on submit attempt.

---

## Spam Protection

**Honeypot field** — simplest, zero user friction.

- A hidden `<input>` field named something innocuous (e.g. `website_url`) is added to the DOM but hidden with CSS (`display: none` / off-screen positioning — NOT `display:none` in inline style, bots see that).
- If the field has any value on submit → silently reject (return 200 so bots don't retry).
- No API keys or third-party services needed.

---

## Submission Flow

```text
User fills form → POST /api/submit-service
  → Vercel serverless function validates + honeypot check
  → POST to Airtable REST API
    → record created with approved=false
  → return 200 { success: true }

Admin sees new record in Airtable
  → reviews it
  → checks "approved" checkbox
  → record appears in the UI automatically (existing filter in /api/services already filters by approved=true)
```

---

## API — New Serverless Function

`api/submit-service.js`

- Method: `POST`
- Reads `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE_NAME` from env (same pattern as `api/_lib/airtable.js`, fallback `|| 'Services'`)
- Validates required fields server-side
- Honeypot check
- Submits to Airtable with `approved: false`
- Returns `{ success: true }` or `{ error: "..." }`

---

## Styling

Matches the existing design system — Tailwind utility classes only, light + dark theme.

**Page layout** — same pattern as `PrivacyPage`:

- Page background: `bg-light-gray dark:bg-light-gray` (CSS var adapts automatically)
- Content container: `max-w-2xl mx-auto px-4 py-12`

**Form card** — same as `ServiceCard`:

- `bg-white dark:bg-[#0F2040] rounded-[30px] shadow-card p-6 md:p-8`

**Input / Textarea fields:**

- `w-full rounded-xl border border-stroke bg-white dark:bg-[#0A1628] text-text px-4 py-3 text-base`
- Focus: `focus:outline-none focus:border-brand-blue`
- Dark placeholder: `placeholder:text-text/40`
- Error state: `border-brand-red`

**Labels:**

- `text-sm font-bold text-dark-blue mb-1`

**Hint text** (e.g. "Leave blank if no address"):

- `text-xs text-text/50 mt-1`

**Error messages:**

- `text-xs text-brand-red mt-1`

**Section divider** (optional fields grouped separately):

- `border-t border-stroke pt-6` with a heading like "Optional" in `text-sm text-text/50`

**Submit button** — existing `Button` component, `variant="primary"` (brand-red, full width on mobile)

**Success / Error states** — inline message below the form, not a separate page:

- Success: `text-brand-blue` with a checkmark icon
- Error: `text-brand-red` with retry option

**Combobox dropdown** (headlessui):

- Options panel: `bg-white dark:bg-[#0F2040] border border-stroke rounded-2xl shadow-card mt-1`
- Group header (parent category): `text-xs font-bold text-text/50 uppercase px-3 pt-3 pb-1`
- Option: `px-3 py-2 text-base text-text cursor-pointer`
- Active option: `bg-light-gray dark:bg-[#1E3A5F] text-dark-blue`

---

## Frontend

### New files

- `src/pages/AddServicePage.jsx` — page wrapper with `<Header>` + `<Footer>`, same structure as `PrivacyPage`
- `src/components/AddServiceForm/AddServiceForm.jsx` — the form component; uses `<form noValidate>` to disable browser native validation

### Input `autocomplete` attributes

| Field | `autoComplete` value |
| --- | --- |
| Business name | `organization` |
| Phone | `tel` |
| Email | `email` |
| Address | `street-address` |
| Website | `url` |

### Existing files to update

- `src/App.jsx` (or router config) — add `/add-service` route
- `src/components/UI/Button.jsx` — add `to` prop: when provided, renders React Router `<Link to={to}>` instead of `<a href>`; existing `href` prop (external links, new tab) unchanged
- `src/components/Header/Header.jsx` — replace `href={googleFormUrl}` with `to="/add-service"` on Button
- `src/components/Header/MobileMenu.jsx` — same
- `src/components/ServiceList/ServiceList.jsx` — same
- `src/pages/PrivacyPage.jsx` — update hardcoded "submitted via a public Google Form" text
- `src/components/UI/Icon.jsx` — add `SpinnerIcon`
- `src/i18n/en.json` — add form translations
- `src/i18n/ua.json` — add form translations
- `CLAUDE.md` — remove `VITE_GOOGLE_FORM_URL` env var (no longer needed)

### States

- Idle — form ready to fill
- Submitting — button disabled, spinner (`SpinnerIcon` added to `Icon.jsx`, animated with Tailwind `animate-spin`)
- Success — form resets, confirmation message shown + "Back to home" link
- Error — error message with retry option

---

## i18n Keys to Add

Both `en.json` and `ua.json` must be updated. EN keys shown below; UA translations written during implementation.

```json
"addService": {
  "pageTitle": "Add your service",
  "subtitle": "Fill in the form below and we'll review your submission.",
  "fields": {
    "category": "Category",
    "categoryPlaceholder": "Search for a service...",
    "businessName": "Business name",
    "descriptionEn": "Description (English)",
    "descriptionUa": "Description (Ukrainian)",
    "phone": "Phone number",
    "email": "Email",
    "address": "Address",
    "addressHint": "Leave blank if your service has no physical address",
    "website": "Website",
    "websiteHint": "Leave blank if you don't have a website",
    "instagram": "Instagram",
    "instagramHint": "Format: https://instagram.com/USERNAME",
    "facebook": "Facebook",
    "facebookHint": "Format: https://facebook.com/USERNAME",
    "linkedin": "LinkedIn",
    "linkedinHint": "Format: https://linkedin.com/USERNAME"
  },
  "errors": {
    "categoryRequired": "Please select a category",
    "businessNameRequired": "Please enter your business name",
    "descriptionEnRequired": "Please enter a description in English",
    "descriptionUaRequired": "Please enter a description in Ukrainian",
    "phoneRequired": "Please enter your phone number",
    "phoneInvalid": "Please enter a valid phone number",
    "emailRequired": "Please enter your email",
    "emailInvalid": "Please enter a valid email address",
    "websiteInvalid": "Website must start with https:// or http://",
    "instagramInvalid": "Must be a valid instagram.com URL",
    "facebookInvalid": "Must be a valid facebook.com URL",
    "linkedinInvalid": "Must be a valid linkedin.com URL",
    "consentRequired": "Please agree to the terms to submit"
  },
  "optionalSection": "Optional",
  "consent": "I agree that this information will be publicly listed in the directory",
  "consentLink": "Privacy Policy",
  "required": "Required",
  "submit": "Submit",
  "submitting": "Submitting...",
  "success": "Thank you! Your listing has been submitted and will appear after review.",
  "backHome": "Back to home",
  "error": "Something went wrong. Please try again.",
  "retry": "Try again"
}
```

---

## Open Question — Images

Skipping for MVP. When ready to add image upload, options:

- **Cloudinary** (recommended) — free tier, simple upload widget, returns URL to store in Airtable
- **Airtable Attachments API** — would require changing `images` field type from `multilineText` to `multipleAttachments`

---

## Consent Checkbox

Required field at the bottom of the form, above the submit button:
> "I agree that this information will be publicly listed in the directory" + link to Privacy Policy

Form cannot be submitted without checking it.

---

## Out of Scope (MVP)

- Image upload
- Messenger field
- Scroll to first error on submit
- Min length / character count on description fields
- API rate limiting
- Accessibility (aria-describedby for error messages)
- Email confirmation to submitter
- Duplicate detection
- reCAPTCHA
- Admin dashboard on the website (Airtable serves as admin UI)
