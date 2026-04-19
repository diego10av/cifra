// ════════════════════════════════════════════════════════════════════════
// Playwright config.
//
// Two target modes:
//   - `E2E_TARGET=local`  → spawns `npm run dev` and runs against
//                           localhost:3000. Used for local dev. Requires
//                           .env.local to be populated.
//   - `E2E_TARGET=prod`   → runs against PLAYWRIGHT_BASE_URL (e.g.
//                           https://app.cifracompliance.com). Used for
//                           smoke-testing the live deploy. Only read-only
//                           tests should run in this mode.
//
// Default: `local`. CI wiring is deliberately NOT turned on yet — see
// `docs/E2E.md`. When Diego has a staging Supabase project, we flip the
// CI job on + move the mutating tests out of skip.
//
// Test files live in `e2e/` (not `src/__tests__/` — those are vitest
// unit tests and have a very different runtime contract).
// ════════════════════════════════════════════════════════════════════════

import { defineConfig, devices } from '@playwright/test';

const TARGET = (process.env.E2E_TARGET as 'local' | 'prod' | undefined) || 'local';
const LOCAL_URL = 'http://localhost:3000';
const PROD_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://app.cifracompliance.com';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: TARGET === 'prod' ? PROD_URL : LOCAL_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Spin up the dev server for local runs. Playwright waits until
  // http://localhost:3000 responds before running the tests.
  webServer: TARGET === 'local'
    ? {
        command: 'npm run dev',
        url: LOCAL_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,

  projects: [
    // Keep it simple for now — just Chromium. Add Firefox / WebKit
    // when we have critical flows + bandwidth for more runs.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
