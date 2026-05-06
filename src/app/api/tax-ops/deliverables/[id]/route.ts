import { NextRequest, NextResponse } from 'next/server';
import { execute, logAudit, buildUpdate, queryOne } from '@/lib/db';

// PATCH  /api/tax-ops/deliverables/[id]  — partial update (label, status, due, link, notes, sort_order)
// DELETE /api/tax-ops/deliverables/[id]  — hard delete (history kept in audit_log)

const ALLOWED = [
  'label', 'status', 'due_date', 'link_url', 'notes', 'sort_order',
] as const;

const ALLOWED_STATUSES = ['pending', 'drafted', 'reviewed', 'signed', 'filed', 'na'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;

  if (typeof body.status === 'string' && !ALLOWED_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  // Auto-bump completed_at when status flips to 'filed' (the terminal state).
  if (body.status === 'filed') body.completed_at = new Date().toISOString();
  if (body.status && body.status !== 'filed') body.completed_at = null;

  const extras = ['updated_at = NOW()'];
  // completed_at isn't in ALLOWED so we extend buildUpdate manually:
  // simplest path is to inject it as an extra SET only if we set it above.
  if ('completed_at' in body) {
    extras.push(`completed_at = ${body.completed_at === null ? 'NULL' : `'${(body.completed_at as string).replace(/'/g, "''")}'`}`);
    delete body.completed_at;
  }

  const { sql, values, changes } = buildUpdate(
    'tax_ops_task_deliverables', ALLOWED, body, 'id', id, extras,
  );
  if (!sql) return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  await execute(sql, values);
  await logAudit({
    userId: 'founder',
    action: 'tax_task_deliverable_update',
    targetType: 'tax_ops_task_deliverable',
    targetId: id,
    newValue: JSON.stringify(changes),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  // Capture the row pre-delete so the audit_log keeps a useful trace.
  const row = await queryOne<{ task_id: string; label: string; status: string }>(
    `SELECT task_id, label, status FROM tax_ops_task_deliverables WHERE id = $1`,
    [id],
  );
  await execute(`DELETE FROM tax_ops_task_deliverables WHERE id = $1`, [id]);
  await logAudit({
    userId: 'founder',
    action: 'tax_task_deliverable_delete',
    targetType: 'tax_ops_task_deliverable',
    targetId: id,
    newValue: JSON.stringify(row ?? { id }),
  });
  return NextResponse.json({ ok: true });
}
