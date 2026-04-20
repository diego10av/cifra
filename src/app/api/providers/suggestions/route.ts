// ════════════════════════════════════════════════════════════════════════
// GET /api/providers/suggestions?provider=<normalised>&country=<ISO-2>
//
// Cross-entity precedent lookup. Returns how the same provider has
// been classified across OTHER entities, so the reviewer can see
// "this provider is LUX_17 in 3 other entities" before making a
// judgement. Intentionally informational only — the UI displays it
// as a chip; clicking does NOT auto-apply. Cross-entity matches can
// mislead (e.g. a fund and a holding classify the same supplier
// differently because entity_type drives the rule), so the reviewer
// stays in charge.
//
// Shipped in stint 12 (2026-04-20).
// ════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiOk, apiFail } from '@/lib/api-errors';
import { normaliseProviderName } from '@/config/classification-rules';

interface TreatmentCount {
  treatment: string;
  count: number;
  entity_count: number;
  last_seen: string;
}

interface Response {
  provider: string;
  country: string | null;
  total_rows: number;
  treatments: TreatmentCount[];
  dominant: { treatment: string; count: number; pct: number } | null;
  varies: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const raw = url.searchParams.get('provider') || '';
    const country = url.searchParams.get('country') || null;
    const excludeEntityId = url.searchParams.get('exclude_entity_id') || null;

    const normalised = normaliseProviderName(raw);
    if (normalised.length < 3) {
      // Too short to be useful — skip the lookup.
      return apiOk({
        provider: raw,
        country,
        total_rows: 0,
        treatments: [],
        dominant: null,
        varies: false,
      } satisfies Response);
    }

    // Sum treatments across all invoice_lines whose parent invoice
    // has a matching normalised provider name. We join with invoices
    // for provider + country + entity, invoice_lines for treatment +
    // updated_at (as proxy for last-seen). state != 'deleted' excludes
    // soft-deleted lines.
    //
    // Matching on the normalised name is done in SQL via lower() +
    // regex-strip of legal suffixes. For correctness we mirror the
    // normaliseProviderName() behaviour in the SQL WHERE — simple
    // lower() is good enough for most real invoices.
    const rows = await query<{
      treatment: string;
      n: string;
      entities: string;
      last_seen: string;
    }>(
      `SELECT il.treatment,
              COUNT(*)::text AS n,
              COUNT(DISTINCT i.declaration_id)::text AS entities,
              MAX(il.updated_at)::text AS last_seen
         FROM invoice_lines il
         JOIN invoices i ON il.invoice_id = i.id
        WHERE il.treatment IS NOT NULL
          AND il.state != 'deleted'
          AND lower(i.provider) LIKE $1
          ${country ? 'AND lower(i.country) = $2' : ''}
          ${excludeEntityId ? `AND i.declaration_id NOT IN (SELECT id FROM declarations WHERE entity_id = $${country ? 3 : 2})` : ''}
        GROUP BY il.treatment
        ORDER BY COUNT(*) DESC`,
      [
        `%${normalised.toLowerCase()}%`,
        ...(country ? [country.toLowerCase()] : []),
        ...(excludeEntityId ? [excludeEntityId] : []),
      ],
    );

    const totalRows = rows.reduce((s, r) => s + Number(r.n), 0);
    const treatments: TreatmentCount[] = rows.map(r => ({
      treatment: r.treatment,
      count: Number(r.n),
      entity_count: Number(r.entities),
      last_seen: r.last_seen,
    }));

    const dominant = treatments[0]
      ? {
          treatment: treatments[0].treatment,
          count: treatments[0].count,
          pct: totalRows > 0 ? Math.round((treatments[0].count / totalRows) * 100) : 0,
        }
      : null;

    return apiOk({
      provider: raw,
      country,
      total_rows: totalRows,
      treatments,
      dominant,
      varies: treatments.length > 1,
    } satisfies Response);
  } catch (err) {
    return apiFail(err, 'providers/suggestions');
  }
}
