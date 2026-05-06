import { NextRequest, NextResponse } from 'next/server';
import { execute, logAudit, buildUpdate } from '@/lib/db';

// PATCH  /api/tax-ops/counterparties/[id]   — partial update
// DELETE /api/tax-ops/counterparties/[id]   — soft archive (sets archived_at)

const ALLOWED = [
  'display_name', 'organization', 'contact_name', 'contact_email',
  'contact_phone', 'jurisdiction', 'role', 'side', 'notes',
  'archived_at',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;

  if (typeof body.jurisdiction === 'string') {
    body.jurisdiction = body.jurisdiction.trim().slice(0, 2).toUpperCase() || null;
  }

  const { sql, values, changes } = buildUpdate(
    'tax_ops_counterparties', ALLOWED, body, 'id', id, ['updated_at = NOW()'],
  );
  if (!sql) return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  await execute(sql, values);
  await logAudit({
    userId: 'founder',
    action: 'tax_counterparty_update',
    targetType: 'tax_ops_counterparty',
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
  await execute(
    `UPDATE tax_ops_counterparties SET archived_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id],
  );
  await logAudit({
    userId: 'founder',
    action: 'tax_counterparty_archive',
    targetType: 'tax_ops_counterparty',
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
