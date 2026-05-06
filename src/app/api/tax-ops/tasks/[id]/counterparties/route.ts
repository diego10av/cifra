import { NextRequest, NextResponse } from 'next/server';
import { query, execute, logAudit } from '@/lib/db';

// GET  /api/tax-ops/tasks/[id]/counterparties        — list linked
// POST /api/tax-ops/tasks/[id]/counterparties        — link
//        body: { counterparty_id, role_in_task? }

const ALLOWED_ROLES_IN_TASK = ['responsible', 'reviewer', 'informed'] as const;

interface LinkRow {
  task_id: string;
  counterparty_id: string;
  role_in_task: string | null;
  display_name: string;
  side: string;
  role: string | null;
  jurisdiction: string | null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const rows = await query<LinkRow>(
    `SELECT l.task_id, l.counterparty_id, l.role_in_task,
            c.display_name, c.side, c.role, c.jurisdiction
       FROM tax_ops_task_counterparties l
       JOIN tax_ops_counterparties c ON c.id = l.counterparty_id
      WHERE l.task_id = $1
      ORDER BY
        CASE l.role_in_task WHEN 'responsible' THEN 0 WHEN 'reviewer' THEN 1 ELSE 2 END,
        c.display_name`,
    [id],
  );
  return NextResponse.json({ counterparties: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: taskId } = await params;
  const body = await request.json() as { counterparty_id?: string; role_in_task?: string };
  const cpid = body.counterparty_id?.trim();
  if (!cpid) {
    return NextResponse.json({ error: 'counterparty_id_required' }, { status: 400 });
  }
  const role = body.role_in_task && (ALLOWED_ROLES_IN_TASK as readonly string[]).includes(body.role_in_task)
    ? body.role_in_task : 'responsible';
  try {
    await execute(
      `INSERT INTO tax_ops_task_counterparties (task_id, counterparty_id, role_in_task)
       VALUES ($1, $2, $3)
       ON CONFLICT (task_id, counterparty_id)
       DO UPDATE SET role_in_task = EXCLUDED.role_in_task`,
      [taskId, cpid, role],
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
    action: 'tax_task_counterparty_link',
    targetType: 'tax_ops_task',
    targetId: taskId,
    newValue: JSON.stringify({ counterparty_id: cpid, role_in_task: role }),
  });
  return NextResponse.json({ ok: true });
}
