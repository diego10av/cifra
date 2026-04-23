import { NextRequest, NextResponse } from 'next/server';
import { query, execute, generateId, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';
import { nextInvoiceNumber } from '@/lib/crm-invoice-number';
import { fetchECBRate } from '@/lib/ecb';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const year = url.searchParams.get('year');
  const companyId = url.searchParams.get('company_id');
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 200) || 200));

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`b.invoice_number ILIKE $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`b.status = $${params.length}`);
  }
  if (year) {
    params.push(Number(year));
    conditions.push(`EXTRACT(YEAR FROM b.issue_date) = $${params.length}`);
  }
  if (companyId) {
    params.push(companyId);
    conditions.push(`b.company_id = $${params.length}`);
  }
  params.push(limit);

  const rows = await query(
    `SELECT b.id, b.invoice_number, b.issue_date, b.due_date, b.currency,
            b.amount_excl_vat, b.vat_rate, b.vat_amount, b.amount_incl_vat,
            b.amount_paid, b.outstanding, b.status, b.payment_method, b.paid_date,
            c.company_name AS client_name, c.id AS client_id,
            m.matter_reference AS matter_reference, m.id AS matter_id
       FROM crm_billing_invoices b
       LEFT JOIN crm_companies c ON c.id = b.company_id
       LEFT JOIN crm_matters   m ON m.id = b.matter_id
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      ORDER BY b.issue_date DESC NULLS LAST, b.invoice_number DESC
      LIMIT $${params.length}`,
    params,
  );

  // Summary totals for the filtered set (useful for the list footer).
  const summary = await query<{
    total_excl_vat: string;
    total_vat: string;
    total_incl_vat: string;
    total_paid: string;
    total_outstanding: string;
  }>(
    `SELECT
        COALESCE(SUM(b.amount_excl_vat), 0)::text AS total_excl_vat,
        COALESCE(SUM(b.vat_amount), 0)::text      AS total_vat,
        COALESCE(SUM(b.amount_incl_vat), 0)::text AS total_incl_vat,
        COALESCE(SUM(b.amount_paid), 0)::text     AS total_paid,
        COALESCE(SUM(b.outstanding), 0)::text     AS total_outstanding
       FROM crm_billing_invoices b
      ${conditions.length ? 'WHERE ' + conditions.slice(0, conditions.length).join(' AND ') : ''}`,
    params.slice(0, -1),  // drop the limit param
  );

  return NextResponse.json({ invoices: rows, summary: summary[0] ?? null });
}

// POST /api/crm/billing — create an invoice.
// Required: company_id + amount_excl_vat + vat_rate OR (amount_incl_vat + vat_amount).
// Invoice number auto-generated unless provided. Status defaults to 'draft'.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const companyId = typeof body.company_id === 'string' ? body.company_id : null;
  const amountExcl = body.amount_excl_vat !== undefined ? Number(body.amount_excl_vat) : null;
  const vatRate = body.vat_rate !== undefined && body.vat_rate !== null ? Number(body.vat_rate) : null;
  const providedIncl = body.amount_incl_vat !== undefined ? Number(body.amount_incl_vat) : null;

  if (!companyId) return apiError('company_required', 'company_id is required.', { status: 400 });
  if (amountExcl === null || !Number.isFinite(amountExcl)) {
    return apiError('amount_required', 'amount_excl_vat is required.', { status: 400 });
  }

  // Compute VAT if not provided explicitly.
  const vatAmount = vatRate !== null && Number.isFinite(vatRate)
    ? Math.round(amountExcl * vatRate) / 100 * (Math.abs(vatRate) < 1 ? 100 : 1)  // handle both 17 and 0.17 inputs
    : (providedIncl !== null ? providedIncl - amountExcl : null);
  const amountIncl = providedIncl !== null && Number.isFinite(providedIncl)
    ? providedIncl
    : amountExcl + (vatAmount ?? 0);

  const invoiceNumber = typeof body.invoice_number === 'string' && body.invoice_number.trim()
    ? body.invoice_number.trim()
    : await nextInvoiceNumber();

  // Multi-currency: snapshot the ECB reference rate on the issue
  // date so downstream EUR conversions are stable. Skip for EUR
  // (rate = 1 implicitly). Fails open — a missing FX rate doesn't
  // block invoice creation; we set NULL and the UI shows a warning.
  const currency = body.currency ?? 'EUR';
  let fxRate: number | null = null;
  if (currency !== 'EUR' && body.issue_date) {
    fxRate = await fetchECBRate(currency, body.issue_date);
  }

  const id = generateId();
  await execute(
    `INSERT INTO crm_billing_invoices
       (id, invoice_number, company_id, matter_id, primary_contact_id,
        issue_date, due_date, currency, amount_excl_vat, vat_rate, vat_amount,
        amount_incl_vat, status, payment_method, line_items, notes,
        fx_rate_at_issue, fx_currency_at_issue, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,NOW())`,
    [
      id, invoiceNumber, companyId,
      body.matter_id ?? null,
      body.primary_contact_id ?? null,
      body.issue_date ?? null,
      body.due_date ?? null,
      currency,
      amountExcl,
      vatRate,
      vatAmount,
      amountIncl,
      body.status ?? 'draft',
      body.payment_method ?? null,
      JSON.stringify(Array.isArray(body.line_items) ? body.line_items : []),
      body.notes ?? null,
      fxRate,
      currency !== 'EUR' ? currency : null,
    ],
  );

  await logAudit({
    action: 'create',
    targetType: 'crm_invoice',
    targetId: id,
    newValue: `${invoiceNumber} · €${amountIncl.toFixed(2)}`,
    reason: 'New invoice',
  });
  return NextResponse.json({ id, invoice_number: invoiceNumber, amount_incl_vat: amountIncl }, { status: 201 });
}
