import { defineConfig } from '@playwright/test';

// Les tests lancent l'app construite (`yarn build`) : voir le script `test:e2e`.
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: '../test-results',
  workers: 1, // une seule app Electron à la fois
  reporter: [['list']],
});
