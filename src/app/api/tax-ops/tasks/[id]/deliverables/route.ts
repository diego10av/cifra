import { NextRequest, NextResponse } from 'next/server';
import { query, execute, generateId, logAudit } from '@/lib/db';

// GET  /api/tax-ops/tasks/[id]/deliverables  — list (always sorted)
// POST /api/tax-ops/tasks/[id]/deliverables  — create
//
// Mig 087 — deliverables live in a dedicated table. Compared to the
// previous JSONB approach: per-deliverable audit trail, indexable
// queries, no full-array replace on every edit.

const ALLOWED_STATUSES = ['pending', 'drafted', 'reviewed', 'signed', 'filed', 'na'] as const;

interface DeliverableRow {
  id: string;
  task_id: string;
  label: string;
  status: string;
  due_date: string | null;
  link_url: string | null;
  notes: string | null;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const rows = await query<DeliverableRow>(
    `SELECT id, task_id, label, status,
            due_date::text AS due_date,
            link_url, notes, sort_order,
            completed_at::text AS completed_at,
            created_at::text   AS created_at,
            updated_at::text   AS updated_at
       FROM tax_ops_task_deliverables
      WHERE task_id = $1
      ORDER BY sort_order ASC, created_at ASC`,
    [id],
  );
  return NextResponse.json({ deliverables: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: taskId } = await params;
  const body = await request.json() as Partial<DeliverableRow>;
  const label = body.label?.trim();
  if (!label) {
    return NextResponse.json({ error: 'label_required' }, { status: 400 });
  }
  const status = body.status && (ALLOWED_STATUSES as readonly string[]).includes(body.status)
    ? body.status : 'pending';

  const id = generateId();
  const sortOrder = typeof body.sort_order === 'number'
    ? body.sort_order
    : await nextSortOrder(taskId);

  await execute(
    `INSERT INTO tax_ops_task_deliverables
       (id, task_id, label, status, due_date, link_url, notes, sort_order,
        completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
             CASE WHEN $4 = 'filed' THEN NOW() ELSE NULL END)`,
    [
      id, taskId, label, status,
      body.due_date || null,
      body.link_url?.trim() || null,
      body.notes?.trim() || null,
      sortOrder,
    ],
  );
  await logAudit({
    userId: 'founder',
    action: 'tax_task_deliverable_create',
    targetType: 'tax_ops_task_deliverable',
    targetId: id,
    newValue: JSON.stringify({ task_id: taskId, label, status }),
  });
  return NextResponse.json({ id });
}

async function nextSortOrder(taskId: string): Promise<number> {
  const [row] = await query<{ max: number | null }>(
    `SELECT MAX(sort_order)::int AS max FROM tax_ops_task_deliverables WHERE task_id = $1`,
    [taskId],
  );
  return (row?.max ?? -1) + 1;
}
