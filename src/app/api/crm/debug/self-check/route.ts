import { NextRequest, NextResponse } from 'next/server';

// GET /api/crm/debug/self-check
//
// Debug utility — hits every critical CRM read-endpoint in parallel
// and reports {endpoint, status, ms, error?} per call. Lets us answer
// "is anything returning 500 right now" without loading the UI and
// inspecting each widget one by one.
//
// Silent-failure prevention tool: when a widget says "Couldn't load
// this section · 500" the user can curl this endpoint (or open it in
// a browser tab) to see WHICH endpoint is broken + the actual error
// body — instead of relying on the opaque banner.
//
// Intentionally NOT behind admin gates: the caller already needs to
// be authenticated to access /api/crm/* (middleware enforces). All
// we're reporting is endpoint health, not sensitive data.
const CRITICAL_ENDPOINTS = [
  { path: '/api/crm/forecast',        label: 'Forecast widget' },
  { path: '/api/crm/wip',             label: 'WIP widget' },
  { path: '/api/crm/upcoming?days=7', label: 'Upcoming-this-week widget' },
  { path: '/api/crm/next-actions',    label: 'Next Best Action widget' },
  { path: '/api/crm/billing/dashboard?year=' + new Date().getFullYear(), label: 'Billing dashboard' },
];

export async function GET(request: NextRequest) {
  const base = new URL(request.url).origin;
  // Forward cookies so the called endpoints see the same auth session
  // as the caller. Without this they'd 401 on the middleware gate.
  const cookieHeader = request.headers.get('cookie') ?? '';

  const results = await Promise.all(
    CRITICAL_ENDPOINTS.map(async ({ path, label }) => {
      const startedAt = Date.now();
      try {
        const res = await fetch(`${base}${path}`, {
          headers: { cookie: cookieHeader },
          cache: 'no-store',
        });
        const ms = Date.now() - startedAt;
        if (!res.ok) {
          let errBody = '';
          try { errBody = await res.text(); } catch { /* ignore */ }
          return {
            path, label, status: res.status, ms, ok: false,
            error: errBody.slice(0, 500),
          };
        }
        // Drain the body to be fair on timing, but don't return it.
        await res.text();
        return { path, label, status: 200, ms, ok: true };
      } catch (e) {
        return {
          path, label, status: 0, ms: Date.now() - startedAt, ok: false,
          error: e instanceof Error ? e.message : 'network error',
        };
      }
    }),
  );

  const allOk = results.every(r => r.ok);
  const summary = {
    overall: allOk ? 'ok' : 'degraded',
    checked_at: new Date().toISOString(),
    count: results.length,
    failing: results.filter(r => !r.ok).length,
  };
  return NextResponse.json({ ...summary, endpoints: results }, {
    status: allOk ? 200 : 503,
  });
}
