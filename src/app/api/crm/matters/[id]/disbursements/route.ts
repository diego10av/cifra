import { NextRequest, NextResponse } from 'next/server';
import { query, execute, generateId, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

// GET — list disbursements for a matter, newest first.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rows = await query(
    `SELECT d.id, d.disbursement_date::text AS disbursement_date,
            d.description, d.amount_eur, d.currency, d.billable,
            d.billed_on_invoice_id, d.category, d.receipt_url, d.notes,
            d.created_at::text AS created_at, d.created_by,
            i.invoice_number AS billed_invoice_number
       FROM crm_disbursements d
       LEFT JOIN crm_billing_invoices i ON i.id = d.billed_on_invoice_id
      WHERE d.matter_id = $1
      ORDER BY d.disbursement_date DESC, d.created_at DESC`,
    [id],
  );
  return NextResponse.json(rows);
}

// POST — log a disbursement.
// Body: { disbursement_date, description, amount_eur, category?,
//         billable?, currency?, receipt_url?, notes? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  const body = await request.json().catch(() => ({}));

  const desc = typeof body.description === 'string' ? body.description.trim() : '';
  if (!desc) return apiError('description_required', 'description is required.', { status: 400 });

  const amount = Number(body.amount_eur);
  if (!Number.isFinite(amount) || amount <= 0) {
    return apiError('amount_invalid', 'amount_eur must be > 0.', { status: 400 });
  }
  const disbursementDate = typeof body.disbursement_date === 'string' ? body.disbursement_date : null;
  if (!disbursementDate) {
    return apiError('date_required', 'disbursement_date is required (YYYY-MM-DD).', { status: 400 });
  }

  const id = generateId();
  await execute(
    `INSERT INTO crm_disbursements
       (id, matter_id, disbursement_date, description, amount_eur, currency,
        billable, category, receipt_url, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id, matterId, disbursementDate, desc, amount,
      body.currency ?? 'EUR',
      body.billable !== false,     // default true
      body.category ?? null,
      body.receipt_url ?? null,
      body.notes ?? null,
      body.created_by ?? 'founder',
    ],
  );

  await logAudit({
    action: 'disbursement_logged',
    targetType: 'crm_matter',
    targetId: matterId,
    field: 'disbursement',
    newValue: String(amount),
    reason: `Disbursement: ${desc} · €${amount.toFixed(2)}`,
  });

  return NextResponse.json({ id, amount_eur: amount, billable: body.billable !== false }, { status: 201 });
}
