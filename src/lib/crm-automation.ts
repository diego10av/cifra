// ════════════════════════════════════════════════════════════════════════
// crm-automation.ts
//
// Tiny rules engine for CRM side-effects. Consumed by mutation
// handlers (opp stage change, invoice status change). Each call:
//
//   1. Loads enabled rules matching the trigger_event
//   2. Filters by trigger_params (simple {key: value} equality)
//   3. Executes the rule's action (today: create_task only)
//   4. Bumps fire_count + last_fired_at on the rule row
//
// Fails open — an automation error never blocks the user's mutation.
// Errors are logged to audit_log so we can spot misconfiguration.
// ════════════════════════════════════════════════════════════════════════

import { query, execute, generateId, logAudit } from '@/lib/db';

export type AutomationTrigger =
  | 'opportunity_stage_changed'
  | 'invoice_status_changed'
  | 'task_completed'
  | 'matter_created';

interface Rule {
  id: string;
  name: string;
  trigger_event: string;
  trigger_params: Record<string, unknown>;
  action_type: string;
  action_params: Record<string, unknown>;
}

export interface TriggerContext {
  // Arbitrary key-value context used to filter rules + render task
  // templates. The keys referenced in `trigger_params` are matched
  // against entries here.
  [k: string]: unknown;
}

/**
 * Load + run every enabled rule for the given trigger. Context carries
 * both the filter keys (e.g. to_stage) and the template variables
 * (e.g. opp_name, invoice_number) used when rendering the rule's
 * action title.
 */
export async function runAutomations(trigger: AutomationTrigger, ctx: TriggerContext): Promise<void> {
  let rules: Rule[] = [];
  try {
    rules = await query<Rule>(
      `SELECT id, name, trigger_event, trigger_params, action_type, action_params
         FROM crm_automation_rules
        WHERE trigger_event = $1 AND enabled = TRUE`,
      [trigger],
    );
  } catch (e) {
    // If the automation table doesn't exist yet (pre-migration 042) or
    // the DB is temporarily down, silently skip — the user's primary
    // mutation already succeeded.
    void e;
    return;
  }

  for (const rule of rules) {
    if (!matchesParams(rule.trigger_params, ctx)) continue;
    try {
      await executeAction(rule, ctx);
      await execute(
        `UPDATE crm_automation_rules
            SET last_fired_at = NOW(), fire_count = fire_count + 1, updated_at = NOW()
          WHERE id = $1`,
        [rule.id],
      );
    } catch (e) {
      await logAudit({
        action: 'automation_error',
        targetType: 'crm_automation_rule',
        targetId: rule.id,
        field: trigger,
        newValue: e instanceof Error ? e.message.slice(0, 200) : 'unknown',
        reason: `Automation rule "${rule.name}" failed to fire`,
      }).catch(() => {});
    }
  }
}

function matchesParams(expected: Record<string, unknown>, ctx: TriggerContext): boolean {
  for (const [k, v] of Object.entries(expected)) {
    if (ctx[k] !== v) return false;
  }
  return true;
}

async function executeAction(rule: Rule, ctx: TriggerContext): Promise<void> {
  if (rule.action_type === 'create_task') {
    const params = rule.action_params as {
      task_title_template?: string;
      due_in_days?: number;
      priority?: string;
      related_type?: string;
    };
    const title = renderTemplate(params.task_title_template ?? `Follow up (${rule.name})`, ctx);
    const dueInDays = typeof params.due_in_days === 'number' ? params.due_in_days : 1;
    const priority = params.priority === 'high' || params.priority === 'low' || params.priority === 'medium'
      ? params.priority : 'medium';
    const due = new Date(Date.now() + dueInDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const relatedType = String(ctx.target_type ?? '');
    const relatedId = String(ctx.target_id ?? '');

    const taskId = generateId();
    await execute(
      `INSERT INTO crm_tasks
         (id, title, description, related_type, related_id, status,
          priority, due_date, auto_generated, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'open',$6,$7,TRUE,NOW(),NOW())`,
      [
        taskId, title,
        `Auto-created by rule: ${rule.name}`,
        relatedType || null,
        relatedId || null,
        priority, due,
      ],
    );

    await logAudit({
      action: 'automation_fired',
      targetType: 'crm_automation_rule',
      targetId: rule.id,
      field: 'create_task',
      newValue: taskId,
      reason: `Rule "${rule.name}" created task: ${title}`,
    });
    return;
  }

  // Future action types (change_field, send_reminder) land here.
}

function renderTemplate(template: string, ctx: TriggerContext): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const v = ctx[key];
    return v === undefined || v === null ? match : String(v);
  });
}
