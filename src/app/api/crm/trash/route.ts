import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/crm/trash — list all soft-deleted rows across CRM entity
// tables. Only tables with a `deleted_at` column participate:
// companies, contacts, opportunities, matters. (Activities, tasks,
// invoices use hard delete + cancelled status — out of trash scope.)
export async function GET() {
  const companies = await query(
    `SELECT 'company' AS kind, id, company_name AS label, deleted_at
       FROM crm_companies WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
  );
  const contacts = await query(
    `SELECT 'contact' AS kind, id, full_name AS label, deleted_at
       FROM crm_contacts WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
  );
  const opportunities = await query(
    `SELECT 'opportunity' AS kind, id, name AS label, deleted_at
       FROM crm_opportunities WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
  );
  const matters = await query(
    `SELECT 'matter' AS kind, id, matter_reference || ' — ' || title AS label, deleted_at
       FROM crm_matters WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`,
  );

  const all = [...companies, ...contacts, ...opportunities, ...matters]
    .sort((a, b) => String((b as { deleted_at: string }).deleted_at).localeCompare(String((a as { deleted_at: string }).deleted_at)));

  return NextResponse.json(all);
}
