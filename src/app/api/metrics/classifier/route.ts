// ════════════════════════════════════════════════════════════════════════
// GET /api/metrics/classifier
//
// Returns the current pass-rate of the deterministic classifier against
// the synthetic corpus (60 fixtures today; grows over time as we add
// edge cases from customer issues). This is cifra's accuracy dashboard
// — the single most important health metric.
//
// Run time: ~20-50ms. Pure in-memory classification. No DB hit.
// Safe to call on every page load. Use a route cache / SWR at the UI
// layer if it ever needs to be cheaper.
//
// Response: see src/lib/classifier-accuracy.ts for the exact shape.
// ════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { runClassifierAccuracy } from '@/lib/classifier-accuracy';

export async function GET() {
  const report = runClassifierAccuracy();
  return NextResponse.json(report, {
    // Tiny cache so a dashboard refresh is cheap but we still see
    // the effect of a code change within a minute.
    headers: { 'Cache-Control': 'private, max-age=30' },
  });
}
