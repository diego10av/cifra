// E2E — sidebar navigation.
//
// Quick structural smoke that clicking each sidebar entry routes to
// the right page. If a page rename / route-config drift happens, this
// catches it before a demo.
//
// Read-only. Safe against production.

import { test, expect } from '@playwright/test';

const PASSWORD = process.env.AUTH_PASSWORD || 'VAT123456';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30_000 });
}

test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Clients link goes to /clients', async ({ page }) => {
    await page.getByRole('link', { name: /^clients$/i }).click();
    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByRole('heading', { name: /clients/i })).toBeVisible();
  });

  test('Declarations link goes to /declarations', async ({ page }) => {
    await page.getByRole('link', { name: /^declarations$/i }).click();
    await expect(page).toHaveURL(/\/declarations/);
  });

  test('Settings link goes to /settings', async ({ page }) => {
    await page.getByRole('link', { name: /^settings$/i }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('AED is NOT a top-level sidebar item (migrated into entities)', async ({ page }) => {
    // 2026-04-18: AED was demoted from the sidebar into per-entity tab.
    // Make sure it doesn't regress.
    const aedLink = page.getByRole('link', { name: /aed inbox/i });
    await expect(aedLink).toHaveCount(0);
  });
});
