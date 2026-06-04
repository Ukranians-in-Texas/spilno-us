# Theming System

## Overview

The project supports light and dark modes. The active theme is stored in `localStorage`, applied as a class on `<html>`, and consumed in components via CSS variables and Tailwind `dark:` utilities.

---

## State Management

**`src/context/ThemeContext.jsx`** — single source of truth:

- Initializes from `localStorage` (defaults to `'light'`)
- On change, syncs to the DOM: `document.documentElement.classList.toggle('dark', theme === 'dark')`
- Exposes `{ theme, toggleTheme }` via React context

**`src/hooks/useTheme.js`** — thin wrapper around `useContext(ThemeContext)`

**`src/components/Header/ThemeToggle.jsx`** — the UI button that calls `toggleTheme()`

---

## CSS Layer (`src/index.css`)

### The `dark:` prefix

`dark:` is a Tailwind variant — a conditional modifier that applies a utility class only when a certain condition is met. You stack it in front of any utility:

```jsx
// bg-white in light mode, bg-[#0F2040] in dark mode
<div className="bg-white dark:bg-[#0F2040]">

// Works with any utility: text, border, shadow, opacity, hover, etc.
<p className="text-text dark:text-white/70">
<div className="border-stroke dark:border-white/10">
<button className="hover:bg-gray dark:hover:bg-[#2a4f7a]">
```

### Custom Tailwind variant

```css
@custom-variant dark (&:where(.dark, .dark *));
```

Defines *when* the `dark:` prefix activates: when the element or any of its ancestors has the `.dark` class. This is how Tailwind knows to apply dark mode styles when `html.dark` is set.

### CSS variables

Light mode defaults are defined in `@theme { }`. Dark mode overrides are applied when `html.dark` is present:

| Variable | Light | Dark |
| --- | --- | --- |
| `--color-dark-blue` | `#00205B` | `#7BA8E8` |
| `--color-text` | `#091832` | `#E2E8F0` |
| `--color-gray` | `#EBEBEB` | `#1E3A5F` |
| `--color-light-gray` | `#F5F5F5` | `#0A1628` |
| `--color-stroke` | `rgba(0,32,91,0.15)` | `rgba(255,255,255,0.12)` |
| `--shadow-card` | `0 4px 44px rgba(0,0,0,0.12)` | `0 4px 44px rgba(0,0,0,0.4)` |

Note: `--color-brand-blue` and `--color-brand-red` are the same in both modes.

---

## Component Patterns

### Pattern A — Semantic tokens (preferred)

Use Tailwind classes that map to CSS variables. They auto-adapt to dark mode with no extra work:

```jsx
<h3 className="text-dark-blue">...</h3>
<p className="text-text">...</p>
<div className="bg-light-gray border border-stroke">...</div>
```

### Pattern B — Explicit `dark:` utilities

Use when a value has no semantic token, or when the dark value is completely different from the light one:

```jsx
// Container backgrounds
<div className="bg-white dark:bg-[#0F2040]">

// Links (need lighter blue in dark mode)
<a className="text-brand-blue dark:text-[#60A5FA]">

// Hover states
<button className="hover:bg-[#e0e0e0] dark:hover:bg-[#2a4f7a]">

// Placeholders
<input className="placeholder:text-dark-blue/40 dark:placeholder:text-white/30">
```

**Hardcoded dark values in use:**

- `#0F2040` — card/container backgrounds
- `#0A1628` — deep background (same as `--color-light-gray` in dark)
- `#60A5FA` — links and interactive text
- `#2a4f7a` — hover state on dark backgrounds

---

## Flow Summary

```text
User clicks ThemeToggle
  → toggleTheme() updates React state + localStorage
    → useEffect: document.documentElement.classList.toggle('dark')
      → html.dark { } CSS vars override  →  Pattern A components update
      → Tailwind dark: utilities activate →  Pattern B components update
```
