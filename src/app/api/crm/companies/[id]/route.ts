import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const company = await queryOne(
    `SELECT * FROM crm_companies WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  if (!company) return apiError('not_found', 'Company not found.', { status: 404 });

  // Pull related contacts via junction.
  const contacts = await query(
    `SELECT c.id, c.full_name, c.email, c.job_title, cc.role, cc.is_primary
       FROM crm_contact_companies cc
       JOIN crm_contacts c ON c.id = cc.contact_id
      WHERE cc.company_id = $1 AND c.deleted_at IS NULL
      ORDER BY cc.is_primary DESC, c.full_name ASC`,
    [id],
  );

  const opportunities = await query(
    `SELECT id, name, stage, estimated_value_eur, probability_pct, weighted_value_eur,
            estimated_close_date
       FROM crm_opportunities
      WHERE company_id = $1 AND deleted_at IS NULL
      ORDER BY
        CASE stage
          WHEN 'in_negotiation'  THEN 0
          WHEN 'proposal_sent'   THEN 1
          WHEN 'meeting_held'    THEN 2
          WHEN 'initial_contact' THEN 3
          WHEN 'lead_identified' THEN 4
          WHEN 'won'             THEN 5
          WHEN 'lost'            THEN 6
          ELSE 7
        END,
        estimated_close_date ASC NULLS LAST`,
    [id],
  );

  const matters = await query(
    `SELECT id, matter_reference, title, status, practice_areas, opening_date, closing_date
       FROM crm_matters
      WHERE client_company_id = $1 AND deleted_at IS NULL
      ORDER BY status ASC, opening_date DESC NULLS LAST`,
    [id],
  );

  const invoices = await query(
    `SELECT id, invoice_number, issue_date, due_date, amount_incl_vat, outstanding, status
       FROM crm_billing_invoices
      WHERE company_id = $1
      ORDER BY issue_date DESC NULLS LAST`,
    [id],
  );

  return NextResponse.json({ company, contacts, opportunities, matters, invoices });
}
