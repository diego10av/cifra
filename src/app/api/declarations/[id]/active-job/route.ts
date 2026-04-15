import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

// GET /api/declarations/[id]/active-job — returns the latest running or just-
// finished job for this declaration, for UI progress polling.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await queryOne(
    `SELECT * FROM jobs
      WHERE declaration_id = $1
        AND (status = 'running' OR finished_at > NOW() - INTERVAL '60 seconds')
      ORDER BY started_at DESC LIMIT 1`,
    [id]
  );
  return NextResponse.json(job || null);
}
