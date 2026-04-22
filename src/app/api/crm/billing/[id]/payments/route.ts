import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, generateId, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

// POST /api/crm/billing/[id]/payments — record a payment against an invoice.
// Required: amount, payment_date.
// Auto-updates the invoice's amount_paid (by re-summing all payments)
// and transitions status: paid if fully paid, partially_paid if < total.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await params;
  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return apiError('amount_required', 'amount must be a positive number.', { status: 400 });
  }
  const paymentDate = body.payment_date;
  if (!paymentDate) return apiError('payment_date_required', 'payment_date is required.', { status: 400 });

  const invoice = await queryOne<{ id: string; amount_incl_vat: string; status: string }>(
    `SELECT id, amount_incl_vat, status FROM crm_billing_invoices WHERE id = $1`,
    [invoiceId],
  );
  if (!invoice) return apiError('invoice_not_found', 'Invoice not found.', { status: 404 });

  const paymentId = generateId();
  await execute(
    `INSERT INTO crm_billing_payments
       (id, invoice_id, amount, payment_date, payment_method, payment_reference, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      paymentId, invoiceId, amount, paymentDate,
      body.payment_method ?? null,
      body.payment_reference ?? null,
      body.notes ?? null,
    ],
  );

  // Re-sum all payments and update invoice amount_paid + status.
  const sumRow = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS total FROM crm_billing_payments WHERE invoice_id = $1`,
    [invoiceId],
  );
  const totalPaid = Number(sumRow?.total ?? 0);
  const totalDue = Number(invoice.amount_incl_vat);
  const newStatus =
    totalPaid >= totalDue ? 'paid'
    : totalPaid > 0       ? 'partially_paid'
    : invoice.status;
  const paidDate = totalPaid >= totalDue ? paymentDate : null;

  await execute(
    `UPDATE crm_billing_invoices
        SET amount_paid = $1,
            status = $2,
            paid_date = COALESCE(paid_date, $3),
            updated_at = NOW()
      WHERE id = $4`,
    [totalPaid, newStatus, paidDate, invoiceId],
  );

  await logAudit({
    action: 'payment_recorded',
    targetType: 'crm_invoice',
    targetId: invoiceId,
    newValue: `€${amount.toFixed(2)} on ${paymentDate}`,
    reason: `New status: ${newStatus}`,
  });

  return NextResponse.json({
    id: paymentId,
    invoice_id: invoiceId,
    amount,
    new_status: newStatus,
    total_paid: totalPaid,
  }, { status: 201 });
}

// DELETE /api/crm/billing/[id]/payments?payment_id=xxx
// Removes a payment (e.g. recorded in error). Re-sums and reverts
// status if needed.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await params;
  const url = new URL(request.url);
  const paymentId = url.searchParams.get('payment_id');
  if (!paymentId) return apiError('payment_id_required', 'payment_id query param required.', { status: 400 });

  const payment = await queryOne<{ id: string; amount: string }>(
    `SELECT id, amount FROM crm_billing_payments WHERE id = $1 AND invoice_id = $2`,
    [paymentId, invoiceId],
  );
  if (!payment) return apiError('payment_not_found', 'Payment not found on this invoice.', { status: 404 });

  await execute(`DELETE FROM crm_billing_payments WHERE id = $1`, [paymentId]);

  // Recompute totals.
  const sumRow = await queryOne<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS total FROM crm_billing_payments WHERE invoice_id = $1`,
    [invoiceId],
  );
  const invoice = await queryOne<{ amount_incl_vat: string }>(
    `SELECT amount_incl_vat FROM crm_billing_invoices WHERE id = $1`,
    [invoiceId],
  );
  if (!invoice) return apiError('invoice_not_found', 'Invoice not found.', { status: 404 });

  const totalPaid = Number(sumRow?.total ?? 0);
  const totalDue = Number(invoice.amount_incl_vat);
  const newStatus =
    totalPaid >= totalDue ? 'paid'
    : totalPaid > 0       ? 'partially_paid'
    : 'sent';  // reverted to sent (not draft — sent is preserved)

  await execute(
    `UPDATE crm_billing_invoices
        SET amount_paid = $1,
            status = $2,
            paid_date = CASE WHEN $1 >= amount_incl_vat THEN paid_date ELSE NULL END,
            updated_at = NOW()
      WHERE id = $3`,
    [totalPaid, newStatus, invoiceId],
  );

  await logAudit({
    action: 'payment_deleted',
    targetType: 'crm_invoice',
    targetId: invoiceId,
    oldValue: `€${Number(payment.amount).toFixed(2)}`,
    reason: `Payment removed — status reverted to ${newStatus}`,
  });

  return NextResponse.json({ deleted: true, new_status: newStatus });
}
