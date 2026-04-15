import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db';

// GET /api/entities/[id]/suggest-period
// Returns the next expected { year, period } for a declaration based on the
// entity's frequency and the most recent filed/paid period.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entity = await queryOne<{ frequency: string }>(
    'SELECT frequency FROM entities WHERE id = $1',
    [id]
  );
  if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });

  // Find the most recent declaration for this entity
  const last = await queryOne<{ year: number; period: string; status: string }>(
    `SELECT year, period, status FROM declarations
      WHERE entity_id = $1
      ORDER BY year DESC, period DESC, created_at DESC
      LIMIT 1`,
    [id]
  );

  // Check which periods already exist to avoid suggesting a duplicate.
  const existing = await query<{ year: number; period: string }>(
    `SELECT year, period FROM declarations WHERE entity_id = $1`,
    [id]
  );
  const taken = new Set(existing.map(e => `${e.year}:${e.period}`));

  const suggestion = nextPeriod(entity.frequency, last?.year, last?.period, taken);
  return NextResponse.json(suggestion);
}

function nextPeriod(
  frequency: string,
  lastYear: number | undefined,
  lastPeriod: string | undefined,
  taken: Set<string>
): { year: number; period: string } {
  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth() + 1; // 1-12

  // If no prior declaration, suggest the most recent completed period.
  if (!lastYear || !lastPeriod) {
    if (frequency === 'annual') return available(currentYear - 1, 'Y1', taken, frequency);
    if (frequency === 'quarterly') {
      // Most recent completed quarter
      const { y, q } = mostRecentCompletedQuarter(currentYear, currentMonth);
      return available(y, `Q${q}`, taken, frequency);
    }
    // monthly
    const prev = currentMonth === 1
      ? { y: currentYear - 1, m: 12 }
      : { y: currentYear, m: currentMonth - 1 };
    return available(prev.y, String(prev.m).padStart(2, '0'), taken, frequency);
  }

  // Advance one period from the last one
  if (frequency === 'annual') return available(lastYear + 1, 'Y1', taken, frequency);
  if (frequency === 'quarterly') {
    const q = parseInt(lastPeriod.replace(/[^0-9]/g, ''), 10);
    if (q === 4) return available(lastYear + 1, 'Q1', taken, frequency);
    return available(lastYear, `Q${q + 1}`, taken, frequency);
  }
  // monthly
  const m = parseInt(lastPeriod.replace(/[^0-9]/g, ''), 10);
  if (m === 12) return available(lastYear + 1, '01', taken, frequency);
  return available(lastYear, String(m + 1).padStart(2, '0'), taken, frequency);
}

function available(year: number, period: string, taken: Set<string>, frequency: string): { year: number; period: string } {
  // Walk forward until we find a period that doesn't exist yet.
  let y = year, p = period;
  for (let i = 0; i < 60; i++) {
    if (!taken.has(`${y}:${p}`)) return { year: y, period: p };
    ({ y, p } = advance(y, p, frequency));
  }
  return { year, period };
}
function advance(y: number, p: string, frequency: string): { y: number; p: string } {
  if (frequency === 'annual') return { y: y + 1, p: 'Y1' };
  if (frequency === 'quarterly') {
    const q = parseInt(p.replace(/[^0-9]/g, ''), 10);
    return q === 4 ? { y: y + 1, p: 'Q1' } : { y, p: `Q${q + 1}` };
  }
  const m = parseInt(p.replace(/[^0-9]/g, ''), 10);
  return m === 12 ? { y: y + 1, p: '01' } : { y, p: String(m + 1).padStart(2, '0') };
}

function mostRecentCompletedQuarter(year: number, month: number): { y: number; q: number } {
  if (month <= 3) return { y: year - 1, q: 4 };
  if (month <= 6) return { y: year, q: 1 };
  if (month <= 9) return { y: year, q: 2 };
  return { y: year, q: 3 };
}
