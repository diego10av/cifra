import { NextRequest, NextResponse } from 'next/server';
import { query, execute, logAudit } from '@/lib/db';

// GET — list all rules (enabled + disabled), for the settings page.
export async function GET() {
  const rules = await query(
    `SELECT id, name, description, trigger_event, trigger_params,
            action_type, action_params, enabled,
            fire_count, last_fired_at::text AS last_fired_at,
            created_at::text AS created_at, updated_at::text AS updated_at
       FROM crm_automation_rules
      ORDER BY trigger_event, name`,
  );
  return NextResponse.json(rules);
}

// PUT — update a rule in-place (enable, disable, edit params).
// Body: { id, enabled?, action_params? }
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? '').trim();
  if (!id) return NextResponse.json({ error: { code: 'id_required', message: 'id is required' } }, { status: 400 });

  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (typeof body.enabled === 'boolean') {
    sets.push(`enabled = $${i}`);
    params.push(body.enabled);
    i += 1;
  }
  if (body.action_params && typeof body.action_params === 'object') {
    sets.push(`action_params = $${i}::jsonb`);
    params.push(JSON.stringify(body.action_params));
    i += 1;
  }
  if (sets.length === 0) return NextResponse.json({ id, changed: [] });

  sets.push('updated_at = NOW()');
  params.push(id);
  await execute(
    `UPDATE crm_automation_rules SET ${sets.join(', ')} WHERE id = $${i}`,
    params,
  );

  await logAudit({
    action: 'update',
    targetType: 'crm_automation_rule',
    targetId: id,
    field: body.enabled !== undefined ? 'enabled' : 'action_params',
    newValue: body.enabled !== undefined ? String(body.enabled) : JSON.stringify(body.action_params),
    reason: `Automation rule ${id} updated`,
  });
  return NextResponse.json({ id, updated: true });
}
