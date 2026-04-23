import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';

// POST /api/crm/scheduled/engagement-recompute
//
// Daily cron (06:00 CET). For each non-deleted contact without a
// manual engagement_override, derive the engagement level from the
// most recent activity on any of their junction-linked matters and
// update it if different.
//
// Rules:
//   active   — last activity within 30 days
//   dormant  — last activity 30-180 days ago
//   lapsed   — last activity > 180 days ago OR no activity ever
//
// When engagement_override is set (user manually pinned a value),
// we leave the computed engagement_level in place but don't override
// their choice — the UI should prefer engagement_override anyway.
// We still recompute last_activity_at so the timestamp stays fresh.
export async function POST(_request: NextRequest) {
  const now = new Date();

  const rows = await query<{
    id: string;
    engagement_level: string | null;
    engagement_override: string | null;
    last_activity_ts: string | null;
  }>(
    `SELECT c.id, c.engagement_level, c.engagement_override,
            (SELECT MAX(a.activity_date)::text
               FROM crm_activity_contacts ac
               JOIN crm_activities a ON a.id = ac.activity_id
              WHERE ac.contact_id = c.id) AS last_activity_ts
       FROM crm_contacts c
      WHERE c.deleted_at IS NULL`,
  );

  let updated = 0;
  let skippedOverride = 0;
  let unchanged = 0;

  for (const r of rows) {
    const lastActivity = r.last_activity_ts ? new Date(r.last_activity_ts) : null;
    const daysSince = lastActivity
      ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let computed: 'active' | 'dormant' | 'lapsed';
    if (daysSince === null) computed = 'lapsed';
    else if (daysSince <= 30)  computed = 'active';
    else if (daysSince <= 180) computed = 'dormant';
    else                       computed = 'lapsed';

    // Write last_activity_at even if we don't change the level — so
    // detail pages always show the freshest "last seen" timestamp.
    const lastActivityIso = lastActivity ? lastActivity.toISOString() : null;

    if (r.engagement_override) {
      await execute(
        `UPDATE crm_contacts SET last_activity_at = $1, updated_at = NOW() WHERE id = $2`,
        [lastActivityIso, r.id],
      );
      skippedOverride += 1;
      continue;
    }

    if (r.engagement_level === computed) {
      await execute(
        `UPDATE crm_contacts SET last_activity_at = $1, updated_at = NOW() WHERE id = $2`,
        [lastActivityIso, r.id],
      );
      unchanged += 1;
      continue;
    }

    await execute(
      `UPDATE crm_contacts
          SET engagement_level = $1,
              last_activity_at = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [computed, lastActivityIso, r.id],
    );
    updated += 1;
  }

  return NextResponse.json({
    scanned: rows.length,
    updated,
    unchanged,
    skipped_override: skippedOverride,
    ran_at: now.toISOString(),
  });
}

// Allow GET for manual sanity checks.
export const GET = POST;
