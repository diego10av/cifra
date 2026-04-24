import { NextRequest, NextResponse } from 'next/server';
import { query, execute, generateId, logAudit } from '@/lib/db';

// GET  /api/crm/outreach — list all prospects, newest first
// POST /api/crm/outreach — create { name, firm_type?, company_name?, contact_*? }

interface Row {
  id: string;
  name: string;
  firm_type: string | null;
  company_name: string | null;
  contact_linkedin_url: string | null;
  contact_email: string | null;
  stage: string;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

const VALID_STAGES = ['identified', 'warm', 'first_touch', 'meeting_booked', 'proposal', 'won', 'lost'];

export async function GET() {
  const rows = await query<Row>(
    `SELECT id, name, firm_type, company_name, contact_linkedin_url, contact_email,
            stage, next_action, next_action_date::text, notes, source,
            created_at::text, updated_at::text
       FROM crm_outreach_prospects
      ORDER BY
        CASE stage
          WHEN 'meeting_booked' THEN 0 WHEN 'proposal' THEN 1
          WHEN 'warm' THEN 2 WHEN 'first_touch' THEN 3
          WHEN 'identified' THEN 4 WHEN 'won' THEN 5 WHEN 'lost' THEN 6
          ELSE 7 END,
        next_action_date ASC NULLS LAST,
        created_at DESC`,
  );
  return NextResponse.json({ prospects: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Partial<Row>;
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 });
  }
  const stage = VALID_STAGES.includes(body.stage ?? '') ? body.stage! : 'identified';
  const id = generateId();
  await execute(
    `INSERT INTO crm_outreach_prospects
       (id, name, firm_type, company_name, contact_linkedin_url, contact_email,
        stage, next_action, next_action_date, notes, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id, body.name.trim(),
      body.firm_type ?? null, body.company_name?.trim() ?? null,
      body.contact_linkedin_url?.trim() ?? null, body.contact_email?.trim() ?? null,
      stage, body.next_action?.trim() ?? null,
      body.next_action_date ?? null,
      body.notes ?? null, body.source ?? null,
    ],
  );
  await logAudit({
    userId: 'founder',
    action: 'crm_outreach_create',
    targetType: 'crm_outreach_prospect',
    targetId: id,
    newValue: JSON.stringify({ name: body.name, stage }),
  });
  return NextResponse.json({ id });
}
