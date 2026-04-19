// E2E — inbox dropdown in the topbar.
//
// Verifies the inbox (action-queue replacement for the old bell)
// opens, renders, and shows either action rows or the "clear" empty
// state. Doesn't assert on specific counts — those depend on the
// data snapshot — just on structural presence.
//
// Read-only. Safe against production.

import { test, expect } from '@playwright/test';

const PASSWORD = process.env.AUTH_PASSWORD || 'VAT123456';

test.describe('Inbox', () => {
  test('opens and shows either action rows or the clear state', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 30_000 });

    // Inbox button lives in the topbar. Title "Inbox" (or with a count).
    const inboxButton = page.getByRole('button', { name: /inbox/i });
    await expect(inboxButton).toBeVisible();
    await inboxButton.click();

    // Dropdown has role=menu with aria-label=Inbox.
    const dropdown = page.getByRole('menu', { name: /inbox/i });
    await expect(dropdown).toBeVisible();

    // Body must contain either:
    //   - the empty "Inbox is clear" message, OR
    //   - at least one row with an action link
    const hasEmpty = await page.getByText(/inbox is clear/i).count();
    const hasRows = await page.locator('[role="menu"] ul li').count();
    expect(hasEmpty + hasRows).toBeGreaterThan(0);
  });
});
