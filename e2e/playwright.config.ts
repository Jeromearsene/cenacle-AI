import { defineConfig } from '@playwright/test';

// The tests launch the built app (`yarn build`): see the `test:e2e` script.
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: '../test-results',
  workers: 1, // a single Electron app at a time
  reporter: [['list']],
});
