import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, generateId, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const activityType = url.searchParams.get('type');
  const q = url.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') ?? 200) || 200));

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (q) {
    params.push(`%${q}%`);
    conditions.push(`(a.name ILIKE $${params.length} OR a.notes ILIKE $${params.length})`);
  }
  if (activityType) {
    params.push(activityType);
    conditions.push(`a.activity_type = $${params.length}`);
  }
  params.push(limit);

  const rows = await query(
    `SELECT a.id, a.name, a.activity_type, a.activity_date, a.duration_hours, a.billable,
            a.outcome,
            c.company_name AS company_name,
            o.name AS opportunity_name,
            m.matter_reference AS matter_reference,
            ct.full_name AS contact_name
       FROM crm_activities a
       LEFT JOIN crm_companies c     ON c.id = a.company_id
       LEFT JOIN crm_opportunities o ON o.id = a.opportunity_id
       LEFT JOIN crm_matters m       ON m.id = a.matter_id
       LEFT JOIN crm_contacts ct     ON ct.id = a.primary_contact_id
      ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      ORDER BY a.activity_date DESC
      LIMIT $${params.length}`,
    params,
  );
  return NextResponse.json(rows);
}

// POST /api/crm/activities — log a new activity (call/meeting/email/...).
// Required: name, activity_type, activity_date.
// Optional relations: primary_contact_id, company_id, opportunity_id,
// matter_id, additional_contact_ids[] (for multi-contact meetings).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return apiError('name_required', 'name is required.', { status: 400 });
  const activityType = typeof body.activity_type === 'string' ? body.activity_type : '';
  if (!activityType) return apiError('activity_type_required', 'activity_type is required.', { status: 400 });
  const activityDate = body.activity_date;
  if (!activityDate) return apiError('date_required', 'activity_date is required.', { status: 400 });

  const id = generateId();
  await execute(
    `INSERT INTO crm_activities
       (id, name, activity_type, activity_date, duration_hours, billable,
        lawyer, primary_contact_id, company_id, opportunity_id, matter_id,
        outcome, notes, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())`,
    [
      id, name, activityType, activityDate,
      body.duration_hours ?? null,
      !!body.billable,
      body.lawyer ?? null,
      body.primary_contact_id ?? null,
      body.company_id ?? null,
      body.opportunity_id ?? null,
      body.matter_id ?? null,
      body.outcome ?? null,
      body.notes ?? null,
    ],
  );

  // Additional contacts via junction.
  if (Array.isArray(body.additional_contact_ids)) {
    for (const cid of body.additional_contact_ids) {
      if (typeof cid !== 'string') continue;
      await execute(
        `INSERT INTO crm_activity_contacts (activity_id, contact_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, cid],
      );
    }
  }

  // Update contact's last_activity_at (used for auto-engagement in fase 5).
  if (body.primary_contact_id) {
    await execute(
      `UPDATE crm_contacts SET last_activity_at = GREATEST(COALESCE(last_activity_at, $1), $1) WHERE id = $2`,
      [activityDate, body.primary_contact_id],
    );
  }

  await logAudit({
    action: 'create',
    targetType: 'crm_activity',
    targetId: id,
    newValue: name,
    reason: `New ${activityType}`,
  });

  // Auto-create a time entry when the activity represents billable
  // work on a matter. Opt-in via body.also_log_time (the form shows a
  // checkbox). Requires: matter_id + duration_hours > 0 +
  // billable = true. Reuses matter.hourly_rate_eur as the rate. The
  // created time_entry id is returned so the UI can link to it.
  let timeEntryId: string | null = null;
  const hours = Number(body.duration_hours ?? 0);
  if (
    body.also_log_time === true &&
    body.matter_id &&
    !!body.billable &&
    Number.isFinite(hours) && hours > 0 &&
    (activityType === 'meeting' || activityType === 'call')
  ) {
    const matter = await queryOne<{ hourly_rate_eur: string | null }>(
      `SELECT hourly_rate_eur::text FROM crm_matters WHERE id = $1`,
      [body.matter_id],
    );
    const rate = matter?.hourly_rate_eur ? Number(matter.hourly_rate_eur) : null;
    timeEntryId = generateId();
    await execute(
      `INSERT INTO crm_time_entries
         (id, matter_id, activity_id, user_id, entry_date, hours, rate_eur,
          billable, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8)`,
      [
        timeEntryId, body.matter_id, id,
        body.lawyer ?? 'founder',
        activityDate,
        hours, rate,
        `Auto-from ${activityType}: ${name}`,
      ],
    );
    await logAudit({
      action: 'time_logged_from_activity',
      targetType: 'crm_matter',
      targetId: body.matter_id,
      field: 'time_entry',
      newValue: `${hours}h`,
      reason: `Auto time-entry from activity ${id}: ${hours}h`,
    });
  }

  return NextResponse.json({
    id, name, activity_type: activityType,
    time_entry_id: timeEntryId,
  }, { status: 201 });
}
