# Google Analytics 4 Setup

This guide covers adding GA4 to the Ukrainians in Texas app. No extra npm packages needed — uses the native `gtag.js` script.

---

## Step 1 — Create a GA4 Property

1. Go to [analytics.google.com](https://analytics.google.com)
2. Sign in with the account that should own the property (the site owner's Google account)
3. Click **Admin** (bottom-left gear icon)
4. Under **Account**, click **Create Account** (if you don't have one yet)
   - Account name: e.g. `Spilno`
5. Under **Property**, click **Create Property**
   - Property name: `spilno.us`
   - Timezone: `United States — Central Time`
   - Currency: `US Dollar`
6. Choose **Web** as the platform
7. Enter:
   - Website URL: `https://spilno.us`
   - Stream name: `spilno.us`
8. Click **Create stream**
9. Copy your **Measurement ID** — it looks like `G-XXXXXXXXXX`

---

## Step 2 — Add the Script to index.html

Open `index.html` and add the following two snippets inside `<head>`, **after** the existing `<meta>` tags:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Replace both instances of `G-XXXXXXXXXX` with your actual Measurement ID.

---

## Step 3 — Track Page Views on Route Changes

GA4's default script only fires once on initial load. Since this is a single-page app (React Router), you need to fire a page view event on every navigation.

Create a new file `src/components/Analytics.jsx`:

```jsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function Analytics() {
    const location = useLocation();

    useEffect(() => {
        if (typeof window.gtag !== "function") return;
        window.gtag("event", "page_view", {
            page_path: location.pathname + location.search,
        });
    }, [location]);

    return null;
}
```

Then add it to `src/App.jsx` inside the `<Router>` (but outside any `<Routes>`):

```jsx
import { Analytics } from "./components/Analytics";

// Inside your Router:
<Router>
  <Analytics />
  <Routes>
    ...
  </Routes>
</Router>
```

---

## Step 4 — Verify It's Working

1. Deploy to Vercel (or run locally with `npm run dev`)
2. Open your site in a browser
3. In Google Analytics → **Reports** → **Realtime** — you should see yourself as an active user
4. Navigate between pages — each route change should register a new page view

---

## What Gets Tracked by Default

GA4 automatically tracks:

| Event | What it is |
|-------|------------|
| `page_view` | Every route change (after Step 3) |
| `session_start` | New visitor session |
| `first_visit` | First time a user visits |
| `scroll` | When user scrolls 90% down a page |
| `click` | Outbound link clicks |

---

## Optional — Track Custom Events

You can fire custom events anywhere in the app using:

```js
window.gtag("event", "search", {
    search_term: query,
});

window.gtag("event", "category_click", {
    category_name: "Cleaning",
});

window.gtag("event", "form_submit", {
    form_name: "add_service",
});
```

Useful events to consider adding:
- Search query typed in the hero bar
- Category selected from dropdown
- "Add service" form submitted successfully
- Phone/email/website link clicked on a service card

---

## Privacy & Cookie Consent

GA4 uses cookies (`_ga`, `_ga_*`) to track users across sessions.

**If you have EU visitors**, you are required by GDPR to show a cookie consent banner before loading Analytics. For MVP, this can be skipped since the primary audience is Texas-based.

If you add consent later, use `gtag('consent', 'update', {...})` to enable tracking only after the user agrees.

---

## Viewing Reports

| Report | Where to find it |
|--------|-----------------|
| Active users right now | Reports → Realtime |
| Page views over time | Reports → Engagement → Pages and screens |
| Search terms | Create a custom event for searches |
| Traffic sources | Reports → Acquisition → Traffic acquisition |
| Device breakdown | Reports → Tech → Tech overview |
