import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, generateId, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';
import { nextInvoiceNumber } from '@/lib/crm-invoice-number';

// POST /api/crm/billing/[id]/credit-note
//
// Create a credit note that cancels (fully or partly) an existing
// invoice. Body:
//   { amount?: number|null,    // optional — defaults to full value;
//                                 pass a positive number to cancel
//                                 part of the original
//     reason?: string,
//     issue_date?: string }
//
// The new row is a regular invoice with:
//   - status = 'credit_note'
//   - original_invoice_id = <source invoice>
//   - amount_excl_vat, vat_amount, amount_incl_vat NEGATED
//   - invoice_number from the same MP-YYYY-NNNN sequence (credit
//     notes share numbering with invoices — standard LU practice).
//
// We don't mutate the original invoice; its status stays paid.
// Dashboards/aging queries can join on original_invoice_id when they
// need to see the net figure.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: originalId } = await params;
  const body = await request.json().catch(() => ({}));

  const original = await queryOne<{
    id: string; invoice_number: string; company_id: string | null;
    matter_id: string | null; primary_contact_id: string | null;
    currency: string | null; issue_date: string | null;
    amount_excl_vat: string | number | null; vat_rate: string | number | null;
    vat_amount: string | number | null; amount_incl_vat: string | number | null;
    line_items: unknown; status: string;
  }>(
    `SELECT id, invoice_number, company_id, matter_id, primary_contact_id,
            currency, issue_date::text AS issue_date,
            amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
            line_items, status
       FROM crm_billing_invoices WHERE id = $1`,
    [originalId],
  );
  if (!original) return apiError('not_found', 'Original invoice not found.', { status: 404 });

  // Only allow credit notes for invoices that were actually issued
  // (not drafts / already-cancelled / already-credited). If the user
  // wants to walk back a draft, deleting it is the right move.
  if (!['sent', 'partial_paid', 'paid', 'overdue'].includes(original.status)) {
    return apiError(
      'invalid_status',
      `Cannot credit a ${original.status} invoice. Only issued invoices (sent / paid / partial_paid / overdue) can be credited.`,
      { status: 400 },
    );
  }

  const originalIncl = Number(original.amount_incl_vat ?? 0);
  const originalExcl = Number(original.amount_excl_vat ?? 0);
  const originalVat  = Number(original.vat_amount ?? 0);
  if (originalIncl <= 0) {
    return apiError('invalid_amount', 'Original invoice has no billable amount.', { status: 400 });
  }

  // Full credit by default. Partial: use `amount` (positive number ≤ originalIncl).
  const requested = body.amount !== undefined && body.amount !== null ? Number(body.amount) : originalIncl;
  if (!Number.isFinite(requested) || requested <= 0 || requested > originalIncl + 0.01) {
    return apiError(
      'invalid_amount',
      `Credit amount must be between 0 and ${originalIncl.toFixed(2)} (the original invoice total).`,
      { status: 400 },
    );
  }

  // Preserve the ratio so partial credits split excl/vat proportionally.
  const ratio = requested / originalIncl;
  const newExcl = -1 * (originalExcl * ratio);
  const newVat  = -1 * (originalVat * ratio);
  const newIncl = -1 * requested;

  const creditNumber = await nextInvoiceNumber();
  const creditId = generateId();

  const reason = typeof body.reason === 'string' && body.reason.trim()
    ? body.reason.trim()
    : `Credit note for ${original.invoice_number}`;

  await execute(
    `INSERT INTO crm_billing_invoices
       (id, invoice_number, company_id, matter_id, primary_contact_id,
        issue_date, due_date, currency, amount_excl_vat, vat_rate,
        vat_amount, amount_incl_vat, amount_paid, status,
        payment_method, payment_reference, line_items, notes,
        original_invoice_id, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9,$10,$11,0,'credit_note',
             NULL,NULL,$12::jsonb,$13,$14,NOW())`,
    [
      creditId, creditNumber, original.company_id, original.matter_id,
      original.primary_contact_id,
      body.issue_date ?? new Date().toISOString().slice(0, 10),
      original.currency ?? 'EUR',
      newExcl, original.vat_rate ?? 0, newVat, newIncl,
      JSON.stringify(Array.isArray(original.line_items) ? original.line_items : []),
      reason, originalId,
    ],
  );

  await logAudit({
    action: 'credit_note_issued',
    targetType: 'crm_invoice',
    targetId: creditId,
    field: 'credit_note',
    newValue: String(newIncl),
    reason: `Credit note ${creditNumber} issued against ${original.invoice_number}: ${reason}`,
  });

  return NextResponse.json(
    { id: creditId, invoice_number: creditNumber, amount_incl_vat: newIncl },
    { status: 201 },
  );
}
