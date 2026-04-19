// E2E — public approval portal.
//
// /portal/[token] is the one PUBLIC authed surface cifra exposes —
// clients click a link emailed by a reviewer and land here without a
// password. Critical that:
//   1. An invalid token returns a clear "invalid or expired" page,
//      not a stack trace.
//   2. The page renders no leaking app chrome (sidebar, topbar, etc).
//
// Completely public; no login needed. Safe against production.

import { test, expect } from '@playwright/test';

test.describe('Public approval portal', () => {
  test('/portal/<garbage> renders an "invalid" state, not a crash', async ({ page }) => {
    await page.goto('/portal/this-is-not-a-valid-hmac-token');
    // The page should render SOMETHING (not 500). We tolerate either:
    //   - an "invalid"/"expired" message in the portal's own chrome
    //   - a graceful redirect to an info page
    // Either is acceptable; what we DON'T want is the Next.js error
    // overlay or an unhelpful blank page.
    const body = await page.locator('body').textContent();
    expect(body?.toLowerCase() ?? '').toMatch(/invalid|expired|not found|approval|cifra/);
  });

  test('/portal/[token] does NOT render the authed app shell', async ({ page }) => {
    // The portal is a public route — no sidebar, no topbar inbox. We
    // verify absence of the sidebar's "Clients" nav link (unique to
    // the authed shell).
    await page.goto('/portal/garbage-token');
    const clientsNav = page.getByRole('link', { name: /^clients$/i });
    await expect(clientsNav).toHaveCount(0);
  });
});
