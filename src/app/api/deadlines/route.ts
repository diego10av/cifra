import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { computeDeadline, type Frequency, type Regime } from '@/lib/deadlines';

// GET /api/deadlines
// Returns: array of { entity_id, entity_name, regime, frequency, year, period,
//   declaration_id, declaration_status, due_date, days_until, bucket, ... }
//
// Always shows the next pending declaration per (entity, frequency). If a
// declaration exists in CREATED..APPROVED state it tracks that one; once
// FILED+PAID it shows the next upcoming period.
export async function GET() {
  // For each entity, find the open declaration. If none open, project the next
  // expected period based on today's date and the entity's frequency.
  const entities = await query<{
    id: string; name: string; regime: Regime | null; frequency: Frequency | null;
  }>(
    `SELECT id, name, regime, frequency
       FROM entities
      WHERE deleted_at IS NULL
      ORDER BY name ASC`
  );

  const today = new Date();
  const rows: unknown[] = [];

  for (const entity of entities) {
    if (!entity.regime || !entity.frequency) continue;

    // Find the most recent non-paid declaration for this entity, OR the most
    // recent paid one to project from.
    const openDecl = await query<{
      id: string; year: number; period: string; status: string;
      filed_at: string | null; payment_confirmed_at: string | null;
    }>(
      `SELECT id, year, period, status, filed_at, payment_confirmed_at
         FROM declarations
        WHERE entity_id = $1
        ORDER BY year DESC, period DESC, created_at DESC
        LIMIT 1`,
      [entity.id]
    );
    const decl = openDecl[0];

    if (decl && decl.status !== 'paid') {
      const dl = computeDeadline({
        regime: entity.regime, frequency: entity.frequency,
        year: decl.year, period: decl.period,
      });
      rows.push({
        entity_id: entity.id,
        entity_name: entity.name,
        regime: entity.regime,
        frequency: entity.frequency,
        declaration_id: decl.id,
        declaration_status: decl.status,
        year: decl.year,
        period: decl.period,
        ...dl,
      });
      continue;
    }

    // Project the next expected period (declaration not yet created)
    const next = projectNextPeriod(entity.frequency, today);
    const dl = computeDeadline({
      regime: entity.regime, frequency: entity.frequency,
      year: next.year, period: next.period,
    });
    rows.push({
      entity_id: entity.id,
      entity_name: entity.name,
      regime: entity.regime,
      frequency: entity.frequency,
      declaration_id: null,
      declaration_status: 'not_started',
      year: next.year,
      period: next.period,
      ...dl,
    });
  }

  return NextResponse.json(rows);
}

function projectNextPeriod(freq: Frequency, today: Date): { year: number; period: string } {
  const y = today.getUTCFullYear();
  if (freq === 'annual') {
    // Either current year (if not yet 1 March of Y+1) or next
    return { year: y - 1, period: 'Y1' };
  }
  if (freq === 'quarterly') {
    const m = today.getUTCMonth() + 1;
    // Most recent completed quarter
    if (m >= 1 && m <= 3) return { year: y - 1, period: 'Q4' };
    if (m <= 6) return { year: y, period: 'Q1' };
    if (m <= 9) return { year: y, period: 'Q2' };
    return { year: y, period: 'Q3' };
  }
  // monthly
  const m = today.getUTCMonth() + 1;
  if (m === 1) return { year: y - 1, period: '12' };
  return { year: y, period: String(m - 1).padStart(2, '0') };
}
