import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 200) || 200));

  const conditions: string[] = ['m.deleted_at IS NULL'];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(m.matter_reference ILIKE $${params.length} OR m.title ILIKE $${params.length})`);
  }
  if (status) {
    params.push(status);
    conditions.push(`m.status = $${params.length}`);
  }
  params.push(limit);

  const rows = await query(
    `SELECT m.id, m.matter_reference, m.title, m.status, m.practice_areas,
            m.fee_type, m.hourly_rate_eur, m.opening_date, m.closing_date,
            m.conflict_check_done,
            c.company_name AS client_name, c.id AS client_id,
            (SELECT COALESCE(SUM(amount_incl_vat), 0) FROM crm_billing_invoices WHERE matter_id = m.id) AS total_billed,
            (SELECT COALESCE(SUM(duration_hours), 0) FROM crm_activities WHERE matter_id = m.id) AS total_hours
       FROM crm_matters m
       LEFT JOIN crm_companies c ON c.id = m.client_company_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE m.status
          WHEN 'active'   THEN 0
          WHEN 'on_hold'  THEN 1
          WHEN 'closed'   THEN 2
          WHEN 'archived' THEN 3
          ELSE 4
        END,
        m.opening_date DESC NULLS LAST
      LIMIT $${params.length}`,
    params,
  );
  return NextResponse.json(rows);
}
