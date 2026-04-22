import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const opp = await queryOne(
    `SELECT o.*, c.company_name AS company_name, ct.full_name AS primary_contact_name
       FROM crm_opportunities o
       LEFT JOIN crm_companies c ON c.id = o.company_id
       LEFT JOIN crm_contacts ct ON ct.id = o.primary_contact_id
      WHERE o.id = $1 AND o.deleted_at IS NULL`,
    [id],
  );
  if (!opp) return apiError('not_found', 'Opportunity not found.', { status: 404 });

  const activities = await query(
    `SELECT id, name, activity_type, activity_date, duration_hours, billable, outcome, notes
       FROM crm_activities
      WHERE opportunity_id = $1
      ORDER BY activity_date DESC`,
    [id],
  );

  return NextResponse.json({ opportunity: opp, activities });
}
