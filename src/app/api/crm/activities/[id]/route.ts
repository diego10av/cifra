import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

const UPDATABLE_FIELDS = [
  'name', 'activity_type', 'activity_date', 'duration_hours', 'billable',
  'lawyer', 'primary_contact_id', 'company_id', 'opportunity_id',
  'matter_id', 'outcome', 'notes',
] as const;
type UpdatableField = typeof UPDATABLE_FIELDS[number];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const activity = await queryOne(
    `SELECT a.*, c.company_name, o.name AS opportunity_name,
            m.matter_reference, ct.full_name AS contact_name
       FROM crm_activities a
       LEFT JOIN crm_companies c     ON c.id = a.company_id
       LEFT JOIN crm_opportunities o ON o.id = a.opportunity_id
       LEFT JOIN crm_matters m       ON m.id = a.matter_id
       LEFT JOIN crm_contacts ct     ON ct.id = a.primary_contact_id
      WHERE a.id = $1`,
    [id],
  );
  if (!activity) return apiError('not_found', 'Activity not found.', { status: 404 });
  return NextResponse.json(activity);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const existing = await queryOne<Record<string, unknown>>(
    `SELECT * FROM crm_activities WHERE id = $1`,
    [id],
  );
  if (!existing) return apiError('not_found', 'Activity not found.', { status: 404 });

  const setClauses: string[] = [];
  const values: unknown[] = [];
  const changed: Array<{ field: UpdatableField; before: unknown; after: unknown }> = [];
  let idx = 1;

  for (const f of UPDATABLE_FIELDS) {
    if (!(f in body)) continue;
    let next = body[f];
    if (typeof next === 'string') next = next.trim() || null;
    if (f === 'billable') next = !!next;
    if (f === 'duration_hours' && next !== null && next !== undefined) {
      const n = Number(next); next = Number.isFinite(n) ? n : null;
    }
    if (f === 'name' && !next) return apiError('name_required', 'name cannot be empty.', { status: 400 });
    const before = existing[f] ?? null;
    const beforeStr = String(before ?? '');
    const afterStr = String(next ?? '');
    if (beforeStr === afterStr) continue;
    setClauses.push(`${f} = $${idx}`);
    values.push(next);
    idx += 1;
    changed.push({ field: f, before, after: next });
  }

  if (changed.length === 0) return NextResponse.json({ id, changed: [] });

  setClauses.push(`updated_at = NOW()`);
  values.push(id);
  await execute(
    `UPDATE crm_activities SET ${setClauses.join(', ')} WHERE id = $${idx}`,
    values,
  );

  for (const c of changed) {
    await logAudit({
      action: 'update',
      targetType: 'crm_activity',
      targetId: id,
      field: c.field,
      oldValue: String(c.before ?? ''),
      newValue: String(c.after ?? ''),
    });
  }

  return NextResponse.json({ id, changed: changed.map(c => c.field) });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await queryOne<{ id: string; name: string }>(
    `SELECT id, name FROM crm_activities WHERE id = $1`,
    [id],
  );
  if (!existing) return apiError('not_found', 'Activity not found.', { status: 404 });

  // Activities have no deleted_at (by migration design — they're
  // timeline events, immutable). Hard-delete with audit row as receipt.
  await execute(`DELETE FROM crm_activities WHERE id = $1`, [id]);
  await logAudit({
    action: 'delete',
    targetType: 'crm_activity',
    targetId: id,
    oldValue: existing.name,
    reason: 'Permanent deletion (activities have no soft-delete)',
  });
  return NextResponse.json({ id, deleted: true });
}
