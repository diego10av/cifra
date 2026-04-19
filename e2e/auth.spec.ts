// E2E — login flow.
//
// Verifies that:
//   1. Hitting any authed URL redirects to /login
//   2. The login form accepts AUTH_PASSWORD + redirects to /
//   3. A bad password shows a clear error message
//
// Read-only-ish: only side effect is a session cookie. Safe to run
// against production.

import { test, expect } from '@playwright/test';

// Fall back to the dev default ("VAT123456") when AUTH_PASSWORD isn't
// injected as a test env var — matches seed-demo and dev .env.local.
const PASSWORD = process.env.AUTH_PASSWORD || 'VAT123456';

test.describe('Auth', () => {
  test('unauthenticated request to / redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('wrong password shows an error', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/incorrect password/i)).toBeVisible();
  });

  test('correct password lands on the home page', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    // Home is the default landing. Breadcrumb / h1 / sidebar item
    // presence all work as readiness signals; we pick the sidebar
    // because it's the most stable structural landmark.
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30_000 });
    await expect(page.getByRole('link', { name: /clients/i })).toBeVisible();
  });
});
