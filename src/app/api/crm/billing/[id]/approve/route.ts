import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

// POST /api/crm/billing/[id]/approve — mark an invoice as approved
// by the current user so it can transition past 'draft' when the
// firm has set crm_firm_settings.require_approval_above_eur.
//
// Idempotent — calling twice just updates approved_at timestamp.
// Only draft invoices can be approved (approvals on already-issued
// invoices would be confusing).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const approvedBy = typeof body.approved_by === 'string' && body.approved_by.trim()
    ? body.approved_by.trim()
    : 'founder';

  const row = await queryOne<{ id: string; invoice_number: string; status: string; amount_incl_vat: string | number | null }>(
    `SELECT id, invoice_number, status, amount_incl_vat
       FROM crm_billing_invoices WHERE id = $1`,
    [id],
  );
  if (!row) return apiError('not_found', 'Invoice not found.', { status: 404 });
  if (row.status !== 'draft') {
    return apiError(
      'invalid_status',
      `Cannot approve a ${row.status} invoice. Only drafts can be approved.`,
      { status: 400 },
    );
  }

  await execute(
    `UPDATE crm_billing_invoices
        SET approved_by = $1, approved_at = NOW(), updated_at = NOW()
      WHERE id = $2`,
    [approvedBy, id],
  );

  await logAudit({
    action: 'approve',
    targetType: 'crm_invoice',
    targetId: id,
    field: 'approved_by',
    newValue: approvedBy,
    reason: `Invoice ${row.invoice_number} approved (€${Number(row.amount_incl_vat ?? 0).toFixed(2)})`,
  });

  return NextResponse.json({ id, approved_by: approvedBy });
}

// DELETE — rescind the approval (e.g. the reviewer spotted an issue
// after clicking approve). Keeps audit log.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await queryOne<{ id: string; invoice_number: string; status: string; approved_by: string | null }>(
    `SELECT id, invoice_number, status, approved_by
       FROM crm_billing_invoices WHERE id = $1`,
    [id],
  );
  if (!row) return apiError('not_found', 'Invoice not found.', { status: 404 });
  if (row.status !== 'draft') {
    return apiError(
      'invalid_status',
      'Approval can only be rescinded while the invoice is still in draft.',
      { status: 400 },
    );
  }
  if (!row.approved_by) return NextResponse.json({ id, already_unapproved: true });

  await execute(
    `UPDATE crm_billing_invoices
        SET approved_by = NULL, approved_at = NULL, updated_at = NOW()
      WHERE id = $1`,
    [id],
  );

  await logAudit({
    action: 'unapprove',
    targetType: 'crm_invoice',
    targetId: id,
    field: 'approved_by',
    oldValue: row.approved_by,
    reason: `Approval rescinded for ${row.invoice_number}`,
  });

  return NextResponse.json({ id, approved_by: null });
}
