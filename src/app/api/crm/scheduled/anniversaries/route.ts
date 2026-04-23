import { NextRequest, NextResponse } from 'next/server';
import { query, execute, generateId, logAudit } from '@/lib/db';

// POST /api/crm/scheduled/anniversaries
//
// Weekly cron (Monday 08:00 CET). Looks for birthdays + client
// anniversaries falling in the next 7 days and creates a low-
// priority task per match so Diego can send a card / personal
// message. Idempotent: we only create a task if no auto-generated
// "anniversary" task for this contact has been created in the last
// 300 days (so yearly events fire once per year).
//
// Birthdays and anniversaries store year-month-day but we only match
// on MMDD — the year is a placeholder for whenever the contact
// shared the date.
export async function POST(_request: NextRequest) {
  const now = new Date();

  // Postgres-side: find contacts whose birthday (mm-dd) OR
  // client_anniversary (mm-dd) falls within the next 7 days.
  const rows = await query<{
    id: string;
    full_name: string;
    kind: 'birthday' | 'anniversary';
    upcoming_date: string;
    days_ahead: number;
  }>(
    `WITH dates AS (
       SELECT c.id, c.full_name, 'birthday' AS kind,
              (DATE_TRUNC('year', CURRENT_DATE) + (EXTRACT(DOY FROM c.birthday) - 1 || ' days')::interval)::date AS upcoming_date,
              c.birthday AS src
         FROM crm_contacts c
        WHERE c.deleted_at IS NULL AND c.birthday IS NOT NULL
       UNION ALL
       SELECT c.id, c.full_name, 'anniversary' AS kind,
              (DATE_TRUNC('year', CURRENT_DATE) + (EXTRACT(DOY FROM c.client_anniversary) - 1 || ' days')::interval)::date AS upcoming_date,
              c.client_anniversary AS src
         FROM crm_contacts c
        WHERE c.deleted_at IS NULL AND c.client_anniversary IS NOT NULL
     )
     SELECT id, full_name, kind,
            upcoming_date::text AS upcoming_date,
            (upcoming_date - CURRENT_DATE)::int AS days_ahead
       FROM dates
      WHERE upcoming_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`,
  );

  const created: Array<{ contact_id: string; kind: string; task_id: string }> = [];

  for (const r of rows) {
    // Skip if we already created an anniversary/birthday task for this
    // contact within the last 300 days (prevents re-firing in the
    // same year if the cron is run twice).
    const prev = await query<{ id: string }>(
      `SELECT id FROM crm_tasks
        WHERE related_type = 'crm_contact' AND related_id = $1
          AND auto_generated = TRUE
          AND title LIKE $2
          AND created_at > NOW() - INTERVAL '300 days'`,
      [r.id, `%${r.kind}%`],
    );
    if (prev.length > 0) continue;

    const taskId = generateId();
    const title = r.kind === 'birthday'
      ? `Wish ${r.full_name} a happy birthday (${r.upcoming_date})`
      : `Anniversary: thank ${r.full_name} for the relationship (${r.upcoming_date})`;
    const detail = r.kind === 'birthday'
      ? `${r.full_name}'s birthday is in ${r.days_ahead} days. Send a card or short personal note — a one-line "hope you have a great day!" is often enough to keep a relationship warm.`
      : `${r.full_name}'s client anniversary is in ${r.days_ahead} days. Acknowledge the relationship — "it's been another year since we started working together, grateful to keep serving you".`;

    await execute(
      `INSERT INTO crm_tasks
         (id, title, description, related_type, related_id, status,
          priority, due_date, auto_generated, created_at, updated_at)
       VALUES ($1,$2,$3,'crm_contact',$4,'open','low',$5,TRUE,NOW(),NOW())`,
      [
        taskId, title, detail, r.id,
        // Due date = the day before the anniversary so Diego has time to act.
        new Date(new Date(r.upcoming_date).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      ],
    );
    await logAudit({
      action: 'anniversary_reminder',
      targetType: 'crm_contact',
      targetId: r.id,
      field: r.kind,
      newValue: r.upcoming_date,
      reason: `Auto-created ${r.kind} reminder for ${r.full_name}`,
    });
    created.push({ contact_id: r.id, kind: r.kind, task_id: taskId });
  }

  return NextResponse.json({
    scanned: rows.length,
    created: created.length,
    details: created,
    ran_at: now.toISOString(),
  });
}

export const GET = POST;
