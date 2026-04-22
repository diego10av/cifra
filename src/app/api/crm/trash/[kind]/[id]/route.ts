import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

// Map the polymorphic kind → table + column names. Keeps the handler
// generic without eval-like dynamic SQL.
const KINDS = {
  company:     { table: 'crm_companies',     label: 'company_name',                              audit: 'crm_company' },
  contact:     { table: 'crm_contacts',      label: 'full_name',                                 audit: 'crm_contact' },
  opportunity: { table: 'crm_opportunities', label: 'name',                                      audit: 'crm_opportunity' },
  matter:      { table: 'crm_matters',       label: `matter_reference || ' — ' || title`,       audit: 'crm_matter' },
} as const;
type Kind = keyof typeof KINDS;

// POST /api/crm/trash/[kind]/[id] — restore (sets deleted_at = NULL).
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;
  const cfg = KINDS[kind as Kind];
  if (!cfg) return apiError('invalid_kind', `kind must be one of: ${Object.keys(KINDS).join(', ')}`, { status: 400 });

  const existing = await queryOne<{ id: string; label: string }>(
    `SELECT id, ${cfg.label} AS label FROM ${cfg.table} WHERE id = $1 AND deleted_at IS NOT NULL`,
    [id],
  );
  if (!existing) return apiError('not_found', 'Record not found in trash.', { status: 404 });

  await execute(
    `UPDATE ${cfg.table} SET deleted_at = NULL, updated_at = NOW() WHERE id = $1`,
    [id],
  );
  await logAudit({
    action: 'restore',
    targetType: cfg.audit,
    targetId: id,
    newValue: existing.label,
    reason: 'Restored from trash',
  });
  return NextResponse.json({ id, restored: true });
}

// DELETE /api/crm/trash/[kind]/[id] — permanent deletion. Gone forever.
// Requires the record to already be in trash (safety guard).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;
  const cfg = KINDS[kind as Kind];
  if (!cfg) return apiError('invalid_kind', `kind must be one of: ${Object.keys(KINDS).join(', ')}`, { status: 400 });

  const existing = await queryOne<{ id: string; label: string }>(
    `SELECT id, ${cfg.label} AS label FROM ${cfg.table} WHERE id = $1 AND deleted_at IS NOT NULL`,
    [id],
  );
  if (!existing) {
    return apiError(
      'not_in_trash',
      'Permanent delete only works on records already in trash. Soft-delete from the detail page first.',
      { status: 400 },
    );
  }

  await execute(`DELETE FROM ${cfg.table} WHERE id = $1`, [id]);
  await logAudit({
    action: 'permanent_delete',
    targetType: cfg.audit,
    targetId: id,
    oldValue: existing.label,
    reason: 'Permanent deletion from trash',
  });
  return NextResponse.json({ id, permanently_deleted: true });
}
