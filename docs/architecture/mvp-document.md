# Ukrainians in Texas — MVP Document

## Project Overview

A service directory platform connecting Ukrainian professionals in Texas with people seeking their services. Users can browse, search, and filter service providers. Providers can submit their listings via a public form.

**Tech Stack:**

- Frontend: React (Vite)
- Styling: Tailwind CSS
- Data: Airtable
- Image Storage: Google Drive (via form uploads)
- Hosting: Vercel (frontend + serverless API)
- Service Submissions: Google Form → Airtable (via Zapier/Make or manual import)
- Architecture: Clean, simple, component-based

---

## Design System

### Colors

| Name | HEX | Usage |
|------|-----|-------|
| Dark Blue | `#00205B` | Primary brand, headers, logo |
| Blue | `#0057B7` | Links, accents |
| Red | `#E52459` | CTA buttons, highlights |
| Text | `#091832` | Body text |
| Gray | `#EBEBEB` | Backgrounds, dividers |
| Light Gray | `#F5F5F5` | Card backgrounds |
| Stroke | `#00205B` (15% opacity) | Borders |
| White | `#FFFFFF` | Backgrounds |

### Typography

- Font: Inter
- Weights: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

### Effects

- Card shadow: `0 4px 44px rgba(0, 0, 0, 0.12)`

---

## Pages & Features

### 1. Homepage

**Header:**

- Logo: "Ukrainians in Texas" with Texas outline icon
- "All Services" dropdown (category menu)
- Language selector (US/UA flags) — UI translation only
- "Add service" CTA button (red)
- Mobile: Hamburger menu

**Hero Section:**

- Headline: "100+ trusted Ukrainian professionals across Texas — verified, local, human."
- Subtext: "Discover reliable services offered by the Ukrainian community across Texas — from hairstylists to handymen."
- Search bar with placeholder "Search for services..."
- Quick filter tags: Lawyer, Cleaning, Health/Medical, Handyman (popular categories)

**Highlighted Specialists Section:**

- Title: "Highlighted Specialists"
- Display 6 service cards (3 per row desktop, 2 per row tablet, 1 per row mobile)
- Logic: Show newest 6 approved listings (sorted by submittedAt descending)

**Service Cards (2 variants):**

*Variant A — Without images:*

- Avatar placeholder (circle)
- Business name
- Category tags (pills)
- Address with pin icon
- Phone (clickable, blue link)
- Email (clickable, blue link)
- Website (clickable, blue link)
- Description (truncated with "Show more" toggle)
- Social icons: Instagram, Facebook, LinkedIn, Messenger

*Variant B — With images:*

- Image gallery (2x2 grid, last image shows "+N" for additional photos)
- Same info as Variant A below the images

### 2. Category Dropdown Menu

**Desktop:** Multi-column mega menu
**Mobile:** Accordion-style expandable list

**Categories & Subcategories:**

```
💄 Beauty & Wellness (Non-Medical)
   - Manicure / Nail Services
   - Haircuts / Hair Coloring
   - Massage
   - Facials & Skincare (Esthetician)
   - Cosmetology / Aesthetic Treatments
   - Makeup Services
   - Brow & Lash Services

🏥 Health & Medical
   - Doctors / Clinics
   - Dentistry
   - Optics
   - Physical Therapy / Rehabilitation
   - Mental Health (Psychologist / Counselor)
   - Nutritionist / Dietitian
   - Medical Aesthetics / Cosmetic Injections (Botox, Fillers, etc.)
   - Pharmacy

🏠 Home Services
   - Cleaning (Regular / Deep / Move-in / Move-out)
   - Handyman
   - Furniture Assembly
   - Junk Removal
   - Moving Help
   - Disinfection / Pest Control
   - Window / Carpet / Upholstery Cleaning

🛠️ Construction & Repairs
   - General Repairs
   - Painting / Drywall
   - Flooring Installation
   - Plumbing
   - Electrical Work
   - Roofing
   - Kitchen / Bathroom Remodeling
   - Appliance Repair & Installation
   - AC / Heater Service

🌿 Garden & Outdoor
   - Landscaping
   - Lawn Mowing
   - Tree Trimming
   - Irrigation Systems

🚗 Auto & Transportation
   - Car Repair / Mechanic
   - Car Detailing / Car Wash
   - Driving Lessons
   - Airport Transfers
   - Vehicle Buying / Selling Assistance

🍳 Food & Baking
   - Home Cooking
   - Cakes & Confectionery
   - Catering
   - Meal / Grocery Delivery

👨‍👩‍👧 Family & Education
   - Tutors / Language Teachers
   - Nannies
   - Kids Clubs / Activities
   - Playground & Kids Events
   - Music / Art Classes for Kids

⚖️ Legal & Documents
   - Lawyer
   - Immigration Lawyer
   - Notary Services
   - Translation Services
   - Taxes / Tax Assistance

🏡 Real Estate & Finance
   - Realtors / Brokers
   - Insurance (Auto / Medical / Property)
   - Banking & Financial Consulting
   - Mortgage / Rent Assistance

🧾 Business & Admin Support
   - Bookkeeping
   - Business Registration Help
   - HR / Recruiting
   - Office Administration

🎯 Career & Coaching
   - Career Coaching
   - Resume / CV Writing
   - Interview Preparation
   - Job Search Assistance
   - LinkedIn Profile Optimization

💻 IT & Tech Services
   - Computer / Laptop Repair
   - Phone Repair
   - Network / Wi-Fi Setup
   - Website Development
   - Smart Home Installation

🎨 Creative & Digital
   - Photography
   - Videography
   - Video Editing
   - Graphic Design / Branding
   - Illustration / Art
   - Content Creation

📣 Marketing & Growth
   - Social Media Management
   - Advertising Setup (Google / Meta)
   - SEO
   - Marketing Strategy

🧵 Crafts, Sewing & Handmade
   - Handmade Products
   - Clothing Repair / Alterations
   - Tailoring / Custom Clothing
   - Embroidery
   - Floristry
   - Event Decorations

🎉 Events & Entertainment
   - Event Organization
   - Children's Parties
   - DJ / MC / Hosts
   - Equipment Rental (Tables, Chairs, Sound, Light)
   - Party Planning & Styling

🐾 Pet Services
   - Dog Walking
   - Pet Sitting
   - Grooming
   - Training
   - Vet Transport Assistance

🛡️ Security & Safety
   - Alarm Systems
   - Camera Installation

🛍️ Personal & Errand Services
   - Personal Shopper
   - Errand Running
   - Closet / Home Organization

❓ Other Services
   - Other / Custom Services
```

### 3. Mobile Menu (Hamburger)

When opened:

- Close (X) button
- "Add service" CTA button (full width, red)
- Language selector
- Search bar
- Quick filter tags
- Rest of page content below

### 4. Add Service (Google Form)

"Add service" button opens an external Google Form in a new tab.

**Google Form Fields:**

| Field | Type | Required |
|-------|------|----------|
| Business/Service Name | Short answer | Yes |
| Description | Paragraph (max 1000 chars) | Yes |
| Category | Dropdown (subcategories only) | Yes |
| Address | Short answer | No |
| Phone | Short answer | Yes |
| Email | Short answer (email validation) | Yes |
| Website | Short answer (URL) | No |
| Instagram | Short answer (URL) | No |
| Facebook | Short answer (URL) | No |
| LinkedIn | Short answer (URL) | No |
| Messenger | Short answer (URL) | No |
| Images | File upload (Google Drive) | No |

**Submission Flow:**

1. User clicks "Add service" → opens Google Form in new tab
2. User fills out form and submits
3. Response saved to Google Sheets (linked to form)
4. Images saved to Google Drive (auto-created folder)
5. Admin imports to Airtable (manual) or auto-syncs via Zapier/Make
6. Admin copies Google Drive shareable links for images → pastes in Airtable `images` field
7. Admin reviews → sets `approved: true` → listing goes live

**Image Handling:**

- Images uploaded via Google Form are stored in Google Drive
- Admin sets each image to "Anyone with the link can view"
- Shareable URLs stored in Airtable as comma-separated list
- Frontend displays images using Google Drive direct links

**URL Conversion Required:**

Google Drive share URLs don't work directly in `<img>` tags. Convert them:

```
Original:  https://drive.google.com/file/d/FILE_ID/view?usp=sharing
Convert to: https://drive.google.com/uc?export=view&id=FILE_ID
```

Extract the `FILE_ID` from the original URL and use the second format in Airtable.

**Why Google Form:**

- Built-in spam protection (reCAPTCHA)
- No custom form development needed
- File uploads handled by Google Drive
- Easy to edit fields without code changes
- Free and reliable

---

## Admin Workflow (Manual Process)

### Checking for New Submissions

1. Open Google Sheets (linked to Google Form)
2. Review new rows since last check
3. Recommended: Check daily or set up Google Sheets email notifications

### Importing to Airtable

For each new submission:

1. **Copy text fields** from Google Sheets to Airtable:
   - Business Name → `title`
   - Description → `description`
   - Category → `category`
   - Address → `address`
   - Phone → `phone`
   - Email → `email`
   - Website → `website`
   - Instagram → `instagram`
   - Facebook → `facebook`
   - LinkedIn → `linkedin`
   - Messenger → `messenger`

2. **Handle images** (if any):
   - Click the Google Drive link in the spreadsheet
   - Open each image file
   - Click "Share" → "Anyone with the link"
   - Copy the share URL
   - Convert URL format (see Image Handling section above)
   - Paste converted URLs into Airtable `images` field (comma-separated)

3. **Set metadata:**
   - `approved` → leave unchecked (review first)
   - `submittedAt` → set to submission date

### Approving Listings

1. Review listing for:
   - Legitimate business (not spam)
   - Complete information
   - Appropriate category
   - Valid contact info
2. Check `approved` = true
3. Listing appears on site immediately

### Time Estimate

- ~5 minutes per submission (with images)
- ~2 minutes per submission (no images)

> **Future improvement:** If volume exceeds 10/week, consider Zapier/Make automation for text fields.

---

## Data Architecture

### Airtable Schema

**Table: Services**

| Field | Type | Notes |
| ------- | ------ |------- |
| title | Single line text | Business name |
| description | Long text | Full description |
| category | Single select | Subcategory only (e.g., "Cleaning") |
| address | Single line text | Full address |
| phone | Phone number | Primary contact |
| email | Email | Primary email |
| website | URL | Business website |
| instagram | URL | Instagram profile |
| facebook | URL | Facebook page |
| linkedin | URL | LinkedIn profile |
| messenger | URL | Messenger link |
| images | Long text | Google Drive shareable URLs (comma-separated) |
| approved | Checkbox | Moderation status |
| submittedAt | Date | Auto-set on submission |

**Categories Table (Optional — for dynamic categories):**

| Field | Type |
| ------- | ------ |
| name | Single line text |
| icon | Single line text (emoji) |
| parentCategory | Single line text |

### API Endpoints (Vercel Serverless Functions)

Frontend calls these endpoints. Vercel functions proxy to Airtable securely.

```text
GET /api/services
→ Fetch all approved listings (sorted by submittedAt descending)
→ Optional query: ?category=Cleaning&limit=6
```

> **Note:** No POST endpoint needed — new listings are submitted via Google Form.

**Server-side flow:**

```text
Frontend → /api/services → Vercel Function → Airtable API
                              ↓
                    (API key stays on server)
```

---

## Security

### API Key Protection

Airtable API key is stored server-side only (Vercel environment variables). Frontend calls `/api/*` endpoints which proxy to Airtable. The API key never appears in client-side code or browser network requests.

### Spam Prevention

Handled by Google Forms (built-in reCAPTCHA). No custom implementation needed.

### XSS Prevention

- Use React's default JSX escaping (never use `dangerouslySetInnerHTML` with user content)
- All user-submitted text rendered as text nodes, not HTML

### URL Validation

**Protocol whitelist (when rendering links):**

- Only render `http://` and `https://` URLs as clickable links
- Block `javascript:`, `data:`, and other dangerous protocols

**External link attributes:**

- All external links use `target="_blank" rel="noopener noreferrer"`

---

## Project Structure

```text
ukrainians-in-texas/            # Root directory (monorepo)
│
├── api/                        # Vercel serverless functions (server-side)
│   ├── services.js             # GET /api/services
│   └── _lib/
│       └── airtable.js         # Airtable client (uses secret key)
│
├── src/                        # React frontend (client-side)
│   ├── components/
│   │   ├── Header/
│   │   │   ├── Header.jsx
│   │   │   ├── Logo.jsx
│   │   │   ├── CategoryMenu.jsx
│   │   │   ├── LanguageSelector.jsx
│   │   │   └── MobileMenu.jsx
│   │   ├── Hero/
│   │   │   ├── Hero.jsx
│   │   │   └── SearchBar.jsx
│   │   ├── ServiceCard/
│   │   │   ├── ServiceCard.jsx
│   │   │   ├── ImageGallery.jsx
│   │   │   └── SocialLinks.jsx
│   │   ├── ServiceList/
│   │   │   └── ServiceList.jsx
│   │   ├── CategoryFilter/
│   │   │   ├── CategoryFilter.jsx
│   │   │   └── QuickTags.jsx
│   │   └── UI/
│   │       ├── Button.jsx
│   │       ├── Input.jsx
│   │       ├── Tag.jsx
│   │       └── Icon.jsx
│   ├── pages/
│   │   └── HomePage.jsx
│   ├── services/
│   │   └── api.js              # Fetch calls to /api/* endpoints
│   ├── utils/
│   │   ├── validation.js       # URL validation for rendering links
│   │   └── imageUrl.js         # Google Drive URL conversion
│   ├── data/
│   │   └── categories.js       # Static category data
│   ├── i18n/
│   │   ├── en.json
│   │   └── ua.json
│   ├── hooks/
│   │   ├── useServices.js      # Fetch services from /api
│   │   └── useLanguage.js      # Language context
│   ├── context/
│   │   └── LanguageContext.jsx
│   ├── index.css               # Tailwind directives + custom styles
│   ├── App.jsx
│   └── main.jsx
│
├── docs/                       # Documentation
│   ├── MVP_DOCUMENT.md         # This file
│   ├── MVP_GAPS.md             # Edge cases and considerations
│   └── SECURITY_CONCERNS.md    # Security deep dive
│
├── public/                     # Static assets
│
├── .env.example                # Environment variable template (safe to commit)
├── .env                        # Actual secrets (NEVER commit - in .gitignore)
├── .gitignore                  # Git ignore rules
├── README.md                   # Project setup and documentation
├── package.json                # Dependencies and scripts
├── vite.config.js              # Vite configuration
├── tailwind.config.js          # Tailwind CSS configuration
└── vercel.json                 # Vercel configuration (optional)
```

### Environment Files

**`.env.example`** (safe to commit):

```env
# Client-side (public - will be in browser bundle)
VITE_GOOGLE_FORM_URL=https://forms.gle/your_form_id

# Server-side (secrets - NEVER commit actual values)
AIRTABLE_API_KEY=your_api_key_here
AIRTABLE_BASE_ID=your_base_id_here
AIRTABLE_TABLE_NAME=Services
```

**`.env`** (NEVER commit - add to `.gitignore`):

```env
# Your actual secrets
VITE_GOOGLE_FORM_URL=https://forms.gle/abc123
AIRTABLE_API_KEY=keyActualSecretValue123
AIRTABLE_BASE_ID=appActualBaseId456
AIRTABLE_TABLE_NAME=Services
```

**`.gitignore`**:

```gitignore
# Environment variables
.env
.env.local
.env.production

# Dependencies
node_modules/

# Build output
dist/
.vercel/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
```

> **Note:** No AddServiceForm or AddServicePage — "Add service" button links directly to Google Form.
>
> **Repository Structure:** Single monorepo with both frontend (`/src`) and serverless API (`/api`). The `/api` folder runs on Vercel's servers (server-side) and safely accesses Airtable credentials. The `/src` folder runs in the browser (client-side) and never sees the secrets.

---

## System Flow & Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    UKRAINIANS IN TEXAS                          │
│                    (React App on Vercel)                        │
└─────────────────────────────────────────────────────────────────┘
                            ▲
                            │
                    ┌───────┴────────┐
                    │                │
            ┌───────▼─────┐   ┌─────▼──────┐
            │   Visitors   │   │ Providers  │
            │   (Browse)   │   │  (Submit)  │
            └──────────────┘   └────────────┘
                    │                │
                    │                │
                    ▼                ▼
            ┌──────────────┐   ┌────────────────┐
            │  Vercel API  │   │  Google Form   │
            │  /api/...    │   │  (External)    │
            └──────────────┘   └────────────────┘
                    │                │
                    │                ▼
                    │          ┌────────────────┐
                    │          │ Google Sheets  │
                    │          └────────────────┘
                    │                │
                    │                ▼
                    │          ┌────────────────┐
                    │          │     Admin      │
                    │          │  (Reviews &    │
                    │          │   Approves)    │
                    │          └────────────────┘
                    │                │
                    │                ▼
                    │          ┌────────────────┐
                    └─────────►│   Airtable     │
                               │  (Database)    │
                               └────────────────┘
```

### Flow 1: Visitor Browsing Services

```
1. Visitor → ukrainians-in-texas.com
   │
2. React app loads in browser
   │
3. JavaScript: fetch('/api/services')
   │
   ├─ Request sent to Vercel serverless function
   │
4. Vercel function runs (SERVER-SIDE):
   │
   ├─ Reads process.env.AIRTABLE_API_KEY (secret, never exposed)
   │
   ├─ Calls Airtable API with authentication
   │
   ├─ Filters: WHERE approved = true
   │
   └─ Returns JSON to browser
   │
5. React receives data → renders ServiceCard components
   │
6. Visitor can:
   ├─ Search by keyword
   ├─ Filter by category
   ├─ Click phone/email/website
   └─ Switch language (EN ↔ UA)
```

**Key Security Point:** Browser NEVER sees Airtable API key. All database calls go through Vercel proxy.

### Flow 2: Service Provider Submission

```
1. Provider clicks "Add Service" button
   │
2. Opens Google Form in new tab (forms.google.com)
   │
3. Provider fills out:
   ├─ Business name, description, category
   ├─ Phone, email, social links
   └─ Images (uploads to Google Drive)
   │
4. Provider clicks "Submit"
   │
   ├─ Google reCAPTCHA validates (spam protection)
   │
5. Google saves to:
   ├─ Google Sheets (form responses)
   └─ Google Drive (images)
   │
6. Provider sees confirmation: "Thank you! Your submission has been received."
```

**Key Point:** No custom backend needed. Google handles spam protection and file uploads.

### Flow 3: Admin Review & Approval

```
1. Admin receives notification:
   ├─ Google Sheets email (optional)
   ├─ Airtable automation (optional)
   └─ Or checks manually
   │
2. Admin opens Google Sheets → reviews new submission
   │
3. Admin copies data to Airtable:
   ├─ Text fields → copy/paste
   ├─ Images → convert Google Drive URLs to direct links
   └─ Sets approved = unchecked (pending review)
   │
4. Admin reviews in Airtable:
   ├─ Legitimate business? ✓
   ├─ Complete information? ✓
   └─ Appropriate category? ✓
   │
5. Admin checks: approved = ✓
   │
6. Listing IMMEDIATELY appears on website
   └─ (on next page load/refresh)
```

**Time Estimate:** ~2-5 minutes per submission

### Technical Data Flow (with Secrets Protection)

```
┌─────────────────────────────────────────────────────────┐
│  BROWSER (Client-Side) — NO SECRETS HERE                │
│  ┌────────────────────────────────────────────────┐    │
│  │  React App                                     │    │
│  │  fetch('/api/services')                        │    │
│  └─────────────────┬──────────────────────────────┘    │
└────────────────────┼───────────────────────────────────┘
                     │
                     │ HTTP GET /api/services
                     │
┌────────────────────▼───────────────────────────────────┐
│  VERCEL (Server-Side) — SECRETS LIVE HERE              │
│  ┌─────────────────────────────────────────────────┐  │
│  │  /api/services.js                               │  │
│  │                                                  │  │
│  │  const key = process.env.AIRTABLE_API_KEY      │  │
│  │  (🔒 Secret - never exposed to browser)        │  │
│  │                                                  │  │
│  │  fetch('api.airtable.com', {                    │  │
│  │    headers: { Authorization: `Bearer ${key}` }  │  │
│  │  })                                              │  │
│  └─────────────────┬───────────────────────────────┘  │
└────────────────────┼───────────────────────────────────┘
                     │
                     │ HTTP GET + Auth Header
                     │
┌────────────────────▼───────────────────────────────────┐
│  AIRTABLE (External Database)                          │
│  ┌─────────────────────────────────────────────────┐  │
│  │  Table: Services                                │  │
│  │  Filter: WHERE approved = true                  │  │
│  │  Sort: ORDER BY submittedAt DESC                │  │
│  │  Returns: JSON array of approved listings       │  │
│  └─────────────────┬───────────────────────────────┘  │
└────────────────────┼───────────────────────────────────┘
                     │
                     │ JSON Response
                     │
┌────────────────────▼───────────────────────────────────┐
│  VERCEL (Server-Side)                                  │
│  ┌─────────────────────────────────────────────────┐  │
│  │  /api/services.js                               │  │
│  │  res.json(approvedListings)                     │  │
│  └─────────────────┬───────────────────────────────┘  │
└────────────────────┼───────────────────────────────────┘
                     │
                     │ JSON Response
                     │
┌────────────────────▼───────────────────────────────────┐
│  BROWSER (Client-Side)                                 │
│  ┌─────────────────────────────────────────────────┐  │
│  │  React receives data                            │  │
│  │  → Maps to ServiceCard components               │  │
│  │  → Renders on page                              │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Environment Variables (Secrets Management)

**Client-Side (VITE_ prefix - visible in browser):**

```env
VITE_GOOGLE_FORM_URL=https://forms.gle/your_form_id
```

**Server-Side (no prefix - secure):**

```env
AIRTABLE_API_KEY=keyXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXX
AIRTABLE_TABLE_NAME=Services
```

**Critical Rule:** Environment variables without `VITE_` prefix are ONLY accessible in `/api` folder (server-side). They never reach the browser.

### Deployment Flow

**Development:**

```bash
npm install              # Install dependencies
npm run dev             # Vite dev server (http://localhost:5173)
# OR
vercel dev              # Test with serverless functions locally
```

**Production:**

```bash
git push origin main    # Push to GitHub
                        # Vercel auto-detects and deploys:
                        # 1. Builds React app (npm run build)
                        # 2. Deploys /api serverless functions
                        # 3. Publishes to: ukrainians-in-texas.vercel.app
```

### Real-Time Updates

**When admin approves a listing:**

1. Admin clicks `approved = ✓` in Airtable
2. Data saved immediately
3. Website updates on next page load/refresh

**For MVP:** No auto-refresh (keeps it simple)

**Post-MVP:** Add React Query with 5-minute polling for auto-refresh

---

## User Flows

### Flow 1: Browse Services

1. User lands on homepage
2. Sees highlighted specialists
3. Can scroll to view more
4. Can click category menu to filter
5. Can use search bar
6. Clicks on phone/email → opens native app

### Flow 2: Search & Filter

1. User types in search bar
2. Results filter in real-time (name, description, category)
3. OR user clicks category from dropdown
4. Results show only matching services

### Flow 3: Submit Listing

1. User clicks "Add service" button
2. Google Form opens in new tab
3. User fills out form, uploads images (optional)
4. User submits → sees Google Form confirmation
5. Response saved to Google Sheets
6. Admin imports to Airtable (or auto-sync via Zapier)
7. Admin reviews → sets `approved: true` → listing goes live

### Flow 4: Change Language

1. User clicks language selector (flag icon)
2. Selects US/UA
3. UI text updates immediately
4. Preference saved to localStorage

---

## Empty States

### Empty Category

When a user selects a category that has no approved listings:

- Message: "No services in this category yet. Be the first to add yours!"
- "Add service" CTA button (red, links to Google Form)
- Centered layout with icon

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column, hamburger menu |
| Tablet | 768px - 1024px | 2 columns |
| Desktop | > 1024px | 3 columns, full mega menu |

---

## Environment Variables

**Client-side (VITE_ prefix — visible in browser):**

```env
VITE_GOOGLE_FORM_URL=https://forms.gle/your_form_id
```

**Server-side (Vercel serverless functions — never exposed):**

```env
AIRTABLE_API_KEY=your_api_key
AIRTABLE_BASE_ID=your_base_id
AIRTABLE_TABLE_NAME=Services
```

> **Security Note:** Airtable credentials are server-side only. The frontend calls `/api/services` which proxies requests to Airtable, keeping the API key secure.

---

## MVP Scope Summary

### ✅ Built

- Homepage with hero, search, highlighted specialists
- Category dropdown (desktop mega menu, mobile accordion)
- Service cards (with/without images)
- Search across name, description, category
- Category filtering
- Custom "Add service" form at `/add-service` with Cloudinary image upload
- Supabase integration via Vercel API proxy (public) + anon key + RLS (admin)
- Language switcher (EN/UA) — UI strings and listing descriptions (description_en / description_ua) both translated
- Mobile-responsive (mobile-first)
- Social links (open in new tab with `rel="noopener noreferrer"`)
- Contact links (tel:, mailto:, website)
- **Security: Serverless API proxy** (service key never exposed)
- **Security: XSS prevention** (React default escaping)
- **Security: URL validation** (http/https whitelist)
- Empty states (no results, no category listings, API error)
- Skeleton loaders for service cards (6 animated `animate-pulse` placeholder cards while data loads)
- 404 page
- Privacy Policy page (`/privacy`)
- Terms of Service page (`/terms`)
- Open Graph + Twitter Card meta tags
- Admin dashboard (`/admin`) — login, moderation queue, services table with edit panel
- Footer with contact, Privacy Policy, Terms of Service links

### ❌ Not built (post-MVP)

- User authentication (provider accounts)
- Provider self-editing listings
- Location-based filtering
- In-app messaging
- Paid/premium listings
- Reviews/ratings
- Analytics (Google Analytics / Plausible not yet set up)
- Cookie consent banner
- Admin email notifications on new submissions
- Individual listing pages (`/services/:id`)

---

## Tailwind Configuration

```js
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        'dark-blue': '#00205B',
        'blue': '#0057B7',
        'red': '#E52459',
        'text': '#091832',
        'gray': '#EBEBEB',
        'light-gray': '#F5F5F5',
        'stroke': 'rgba(0, 32, 91, 0.15)',
      },
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 4px 44px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
}
```

---

## Vercel Configuration

Vercel auto-detects Vite projects and `/api` folder. No `vercel.json` required for basic setup.

**Optional `vercel.json` (only if needed):**

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" }
  ]
}
```

> **Note:** Create `vercel.json` only if you encounter routing issues. Most projects work without it.

---

## Implementation Order

1. **Setup** — Vite + React + Tailwind, folder structure, tailwind.config.js
2. **Google Form** — Create form with all fields, get shareable link
3. **Vercel API Setup** — Create `/api` folder, serverless functions for Airtable proxy
4. **Static Components** — Header, Logo, Button, Tag, Icon components
5. **Categories Data** — Static categories.js with all subcategories
6. **API Service** — Frontend fetch calls to `/api/*` endpoints
7. **Homepage** — Hero, SearchBar, ServiceList, ServiceCard
8. **Category Menu** — Desktop mega menu, mobile accordion
9. **Search & Filter** — Real-time filtering logic
10. **Language Switcher** — i18n context, JSON files, localStorage
11. **Responsive Polish** — Mobile-first tweaks, testing
12. **Deploy to Vercel** — Connect repo, set environment variables
13. **Connect Google Form to Airtable** — Via Zapier/Make or manual import

---

## Success Metrics (Post-MVP)

- Number of approved listings
- "Add service" button clicks (track via analytics)
- Search usage
- Category clicks
- Mobile vs desktop traffic
