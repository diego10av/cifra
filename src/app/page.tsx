// Stint 64.X.4.b — `/` (the post-sign-in landing on app.cifracompliance.com)
// now redirects to `/tax-ops`.
//
// Diego (2026-04-30) reported the strange screenshot after sign-in: it
// was the legacy stint-12 VAT-only home — "Welcome to cifra · No
// clients yet · Load demo data" — written before the Tax-Ops + CRM
// pivot. That page reads from the old `clients / declarations /
// invoices` schema; Diego works in `tax_entities / tax_obligations /
// tax_filings` and `crm_*`, so the page reports zeroes for everything
// even when Diego has 140 entities + an active task pipeline. It also
// shows an onboarding banner that no longer applies.
//
// The real operational landing is `/tax-ops`: actionable widgets
// (TasksDue / StuckFollowUps / filings radar) + the 6-card category
// grid. Server-side redirect = the URL bar updates from `/` to
// `/tax-ops` cleanly + the middleware's session check still runs
// before this component, so unauthenticated visits still bounce to
// `/login` (preserving the `?next=/tax-ops` flow shipped in 64.X.4).
//
// The 843-line legacy home is preserved verbatim at `/legacy-home` so
// it isn't lost — only de-prioritised. Nothing in the live product
// links to it; only there if we ever need a reference.

import { redirect } from 'next/navigation';

export default function HomeRedirect(): never {
  redirect('/tax-ops');
}
