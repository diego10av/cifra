import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/crm/contacts — list with optional q / lifecycle / engagement filters.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const lifecycle = url.searchParams.get('lifecycle');
  const engagement = url.searchParams.get('engagement');
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 200) || 200));

  const conditions: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
  }
  if (lifecycle) {
    params.push(lifecycle);
    conditions.push(`lifecycle_stage = $${params.length}`);
  }
  if (engagement) {
    params.push(engagement);
    conditions.push(`COALESCE(engagement_override, engagement_level) = $${params.length}`);
  }
  params.push(limit);

  const rows = await query(
    `SELECT id, full_name, email, phone, linkedin_url, job_title, country,
            lifecycle_stage, role_tags, engagement_level, engagement_override,
            source, lead_score, next_follow_up, last_activity_at,
            created_at, updated_at
       FROM crm_contacts
      WHERE ${conditions.join(' AND ')}
      ORDER BY
        CASE COALESCE(engagement_override, engagement_level)
          WHEN 'active'  THEN 0
          WHEN 'dormant' THEN 1
          WHEN 'lapsed'  THEN 2
          ELSE 3
        END,
        full_name ASC
      LIMIT $${params.length}`,
    params,
  );
  return NextResponse.json(rows);
}
