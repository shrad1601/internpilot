import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '*.spec.ts',
  globalSetup: './tests/e2e/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
})
