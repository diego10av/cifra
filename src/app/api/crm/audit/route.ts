import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/crm/audit?target_type=crm_company&target_id=xxx
// Returns the change history of a single CRM record, most recent first.
// Powers the RecordHistory panel shown at the bottom of detail pages.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const targetType = url.searchParams.get('target_type');
  const targetId = url.searchParams.get('target_id');
  if (!targetType || !targetId) {
    return NextResponse.json({ error: 'target_type and target_id are required' }, { status: 400 });
  }
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50) || 50));

  const rows = await query(
    `SELECT id, user_id, action, field, old_value, new_value, reason, created_at
       FROM audit_log
      WHERE target_type = $1 AND target_id = $2
      ORDER BY created_at DESC
      LIMIT $3`,
    [targetType, targetId, limit],
  );
  return NextResponse.json(rows);
}
