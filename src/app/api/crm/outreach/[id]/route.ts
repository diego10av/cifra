import { NextRequest, NextResponse } from 'next/server';
import { execute, logAudit, buildUpdate } from '@/lib/db';

const ALLOWED = [
  'name', 'firm_type', 'company_name', 'contact_linkedin_url', 'contact_email',
  'stage', 'next_action', 'next_action_date', 'notes', 'source',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const { sql, values, changes } = buildUpdate(
    'crm_outreach_prospects', ALLOWED, body, 'id', id, ['updated_at = NOW()'],
  );
  if (!sql) return NextResponse.json({ error: 'empty_patch' }, { status: 400 });
  await execute(sql, values);
  await logAudit({
    userId: 'founder',
    action: 'crm_outreach_update',
    targetType: 'crm_outreach_prospect',
    targetId: id,
    newValue: JSON.stringify(changes),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  await execute(`DELETE FROM crm_outreach_prospects WHERE id = $1`, [id]);
  await logAudit({
    userId: 'founder',
    action: 'crm_outreach_delete',
    targetType: 'crm_outreach_prospect',
    targetId: id,
  });
  return NextResponse.json({ ok: true });
}
