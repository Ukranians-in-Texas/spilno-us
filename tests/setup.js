import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// Node 26 + jsdom 29: localStorage requires storageQuota option in jsdom,
// but Vitest's jsdom integration doesn't pass it through. Polyfill with a
// simple in-memory implementation when the real one isn't available.
if (typeof globalThis.localStorage === 'undefined' || globalThis.localStorage === undefined) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
  };
}
