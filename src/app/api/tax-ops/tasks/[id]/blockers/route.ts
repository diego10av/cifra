import { NextRequest, NextResponse } from 'next/server';
import { query, execute, logAudit } from '@/lib/db';

// GET  /api/tax-ops/tasks/[id]/blockers      — list blockers (joined with task title/status)
// POST /api/tax-ops/tasks/[id]/blockers      — link a blocker { blocker_id }
//
// Stint 84.F — replaces the legacy 1:1 depends_on_task_id with a
// many-to-many link table.

interface BlockerRow {
  blocker_id: string;
  title: string;
  status: string;
  created_at: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const rows = await query<BlockerRow>(
    `SELECT b.blocker_id,
            t.title,
            t.status,
            b.created_at::text AS created_at
       FROM tax_ops_task_blockers b
       JOIN tax_ops_tasks t ON t.id = b.blocker_id
      WHERE b.task_id = $1
      ORDER BY b.created_at ASC`,
    [id],
  );
  return NextResponse.json({ blockers: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: taskId } = await params;
  const body = await request.json() as { blocker_id?: string };
  const blockerId = body.blocker_id?.trim();
  if (!blockerId) {
    return NextResponse.json({ error: 'blocker_id_required' }, { status: 400 });
  }
  if (blockerId === taskId) {
    return NextResponse.json({ error: 'self_block_not_allowed' }, { status: 400 });
  }
  try {
    await execute(
      `INSERT INTO tax_ops_task_blockers (task_id, blocker_id)
       VALUES ($1, $2)
       ON CONFLICT (task_id, blocker_id) DO NOTHING`,
      [taskId, blockerId],
    );
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (/foreign key|violates/i.test(msg)) {
      return NextResponse.json({ error: 'invalid_reference' }, { status: 400 });
    }
    throw e;
  }
  await logAudit({
    userId: 'founder',
    action: 'tax_task_blocker_link',
    targetType: 'tax_ops_task',
    targetId: taskId,
    newValue: JSON.stringify({ blocker_id: blockerId }),
  });
  return NextResponse.json({ ok: true });
}
