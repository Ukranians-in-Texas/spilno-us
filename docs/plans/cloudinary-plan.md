# Cloudinary Integration Plan

## What changes and why

### 1. `src/components/AddServiceForm/AddServiceForm.jsx`
- Add `uploadToCloudinary(file)` helper — POSTs directly to Cloudinary's unsigned upload API using two `VITE_` env vars (safe to expose for unsigned presets)
- Add `images` state: array of `{ id, previewUrl, cloudUrl, status: 'uploading'|'done'|'error' }`
- Add file input in the Optional section — max 5 files, 5 MB each, `accept="image/*"`
- Show thumbnails with a remove button; spinner overlay while uploading; red tint on error + retry button
- Block submit while any image is still uploading
- Include `imageUrls` (array of Cloudinary URLs) in the POST body

### 2. `api/submit-service.js`
- Destructure `imageUrls` from request body
- Validate: cap at 5 URLs, confirm each starts with `https://res.cloudinary.com/` before saving
- Save as comma-separated string in the Airtable `images` field

### 3. `src/utils/imageUrl.js`

- Add `getCloudinaryUrl(url)` helper that appends `f_auto,q_auto,w_800` transform params to Cloudinary URLs for automatic WebP/AVIF conversion and quality optimization
- Keep `convertGoogleDriveUrl` unchanged — existing Google Drive entries continue to work
- Update `parseImageUrls` to route each URL through the right helper based on origin

### 4. `src/i18n/en.json` + `ua.json`

- Add to `addService.fields`: `images`, `imagesHint` ("Up to 5 photos, max 5 MB each"), `imagesAdd` ("Add photos")
- Add to `addService.errors`: `imageTooLarge` ("File exceeds 5 MB limit"), `imageUploadFailed` ("Upload failed. Click to retry.")

### 5. `.env.example` + `.env`

- `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` — already added

### 6. Gallery / Lightbox components

- Verify that adding Cloudinary transform params in `imageUrl.js` doesn't break the Lightbox (which may want full-res)
- Use `w_800` transforms for thumbnails/cards; use a separate `w_1600` or no transform for the lightbox full-size view
- Confirm `loading="lazy"` is on all `<img>` tags in the gallery

### 7. Cleanup: remove `VITE_GOOGLE_FORM_URL`

- Remove from `.env`, `.env.example`, and any code that references it (replaced by the custom Add Service form)

### 8. Update `docs/DECISIONS.md`

- Decision 3 (Image Hosting) currently says "Google Drive — Accepted"; update to reflect migration to Cloudinary

---

## Known tradeoffs (accepted for MVP)

**Orphaned uploads:** Images are uploaded to Cloudinary the moment a user selects them — before form submission. If the user abandons the form, those images stay in Cloudinary. Low concern at this scale.

---

## Cloudinary one-time setup (manual)

1. Create a free account at cloudinary.com

2. Go to **Settings → Upload → Upload presets → Add upload preset**
3. Set **Signing mode** to **Unsigned**
4. Set a **Folder** (e.g. `spilno`) to keep uploads organized
5. Set **Allowed formats**: `jpg, jpeg, png, webp, gif`
6. Set **Max file size**: 5 MB
7. Copy the preset name and your cloud name → paste into `.env` (local) and Vercel env vars
