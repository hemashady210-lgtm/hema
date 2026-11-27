import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the Supabase local stack (`supabase start`) + the `api` function + the dashboard.
 * Required env (scripts/e2e/env.sh prints them from `supabase status`):
 *   E2E_SUPABASE_URL, E2E_SUPABASE_SECRET_KEY, E2E_MAILPIT_URL
 * The dashboard is served by `vite preview` (or an already running dev server on :5173).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'journey',
      testMatch: /(journey|surfaces)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(process.env.E2E_NO_SERVER
    ? {}
    : {
        webServer: {
          command: 'pnpm exec vite preview --host 127.0.0.1 --port 5173 --strictPort',
          url: 'http://127.0.0.1:5173',
          reuseExistingServer: true,
          timeout: 60_000,
        },
      }),
});
