import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, generateId, logAudit, initializeSchema } from '@/lib/db';

// GET /api/declarations?entity_id=xxx
export async function GET(request: NextRequest) {
  await initializeSchema();
  const entityId = request.nextUrl.searchParams.get('entity_id');

  if (entityId) {
    const declarations = await query(
      `SELECT d.*, e.name as entity_name FROM declarations d
       JOIN entities e ON d.entity_id = e.id
       WHERE d.entity_id = $1 ORDER BY d.year DESC, d.period DESC`,
      [entityId]
    );
    return NextResponse.json(declarations);
  }

  const declarations = await query(
    `SELECT d.*, e.name as entity_name FROM declarations d
     JOIN entities e ON d.entity_id = e.id ORDER BY d.created_at DESC`
  );
  return NextResponse.json(declarations);
}

// POST /api/declarations
export async function POST(request: NextRequest) {
  await initializeSchema();
  const body = await request.json();

  const entity = await queryOne<{ id: string; regime: string }>(
    'SELECT id, regime FROM entities WHERE id = $1',
    [body.entity_id]
  );
  if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 400 });

  const existing = await queryOne(
    'SELECT id FROM declarations WHERE entity_id = $1 AND year = $2 AND period = $3',
    [body.entity_id, body.year, body.period]
  );
  if (existing) return NextResponse.json({ error: 'Declaration already exists for this entity, year, and period' }, { status: 409 });

  // Regime + period consistency.
  // The Luxembourg simplified regime (TVA001N) is ANNUAL by definition —
  // there is no simplified quarterly or monthly return. The AED migrates
  // a taxpayer to the ordinary regime if their turnover breaches the
  // simplified threshold (roughly EUR 620k). Creating a (simplified,
  // Q1..4 | monthly) declaration silently generates XML that the AED
  // eCDF validator rejects as a schema mismatch. Block it at creation.
  const period: string = String(body.period || '').trim().toUpperCase();
  const isAnnualPeriod = period === 'Y1' || period === 'ANNUAL' || period === '';
  if (entity.regime === 'simplified' && !isAnnualPeriod) {
    return NextResponse.json({
      error: 'Simplified regime does not support sub-annual periods',
      hint: 'The simplified regime (TVA001N) files annually only. Either change the entity regime to ordinary or use period Y1.',
    }, { status: 400 });
  }

  const id = generateId();
  await execute(
    `INSERT INTO declarations (id, entity_id, year, period, status, notes)
     VALUES ($1, $2, $3, $4, 'created', $5)`,
    [id, body.entity_id, body.year, body.period, body.notes || null]
  );

  await logAudit({
    entityId: body.entity_id, declarationId: id,
    action: 'create', targetType: 'declaration', targetId: id,
    newValue: JSON.stringify({ year: body.year, period: body.period }),
  });

  const declaration = await queryOne(
    `SELECT d.*, e.name as entity_name FROM declarations d
     JOIN entities e ON d.entity_id = e.id WHERE d.id = $1`,
    [id]
  );
  return NextResponse.json(declaration, { status: 201 });
}
