// ════════════════════════════════════════════════════════════════════════
// GET /api/closing?period=2026-Q1
//
// Period-closing dashboard endpoint. For a chosen period (monthly /
// quarterly / half-yearly / yearly), returns ONE row per entity showing
// the status of its declaration for that period: not-started / uploading
// / extracting / classifying / review / approved / filed / paid.
//
// Powers /closing (stint 12 extra #10). The end-of-quarter ritual of
// "which entities still need the Q1 declaration?" becomes one page
// instead of scanning the whole declarations list + cross-referencing
// entity frequency.
//
// Period format:
//   YYYY-Mmm      → month e.g. 2026-M03
//   YYYY-Qn       → quarter e.g. 2026-Q1
//   YYYY-Sn       → semestrial
//   YYYY-Y        → annual
//   YYYY          → synonym for YYYY-Y
// ════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';

interface EntityStatus {
  entity_id: string;
  entity_name: string;
  client_id: string | null;
  client_name: string | null;
  regime: string;
  frequency: string;
  expected: boolean;
  declaration_id: string | null;
  declaration_status: string | null;
  line_count: number;
  vat_payable: number | null;
  filed_at: string | null;
}

interface Response {
  period: string;
  year: number;
  kind: 'month' | 'quarter' | 'semester' | 'annual';
  code: string;
  rows: EntityStatus[];
  summary: {
    expected: number;
    not_started: number;
    in_progress: number;
    in_review: number;
    approved: number;
    filed: number;
    paid: number;
  };
}

function parsePeriod(raw: string): { year: number; kind: Response['kind']; code: string } | null {
  // '2026-Q1', '2026-M03', '2026-S1', '2026-Y', '2026'
  const m = raw.match(/^(\d{4})(?:-(Q[1-4]|M(?:0[1-9]|1[0-2])|S[12]|Y))?$/);
  if (!m) return null;
  const year = Number(m[1]);
  const codeRaw = m[2] ?? 'Y';
  if (codeRaw.startsWith('Q')) return { year, kind: 'quarter', code: codeRaw };
  if (codeRaw.startsWith('M')) return { year, kind: 'month', code: codeRaw.slice(1) };
  if (codeRaw.startsWith('S')) return { year, kind: 'semester', code: codeRaw };
  return { year, kind: 'annual', code: 'Y' };
}

function expectedCode(kind: Response['kind'], code: string): string {
  // Declarations carry period as Q1 / 01 / S1 / Y1.
  if (kind === 'quarter') return code;
  if (kind === 'month') return code;
  if (kind === 'semester') return code;
  return 'Y1';
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const periodRaw = url.searchParams.get('period') || '';
    const parsed = parsePeriod(periodRaw);
    if (!parsed) {
      return apiError('bad_period',
        'period must look like 2026-Q1 / 2026-M03 / 2026-S1 / 2026-Y',
        { status: 400 });
    }

    const { year, kind, code } = parsed;
    const expectedFreq = kind === 'quarter' ? 'quarterly'
      : kind === 'month' ? 'monthly'
      : kind === 'semester' ? 'semestrial'
      : 'yearly';
    const periodCode = expectedCode(kind, code);

    // One row per entity + LEFT JOIN the declaration for (year, period_code).
    const rows = await query<{
      entity_id: string;
      entity_name: string;
      client_id: string | null;
      client_name: string | null;
      regime: string;
      frequency: string;
      declaration_id: string | null;
      declaration_status: string | null;
      line_count: string | null;
      vat_payable: string | null;
      filed_at: string | null;
    }>(
      `SELECT e.id AS entity_id,
              e.name AS entity_name,
              e.client_id,
              c.name AS client_name,
              e.regime,
              e.frequency,
              d.id AS declaration_id,
              d.status AS declaration_status,
              (SELECT COUNT(*)::text FROM invoice_lines il
                 WHERE il.declaration_id = d.id AND il.state != 'deleted') AS line_count,
              d.vat_payable::text AS vat_payable,
              d.filed_at::text AS filed_at
         FROM entities e
    LEFT JOIN clients c ON e.client_id = c.id
    LEFT JOIN declarations d
           ON d.entity_id = e.id
          AND d.year = $1
          AND d.period = $2
        ORDER BY
          CASE WHEN e.frequency = $3 THEN 0 ELSE 1 END,
          CASE d.status
            WHEN 'review'   THEN 1
            WHEN 'approved' THEN 2
            WHEN 'filed'    THEN 3
            WHEN 'paid'     THEN 4
            ELSE 0
          END,
          lower(e.name)`,
      [year, periodCode, expectedFreq],
    );

    const out: EntityStatus[] = rows.map(r => ({
      entity_id: r.entity_id,
      entity_name: r.entity_name,
      client_id: r.client_id,
      client_name: r.client_name,
      regime: r.regime,
      frequency: r.frequency,
      expected: r.frequency === expectedFreq,
      declaration_id: r.declaration_id,
      declaration_status: r.declaration_status,
      line_count: Number(r.line_count ?? 0),
      vat_payable: r.vat_payable != null ? Number(r.vat_payable) : null,
      filed_at: r.filed_at,
    }));

    // Summary only counts entities where this period is expected
    // given their frequency (a yearly-filer doesn't count against
    // Q1 completion).
    const expected = out.filter(r => r.expected);
    const summary = {
      expected: expected.length,
      not_started: expected.filter(r => !r.declaration_id).length,
      in_progress: expected.filter(r => r.declaration_status
        && ['created', 'uploading', 'extracting', 'classifying'].includes(r.declaration_status)).length,
      in_review: expected.filter(r => r.declaration_status === 'review').length,
      approved: expected.filter(r => r.declaration_status === 'approved').length,
      filed: expected.filter(r => r.declaration_status === 'filed').length,
      paid: expected.filter(r => r.declaration_status === 'paid').length,
    };

    return apiOk({
      period: `${year}-${code}`,
      year,
      kind,
      code,
      rows: out,
      summary,
    } satisfies Response);
  } catch (err) {
    return apiFail(err, 'closing');
  }
}
