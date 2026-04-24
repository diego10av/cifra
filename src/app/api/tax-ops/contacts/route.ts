import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/tax-ops/contacts
//
// Stint 42.B — reverse index over every `csp_contacts` array stored
// on `tax_entities` + `tax_filings`. Groups occurrences by normalised
// email (lower-cased, trimmed) so Diego can see "jane@csp.com appears
// in 12 entities + 45 filings". Scenario: when that contact changes
// email, Diego uses /rename to propagate the new address to every row
// at once.

interface ContactRow {
  email_norm: string;
  name: string | null;
  email: string | null;
  role: string | null;
  entity_count: number;
  filing_count: number;
  sample_entities: string[];
}

export async function GET(_request: NextRequest): Promise<NextResponse> {
  // SQL approach: explode both csp_contacts arrays into one unified
  // set via UNION ALL, then GROUP BY lower(trim(email)) with a sample
  // of the 5 most common entity names via array_agg + DISTINCT.
  const rows = await query<ContactRow>(`
    WITH
    exploded AS (
      SELECT LOWER(TRIM(c->>'email')) AS email_norm,
             MAX(c->>'name') AS sample_name,
             MAX(c->>'email') AS sample_email,
             MAX(c->>'role') AS sample_role,
             e.id AS entity_id,
             e.legal_name AS entity_name,
             'entity' AS src
        FROM tax_entities e,
             jsonb_array_elements(COALESCE(e.csp_contacts, '[]'::jsonb)) c
       WHERE e.is_active = TRUE
         AND c->>'email' IS NOT NULL
         AND TRIM(c->>'email') <> ''
       GROUP BY e.id, e.legal_name, LOWER(TRIM(c->>'email'))
      UNION ALL
      SELECT LOWER(TRIM(c->>'email')) AS email_norm,
             MAX(c->>'name') AS sample_name,
             MAX(c->>'email') AS sample_email,
             MAX(c->>'role') AS sample_role,
             e.id AS entity_id,
             e.legal_name AS entity_name,
             'filing' AS src
        FROM tax_filings f
        JOIN tax_obligations o ON o.id = f.obligation_id
        JOIN tax_entities e    ON e.id = o.entity_id,
             jsonb_array_elements(COALESCE(f.csp_contacts, '[]'::jsonb)) c
       WHERE e.is_active = TRUE
         AND c->>'email' IS NOT NULL
         AND TRIM(c->>'email') <> ''
       GROUP BY e.id, e.legal_name, f.id, LOWER(TRIM(c->>'email'))
    )
    SELECT
      email_norm,
      (ARRAY_AGG(sample_name ORDER BY LENGTH(COALESCE(sample_name, ''))  DESC))[1] AS name,
      (ARRAY_AGG(sample_email ORDER BY LENGTH(COALESCE(sample_email, '')) DESC))[1] AS email,
      (ARRAY_AGG(sample_role ORDER BY LENGTH(COALESCE(sample_role, ''))  DESC))[1] AS role,
      COUNT(DISTINCT CASE WHEN src = 'entity' THEN entity_id END)::int AS entity_count,
      COUNT(*) FILTER (WHERE src = 'filing')::int AS filing_count,
      (ARRAY_AGG(DISTINCT entity_name))[1:5] AS sample_entities
    FROM exploded
    GROUP BY email_norm
    ORDER BY (COUNT(DISTINCT CASE WHEN src = 'entity' THEN entity_id END)
              + COUNT(*) FILTER (WHERE src = 'filing')) DESC,
             email_norm ASC
  `);

  return NextResponse.json({
    contacts: rows,
    total: rows.length,
  });
}
