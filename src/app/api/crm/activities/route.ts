import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const activityType = url.searchParams.get('type');
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 200) || 200));

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(a.name ILIKE $${params.length} OR a.notes ILIKE $${params.length})`);
  }
  if (activityType) {
    params.push(activityType);
    conditions.push(`a.activity_type = $${params.length}`);
  }
  params.push(limit);

  const rows = await query(
    `SELECT a.id, a.name, a.activity_type, a.activity_date, a.duration_hours, a.billable,
            a.outcome,
            c.company_name AS company_name,
            o.name AS opportunity_name,
            m.matter_reference AS matter_reference,
            ct.full_name AS contact_name
       FROM crm_activities a
       LEFT JOIN crm_companies c     ON c.id = a.company_id
       LEFT JOIN crm_opportunities o ON o.id = a.opportunity_id
       LEFT JOIN crm_matters m       ON m.id = a.matter_id
       LEFT JOIN crm_contacts ct     ON ct.id = a.primary_contact_id
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      ORDER BY a.activity_date DESC
      LIMIT $${params.length}`,
    params,
  );
  return NextResponse.json(rows);
}
