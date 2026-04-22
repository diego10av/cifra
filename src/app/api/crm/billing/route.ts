import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

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
