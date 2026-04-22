import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const contact = await queryOne(
    `SELECT * FROM crm_contacts WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (!contact) return apiError('not_found', 'Contact not found.', { status: 404 });

  const companies = await query(
    `SELECT c.id, c.company_name, c.classification, cc.role, cc.is_primary
       FROM crm_contact_companies cc
       JOIN crm_companies c ON c.id = cc.company_id
      WHERE cc.contact_id = $1 AND c.deleted_at IS NULL
      ORDER BY cc.is_primary DESC, c.company_name ASC`,
    [id],
  );

  const activities = await query(
    `SELECT id, name, activity_type, activity_date, duration_hours, billable, outcome
       FROM crm_activities
      WHERE primary_contact_id = $1
         OR id IN (SELECT activity_id FROM crm_activity_contacts WHERE contact_id = $1)
      ORDER BY activity_date DESC
      LIMIT 100`,
    [id],
  );

  return NextResponse.json({ contact, companies, activities });
}
