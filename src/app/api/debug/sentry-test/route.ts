// ════════════════════════════════════════════════════════════════════════
// GET /api/debug/sentry-test
//
// TEMPORARY verification endpoint. Three layers of Sentry signal:
//
//   1. Sentry.captureMessage('...')    — simplest possible event
//   2. Sentry.captureException(new Error(...)) — explicit error capture
//   3. throw new Error(...)            — unhandled, exercises onRequestError
//   (plus) await Sentry.flush()        — serverless: must flush before
//                                         the Lambda freezes or events get
//                                         dropped at the network boundary.
//
// Returns whether each step fired successfully — so the HTTP response
// itself tells us which part of the chain works vs. doesn't, without
// needing to rely on Sentry's UI to diagnose.
// ════════════════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  const diagnostics: Record<string, string> = {
    dsn_present_server: process.env.SENTRY_DSN ? 'yes' : 'no',
    dsn_present_public: process.env.NEXT_PUBLIC_SENTRY_DSN ? 'yes' : 'no',
    node_env: process.env.NODE_ENV ?? 'unknown',
    vercel_env: process.env.VERCEL_ENV ?? 'unknown',
  };

  // Layer 1: captureMessage (the most basic signal)
  try {
    const id = Sentry.captureMessage(
      'cifra Sentry verification — captureMessage path',
      'info',
    );
    diagnostics.captureMessage_id = id ?? 'no-id-returned';
  } catch (e) {
    diagnostics.captureMessage_error = (e as Error).message;
  }

  // Layer 2: captureException
  try {
    const id = Sentry.captureException(new Error(
      'cifra Sentry verification — captureException path',
    ));
    diagnostics.captureException_id = id ?? 'no-id-returned';
  } catch (e) {
    diagnostics.captureException_error = (e as Error).message;
  }

  // Layer 3: flush — critical for serverless. Without this, the Lambda
  // process may be frozen before Sentry's async HTTP POST completes.
  try {
    const flushed = await Sentry.flush(5000);
    diagnostics.flush_ok = flushed ? 'yes' : 'timeout';
  } catch (e) {
    diagnostics.flush_error = (e as Error).message;
  }

  // Return JSON diagnostics — easier to read than an HTML error page
  // when iterating on the config.
  return NextResponse.json({
    ok: true,
    message: 'Sentry test fired. Check https://sentry.io for 2 events (message + exception).',
    diagnostics,
  });
}
