import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { clusterDuplicates } from '@/lib/similarity';

// GET /api/tax-ops/entities/dedupe-candidates
//   ?threshold=0.85  (default 0.85; lower → more groups / more noise)
//
// Returns clusters of entities whose legal_name is near-duplicate per
// the normalize+Levenshtein scorer in src/lib/similarity.ts.
//
// Each cluster includes:
//   - members: [{ id, legal_name, client_group_id, client_group_name,
//                 vat_number, matricule, obligations_count,
//                 filings_count, latest_filing_year }]
//   - confidence: minimum pairwise score inside the cluster (0..1)
//
// Cluster sorted desc by confidence — Diego tackles the exact-matches
// first. Inactive entities excluded by default (we don't want to
// re-merge already-archived ones). Stint 40.A.

interface EntityRow {
  id: string;
  legal_name: string;
  client_group_id: string | null;
  client_group_name: string | null;
  vat_number: string | null;
  matricule: string | null;
  obligations_count: number;
  filings_count: number;
  latest_filing_year: number | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const thresholdRaw = url.searchParams.get('threshold');
  const threshold = thresholdRaw ? Number(thresholdRaw) : 0.85;
  if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 1) {
    return NextResponse.json(
      { error: 'threshold must be between 0.5 and 1' },
      { status: 400 },
    );
  }

  const rows = await query<EntityRow>(`
    SELECT e.id,
           e.legal_name,
           e.client_group_id,
           g.name AS client_group_name,
           e.vat_number,
           e.matricule,
           (SELECT COUNT(*)::int FROM tax_obligations o WHERE o.entity_id = e.id) AS obligations_count,
           (SELECT COUNT(*)::int FROM tax_filings f
              JOIN tax_obligations o ON o.id = f.obligation_id
             WHERE o.entity_id = e.id) AS filings_count,
           (SELECT MAX(f.period_year) FROM tax_filings f
              JOIN tax_obligations o ON o.id = f.obligation_id
             WHERE o.entity_id = e.id) AS latest_filing_year
      FROM tax_entities e
      LEFT JOIN tax_client_groups g ON g.id = e.client_group_id
     WHERE e.is_active = TRUE
     ORDER BY e.legal_name ASC
  `);

  const items = rows.map(r => ({ id: r.id, name: r.legal_name, __row: r }));
  const clusters = clusterDuplicates(items, threshold);

  // Project back into response shape with the full row attached.
  const response = clusters.map(c => ({
    confidence: c.confidence,
    members: c.members.map(m => ({
      id: m.__row.id,
      legal_name: m.__row.legal_name,
      client_group_id: m.__row.client_group_id,
      client_group_name: m.__row.client_group_name,
      vat_number: m.__row.vat_number,
      matricule: m.__row.matricule,
      obligations_count: m.__row.obligations_count,
      filings_count: m.__row.filings_count,
      latest_filing_year: m.__row.latest_filing_year,
    })),
  }));

  return NextResponse.json({
    threshold,
    total_entities_scanned: rows.length,
    clusters: response,
  });
}
