import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/legal-watch/queue
//
// Returns items from legal_watch_queue, most-recent first.
// Query params:
//   ?status=new|flagged|dismissed|escalated   (default: new + flagged)
//   ?limit=50                                  (default 50, max 200)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get('status');
  const limitParam = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get('limit') ?? 50) || 50),
  );

  const statusFilter = statusParam
    ? [statusParam]
    : ['new', 'flagged'];

  const rows = await query(
    `SELECT id, source, external_id, title, url, summary, published_at,
            matched_keywords, status, triaged_at, triaged_by, triage_note,
            created_at
       FROM legal_watch_queue
      WHERE status = ANY($1::text[])
      ORDER BY (status = 'new') DESC,
               published_at DESC NULLS LAST,
               created_at DESC
      LIMIT $2`,
    [statusFilter, limitParam],
  );

  return NextResponse.json(rows);
}
