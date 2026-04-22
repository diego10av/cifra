import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/crm/companies — list, most-recent first. Query params:
//   ?q=text          search in company_name (case-insensitive)
//   ?classification=key_account|standard|...  (optional filter)
//   ?country=LU       (optional filter)
//   ?limit=200        (default 200, max 500)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const classification = url.searchParams.get('classification');
  const country = url.searchParams.get('country');
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 200) || 200));

  const conditions: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`company_name ILIKE $${params.length}`);
  }
  if (classification) {
    params.push(classification);
    conditions.push(`classification = $${params.length}`);
  }
  if (country) {
    params.push(country);
    conditions.push(`country = $${params.length}`);
  }
  params.push(limit);

  const rows = await query(
    `SELECT id, company_name, country, industry, size, classification,
            website, linkedin_url, tags, entity_id, notes,
            created_at, updated_at
       FROM crm_companies
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE classification
          WHEN 'key_account'    THEN 0
          WHEN 'standard'       THEN 1
          WHEN 'occasional'     THEN 2
          WHEN 'not_yet_client' THEN 3
          ELSE 4
        END,
        company_name ASC
      LIMIT $${params.length}`,
    params,
  );
  return NextResponse.json(rows);
}
