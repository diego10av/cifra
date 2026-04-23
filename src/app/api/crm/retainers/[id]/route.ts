import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

// DELETE /api/crm/retainers/[id] — remove a top-up entry.
// This reverses the balance impact; audit row retains the original
// value as the oldValue so the event is never silently lost.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await queryOne<{ id: string; company_id: string; amount_eur: string; reference: string | null }>(
    `SELECT id, company_id, amount_eur, reference FROM crm_retainer_topups WHERE id = $1`,
    [id],
  );
  if (!row) return apiError('not_found', 'Retainer top-up not found.', { status: 404 });

  await execute(`DELETE FROM crm_retainer_topups WHERE id = $1`, [id]);

  await logAudit({
    action: 'retainer_topup_removed',
    targetType: 'crm_company',
    targetId: row.company_id,
    field: 'retainer_balance',
    oldValue: row.amount_eur,
    reason: `Removed retainer top-up${row.reference ? ` (ref ${row.reference})` : ''}: €${Number(row.amount_eur).toFixed(2)}`,
  });

  return NextResponse.json({ id, deleted: true });
}
