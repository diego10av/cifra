import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const stage = url.searchParams.get('stage');
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 200) || 200));

  const conditions: string[] = ['o.deleted_at IS NULL'];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`o.name ILIKE $${params.length}`);
  }
  if (stage) {
    params.push(stage);
    conditions.push(`o.stage = $${params.length}`);
  }
  params.push(limit);

  const rows = await query(
    `SELECT o.id, o.name, o.stage, o.stage_entered_at, o.practice_areas,
            o.estimated_value_eur, o.probability_pct, o.weighted_value_eur,
            o.first_contact_date, o.estimated_close_date, o.next_action, o.next_action_due,
            c.company_name AS company_name, c.id AS company_id,
            ct.full_name AS primary_contact_name, ct.id AS primary_contact_id
       FROM crm_opportunities o
       LEFT JOIN crm_companies c ON c.id = o.company_id
       LEFT JOIN crm_contacts ct ON ct.id = o.primary_contact_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE o.stage
          WHEN 'in_negotiation'  THEN 0
          WHEN 'proposal_sent'   THEN 1
          WHEN 'meeting_held'    THEN 2
          WHEN 'initial_contact' THEN 3
          WHEN 'lead_identified' THEN 4
          WHEN 'won'             THEN 5
          WHEN 'lost'            THEN 6
          ELSE 7
        END,
        o.estimated_close_date ASC NULLS LAST
      LIMIT $${params.length}`,
    params,
  );
  return NextResponse.json(rows);
}
