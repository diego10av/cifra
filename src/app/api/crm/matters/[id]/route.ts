import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = await queryOne(
    `SELECT m.*, c.company_name AS client_name, c.id AS client_id,
            ct.full_name AS primary_contact_name, ct.id AS primary_contact_id
       FROM crm_matters m
       LEFT JOIN crm_companies c ON c.id = m.client_company_id
       LEFT JOIN crm_contacts ct ON ct.id = m.primary_contact_id
      WHERE m.id = $1 AND m.deleted_at IS NULL`,
    [id],
  );
  if (!matter) return apiError('not_found', 'Matter not found.', { status: 404 });

  const activities = await query(
    `SELECT id, name, activity_type, activity_date, duration_hours, billable, outcome
       FROM crm_activities WHERE matter_id = $1 ORDER BY activity_date DESC`,
    [id],
  );

  const invoices = await query(
    `SELECT id, invoice_number, issue_date, due_date, amount_incl_vat, outstanding, status
       FROM crm_billing_invoices WHERE matter_id = $1 ORDER BY issue_date DESC NULLS LAST`,
    [id],
  );

  return NextResponse.json({ matter, activities, invoices });
}
