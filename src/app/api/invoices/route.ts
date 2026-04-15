import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, generateId, logAudit } from '@/lib/db';

// POST /api/invoices — manually create an invoice and a default line.
// Used for outgoing invoices: the entity itself issued them, so the user has the data,
// no PDF to extract from. document_id is null for manual invoices.
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { declaration_id, direction } = body;

  if (!declaration_id) return NextResponse.json({ error: 'declaration_id is required' }, { status: 400 });
  if (!direction || !['incoming', 'outgoing'].includes(direction)) {
    return NextResponse.json({ error: 'direction must be incoming or outgoing' }, { status: 400 });
  }

  const declaration = await queryOne('SELECT * FROM declarations WHERE id = $1', [declaration_id]);
  if (!declaration) return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });

  const invoiceId = generateId();
  const lineId = generateId();

  // Insert invoice with document_id = NULL (manual entry)
  await execute(
    `INSERT INTO invoices (id, document_id, declaration_id, provider, country, direction, extraction_source)
     VALUES ($1, NULL, $2, $3, $4, $5, 'manual')`,
    [invoiceId, declaration_id, body.provider || '', body.country || 'LU', direction]
  );

  // Insert default empty line
  await execute(
    `INSERT INTO invoice_lines (id, invoice_id, declaration_id, description, amount_eur, sort_order, state)
     VALUES ($1, $2, $3, '', 0, 0, 'extracted')`,
    [lineId, invoiceId, declaration_id]
  );

  await logAudit({
    entityId: declaration.entity_id as string,
    declarationId: declaration_id,
    action: 'create',
    targetType: 'invoice',
    targetId: invoiceId,
    newValue: JSON.stringify({ direction, manual: true }),
  });

  return NextResponse.json({ invoice_id: invoiceId, line_id: lineId }, { status: 201 });
}
