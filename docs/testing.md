# Spilno.us — Testing Guide

How the test suite is structured, how to run it, and how to add to it. For implementation details, see [technical-guide.md §9](technical-guide.md#9-testing).

---

## Running the tests

```bash
# Unit + component tests (fast, no server needed)
npm test

# Watch mode
npm run test:watch

# E2E tests (starts the dev server automatically)
npm run test:e2e

# E2E with headed browser (useful for debugging)
npm run test:e2e -- --headed
```

---

## Unit tests — Vitest

**Config:** [vitest.config.js](../vitest.config.js) — merges into the Vite config, excludes `tests/e2e/`.

**What's covered (111 tests, 8 files):**

All external services (Supabase, Telegram, Cloudinary) are mocked with `vi.mock()` — no real network or database calls.

| File | Tests | Covers |
| ---- | ----- | ------ |
| `api/submit-service.test.js` | 32 | All validation rules, honeypot (silent 200), rate limiting (including fail-closed on DB error), image URL filtering, success/error paths |
| `api/telegram-webhook.test.js` | 15 | Secret header check, UUID/action validation, approve (idempotent), delete (with Cloudinary cleanup), error paths |
| `api/cleanup-images.test.js` | 13 | Orphan detection, 48h grace period, pagination, empty/null data handling, Cloudinary failures, Telegram alerts |
| `api/delete-image.test.js` | 10 | Auth (no header, non-Bearer, invalid token, null user), method check, publicId validation, Cloudinary success/error |
| `api/_lib/telegram.test.js` | 11 | Message building, HTML escaping (`&<>"`), notification payload with inline keyboard |
| `api/_lib/cloudinary.test.js` | 8 | Public ID extraction from URL, single delete, CSV batch delete |
| `src/utils/validation.test.js` | 16 | `formatPhone`, `isValidURL`, `getSafeHref`, `getDomain` |
| `src/utils/imageUrl.test.js` | 6 | `getCloudinaryPublicId`, `parseImageUrls` (transform injection) |

### Adding a unit test

Drop a `*.test.js` file next to the source file it covers. Vitest picks it up automatically.

```js
// api/_lib/myModule.test.js
import { describe, it, expect, vi } from 'vitest';

vi.mock('./_lib/supabase.js', () => ({ getSupabaseAdmin: vi.fn() }));

describe('myModule', () => {
  it('does the thing', () => {
    expect(myFunction('input')).toBe('expected');
  });
});
```

API tests run in Node environment (default). Component tests need `jsdom` — see below.

---

## Component tests — React Testing Library

**Config:** same [vitest.config.js](../vitest.config.js) with `environment: 'jsdom'`. The setup file ([tests/setup.js](../tests/setup.js)) loads `@testing-library/jest-dom` matchers, auto-cleans the DOM between tests, and polyfills `localStorage` for Node 26 + jsdom 29.

### Node 26 + jsdom 29 localStorage issue

Node 26 added an experimental `globalThis.localStorage` property that is `undefined` unless the `--localstorage-file` flag is passed. This shadows jsdom's own working `localStorage` implementation — even though jsdom sets up `window.localStorage`, the bare `localStorage` reference in component code resolves to Node's `undefined` version instead.

The polyfill in [tests/setup.js](../tests/setup.js) detects this and assigns a simple in-memory `localStorage` to `globalThis`. If you upgrade Node or jsdom and tests start failing with `Cannot read properties of undefined (reading 'clear')` or `Cannot read properties of undefined (reading 'getItem')`, this is the place to look.

**What's covered (32 tests, 5 files):**

| File | Tests | Covers |
| ---- | ----- | ------ |
| `src/pages/HomePage.test.jsx` | 8 | Search filtering by title, description, address; case-insensitive; clear restores all; no-match shows empty state |
| `src/components/AddServiceForm/AddServiceForm.test.jsx` | 8 | Required field labels render; all validation errors (empty submit, email format, phone format, URL format, name length, consent); no errors before interaction |
| `src/components/ServiceList/ServiceList.test.jsx` | 5 | Loading skeletons, error state with retry button, empty state message, service cards render, section title |
| `src/context/ThemeContext.test.jsx` | 5 | Default light, toggle adds/removes `dark` class on `<html>`, localStorage persistence and restore |
| `src/context/LanguageContext.test.jsx` | 6 | Default English, `t()` translation, toggle EN↔UA, localStorage persistence and restore, missing key returns the key |

### Adding a component test

Create a `*.test.jsx` file next to the component. Wrap with the providers the component needs:

```jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../context/LanguageContext';
import { MyComponent } from './MyComponent';

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <LanguageProvider>{ui}</LanguageProvider>
    </MemoryRouter>
  );
}

describe('MyComponent', () => {
  it('renders the title', () => {
    renderWithProviders(<MyComponent />);
    expect(screen.getByText('Expected text')).toBeInTheDocument();
  });
});
```

Most components need `MemoryRouter` (for `<Link>`) and `LanguageProvider` (for `t()`). Add `ThemeProvider` if the component reads the theme.

### Mocking `useServices`

The `HomePage` test mocks the data-fetching hook so it doesn't need a running API:

```js
vi.mock('../hooks/useServices', () => ({
  useServices: () => ({
    services: [{ id: '1', title: 'Test', ... }],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
```

This pattern works for any component that fetches data via a hook.

---

## E2E tests — Playwright

**Location:** `tests/e2e/`

**Config:** [playwright.config.js](../playwright.config.js) — Chromium only, serial (`fullyParallel: false`), zero retries, auto-starts `npm run dev` on `localhost:5173` (`reuseExistingServer: true`).

**What's covered (11 tests, 3 files):**

| File | Tests | What it checks |
| ---- | ----- | -------------- |
| `browse.spec.js` | 3 | Homepage loads with mocked service cards; search filters/clears correctly; language toggle switches UI text |
| `submit.spec.js` | 4 | Empty submit shows all validation errors; invalid email error; full submission flow (mocked API) → "Thank you!" page; navigation from homepage to add-service |
| `navigation.spec.js` | 4 | SPA routing for all public routes; 404 page; lazy-loaded admin login; footer links |

### API mocking in E2E

Since the local dev server can't reach Supabase in CI, E2E tests mock the API at the network level using Playwright's `page.route()`:

```js
await page.route('**/api/services*', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: '1', title: 'Test Service', ... }]),
  });
});
```

This intercepts the browser's fetch call before it reaches the Vite dev server. The component renders real React code with real state management — only the network response is faked.

### Adding an E2E test

Add a new `test(...)` to an existing spec file or create a new `.spec.js` in `tests/e2e/`. Mock any API calls the page needs.

```js
import { test, expect } from '@playwright/test';

test('privacy page has a heading', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading')).toBeVisible();
});
```

---

## Coverage gaps

These paths exist in code but have zero or minimal test coverage:

| Path | Type needed | What to test |
| ---- | ----------- | ------------ |
| Admin dashboard (approve/delete/edit) | Component + E2E | Queue renders pending items; approve flips state; delete removes row + images; edit panel saves changes |
| `AdminServicesPage` (search, filter, EditPanel) | Component | Table filtering, status toggle, slide-over edit panel, drag-to-reorder images |
| `useServices` hook | Component | Fetch lifecycle, cancellation on unmount, language change re-fetch, error state |
| `categories.js` helpers | Unit | `findParentCategory`, `getAllSubcategories` — pure functions, easy wins |
| `api/services.js`, `api/keep-alive.js` | Unit | Handler behavior (currently untested, though simple) |
| Image upload flow in AddServiceForm | E2E | File selection, upload progress, removal, max-5 limit |
| Responsive / mobile menu | E2E | Mobile menu opens, category navigation works at narrow viewport |
