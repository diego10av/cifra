import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';

// POST /api/documents/:id/retry - reset document to 'uploaded' so it can be re-processed
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = await queryOne('SELECT * FROM documents WHERE id = $1', [id]);
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  await execute(
    "UPDATE documents SET status = 'uploaded', error_message = NULL, triage_result = NULL, triage_confidence = NULL WHERE id = $1",
    [id]
  );

  return NextResponse.json({ success: true });
}
