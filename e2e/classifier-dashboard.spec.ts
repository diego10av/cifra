// E2E — /settings/classifier accuracy page.
//
// The classifier dashboard is load-bearing: it's the single source of
// truth for "is the brain still 100% correct?" after code changes.
// This test just loads it and checks it renders the expected pass
// rate + headline. If the page renders broken or the API fails, the
// test catches it before a demo.
//
// Read-only. Safe against production.

import { test, expect } from '@playwright/test';

const PASSWORD = process.env.AUTH_PASSWORD || 'VAT123456';

test.describe('Classifier accuracy dashboard', () => {
  test('renders with a headline pass rate', async ({ page }) => {
    // Login first.
    await page.goto('/login');
    await page.getByPlaceholder('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30_000 });

    await page.goto('/settings/classifier');
    await expect(page.getByRole('heading', { name: /classifier accuracy/i })).toBeVisible();

    // The headline uses "X/Y" followed by "(Z%)" — both must be
    // present. We don't hard-code the numerator to avoid breaking
    // when corpus grows; instead we assert the format.
    const headline = page.locator('div.text-\\[28px\\]').first();
    await expect(headline).toBeVisible();
    await expect(headline).toContainText(/\d+\/\d+/);
    await expect(headline).toContainText(/\(\d+\.\d+%\)/);

    // Archetypes section must be present.
    await expect(page.getByRole('heading', { name: /by archetype/i })).toBeVisible();

    // Rules-exercised section must be present.
    await expect(page.getByRole('heading', { name: /rules exercised/i })).toBeVisible();
  });

  test('GET /api/metrics/classifier returns expected JSON shape', async ({ request }) => {
    // Bypass the UI — hit the API directly. Need auth cookie for this
    // to work; easiest is to pass the session via a pre-login dance,
    // but the test is non-critical if auth returns 401 — we're
    // primarily verifying shape when it DOES work.
    const loginRes = await request.post('/api/auth/login', {
      data: { password: PASSWORD },
    });
    expect(loginRes.ok()).toBeTruthy();

    const res = await request.get('/api/metrics/classifier');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('passed');
    expect(body).toHaveProperty('accuracy');
    expect(body).toHaveProperty('archetypes');
    expect(body).toHaveProperty('failures');
    expect(typeof body.total).toBe('number');
    expect(body.total).toBeGreaterThan(0);
    expect(body.accuracy).toBeGreaterThanOrEqual(0);
    expect(body.accuracy).toBeLessThanOrEqual(1);

    // The health check the whole dashboard exists for: must be 100%.
    // If this fails, we shipped a regression. Don't silently green
    // the build — fail loudly.
    expect(body.failed).toBe(0);
  });
});
