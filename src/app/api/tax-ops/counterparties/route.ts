import { NextRequest, NextResponse } from 'next/server';
import { query, execute, generateId, logAudit } from '@/lib/db';

// GET  /api/tax-ops/counterparties             — list (active) + optional ?q=search
// POST /api/tax-ops/counterparties             — create

const ALLOWED_ROLES = [
  'tax_counsel', 'corporate_counsel', 'csp', 'auditor', 'notary', 'bank',
  'internal_tax', 'internal_corporate', 'internal_admin',
  'client_contact', 'other',
] as const;

const ALLOWED_SIDES = ['internal', 'external'] as const;

interface CounterpartyRow {
  id: string;
  display_name: string;
  organization: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  jurisdiction: string | null;
  role: string | null;
  side: string;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const includeArchived = url.searchParams.get('include_archived') === '1';

  const where: string[] = [];
  const params: unknown[] = [];
  if (!includeArchived) where.push('archived_at IS NULL');
  if (q) {
    params.push(`%${q}%`);
    const i = params.length;
    where.push(
      `(display_name ILIKE $${i} OR organization ILIKE $${i} OR contact_name ILIKE $${i} OR contact_email ILIKE $${i})`,
    );
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await query<CounterpartyRow>(
    `SELECT id, display_name, organization, contact_name, contact_email,
            contact_phone, jurisdiction, role, side, notes,
            archived_at::text AS archived_at,
            created_at::text  AS created_at,
            updated_at::text  AS updated_at
       FROM tax_ops_counterparties
       ${whereSql}
      ORDER BY display_name ASC`,
    params,
  );
  return NextResponse.json({ counterparties: rows });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as Partial<CounterpartyRow>;
  const display_name = body.display_name?.trim();
  if (!display_name) {
    return NextResponse.json({ error: 'display_name_required' }, { status: 400 });
  }
  const role = body.role && (ALLOWED_ROLES as readonly string[]).includes(body.role)
    ? body.role : null;
  const side = body.side && (ALLOWED_SIDES as readonly string[]).includes(body.side)
    ? body.side : 'external';

  const id = generateId();
  await execute(
    `INSERT INTO tax_ops_counterparties
       (id, display_name, organization, contact_name, contact_email, contact_phone,
        jurisdiction, role, side, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id, display_name,
      body.organization?.trim() || null,
      body.contact_name?.trim() || null,
      body.contact_email?.trim() || null,
      body.contact_phone?.trim() || null,
      body.jurisdiction?.trim()?.slice(0, 2)?.toUpperCase() || null,
      role, side,
      body.notes?.trim() || null,
    ],
  );
  await logAudit({
    userId: 'founder',
    action: 'tax_counterparty_create',
    targetType: 'tax_ops_counterparty',
    targetId: id,
    newValue: JSON.stringify({ display_name, role, side }),
  });
  return NextResponse.json({ id });
}
