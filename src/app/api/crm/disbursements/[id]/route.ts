import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

// DELETE /api/crm/disbursements/[id] — remove a disbursement row.
// Gate: if it's already been billed onto an invoice, require the user
// to first unlink or cancel the invoice (otherwise the invoice total
// would silently reference a ghost row).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await queryOne<{ id: string; matter_id: string; description: string; amount_eur: string; billed_on_invoice_id: string | null }>(
    `SELECT id, matter_id, description, amount_eur, billed_on_invoice_id
       FROM crm_disbursements WHERE id = $1`,
    [id],
  );
  if (!row) return apiError('not_found', 'Disbursement not found.', { status: 404 });

  if (row.billed_on_invoice_id) {
    return apiError(
      'already_billed',
      'Cannot delete — disbursement is already on an invoice. Cancel or edit the invoice first.',
      { status: 400 },
    );
  }

  await execute(`DELETE FROM crm_disbursements WHERE id = $1`, [id]);

  await logAudit({
    action: 'disbursement_removed',
    targetType: 'crm_matter',
    targetId: row.matter_id,
    field: 'disbursement',
    oldValue: row.amount_eur,
    reason: `Removed disbursement: ${row.description}`,
  });

  return NextResponse.json({ id, deleted: true });
}
