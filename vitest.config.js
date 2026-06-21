import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
  viteConfig({ mode: 'test' }),
  defineConfig({
    test: {
      exclude: ['tests/e2e/**', 'node_modules/**'],
      environment: 'jsdom',
      environmentOptions: {
        jsdom: { url: 'http://localhost:5173', storageQuota: 10000 },
      },
      setupFiles: ['./tests/setup.js'],
    },
  })
);
