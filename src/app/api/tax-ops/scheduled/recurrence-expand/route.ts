import { NextResponse } from 'next/server';
import { query, execute, generateId, logAudit } from '@/lib/db';

// ════════════════════════════════════════════════════════════════════════
// POST /api/tax-ops/scheduled/recurrence-expand
//
// Daily job (03:00 CET via scheduled-tasks MCP) that walks every task
// with a recurrence_rule whose status is 'done' (or 'cancelled' —
// debatable; we include 'done' only) and hasn't yet produced the next
// occurrence. Creates the next instance with the same core fields
// (title, priority, assignee, related_* links) but reset status/dates.
//
// Idempotent: we check for an existing child where
//   auto_generated = TRUE AND parent_template_id = <the done task's id>
// …wait — we don't have parent_template_id. Instead we tag the
// generated row with a tag `recurring_from:<original_id>` which is
// unique + queryable. A row is considered "already expanded" if any
// task exists with that tag.
//
// Supported recurrence_rule shapes:
//   { type: 'weekly',    params: { day_of_week: 1-7 } }
//   { type: 'monthly',   params: { day_of_month: 1-31 } }
//   { type: 'quarterly', params: { month_of_quarter: 1-3, day_of_month } }
//   { type: 'yearly',    params: { month: 1-12, day: 1-31 } }
//   { type: 'every_n_days', params: { n: N } }
// ════════════════════════════════════════════════════════════════════════

interface RecurringTask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  assignee: string | null;
  recurrence_rule: Record<string, unknown>;
  tags: string[];
  related_filing_id: string | null;
  related_entity_id: string | null;
  completed_at: string | null;
  due_date: string | null;
}

function nextOccurrence(rule: Record<string, unknown>, from: Date): Date | null {
  const type = rule.type as string;
  const params = (rule.params ?? {}) as Record<string, number>;
  const out = new Date(from);

  switch (type) {
    case 'weekly': {
      const dow = params.day_of_week ?? 1;
      const next = new Date(out);
      next.setDate(next.getDate() + 7);
      // Snap to requested dow (1 = Monday in ISO, 7 = Sunday)
      const iso = (next.getDay() || 7);
      const delta = ((dow - iso) + 7) % 7;
      next.setDate(next.getDate() + delta);
      return next;
    }
    case 'monthly': {
      const d = params.day_of_month ?? out.getDate();
      const next = new Date(out.getFullYear(), out.getMonth() + 1, 1);
      next.setDate(Math.min(d, daysInMonth(next.getFullYear(), next.getMonth())));
      return next;
    }
    case 'quarterly': {
      const d = params.day_of_month ?? 15;
      const next = new Date(out.getFullYear(), out.getMonth() + 3, 1);
      next.setDate(Math.min(d, daysInMonth(next.getFullYear(), next.getMonth())));
      return next;
    }
    case 'yearly': {
      const m = (params.month ?? 1) - 1;
      const d = params.day ?? 1;
      const next = new Date(out.getFullYear() + 1, m, Math.min(d, daysInMonth(out.getFullYear() + 1, m)));
      return next;
    }
    case 'every_n_days': {
      const n = params.n ?? 7;
      const next = new Date(out);
      next.setDate(next.getDate() + n);
      return next;
    }
    default:
      return null;
  }
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST() {
  // Candidates: tasks with a recurrence rule whose status is 'done' and
  // which haven't been expanded yet. We detect "already expanded" by
  // looking for a child task carrying the `recurring_from:<id>` tag.
  const tasks = await query<RecurringTask>(
    `SELECT id, title, description, priority, assignee,
            recurrence_rule, tags,
            related_filing_id, related_entity_id,
            completed_at::text, due_date::text
       FROM tax_ops_tasks
      WHERE recurrence_rule IS NOT NULL
        AND status = 'done'
        AND completed_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM tax_ops_tasks child
          WHERE ('recurring_from:' || tax_ops_tasks.id) = ANY(child.tags)
        )`,
  );

  let created = 0;
  const createdIds: string[] = [];
  for (const t of tasks) {
    const base = t.completed_at ? new Date(t.completed_at) : new Date();
    const next = nextOccurrence(t.recurrence_rule, base);
    if (!next) continue;
    const id = generateId();
    const newTags = [...t.tags, `recurring_from:${t.id}`];
    await execute(
      `INSERT INTO tax_ops_tasks
         (id, title, description, status, priority, due_date,
          recurrence_rule, tags, related_filing_id, related_entity_id,
          assignee, auto_generated, created_by)
       VALUES ($1,$2,$3,'queued',$4,$5,$6::jsonb,$7,$8,$9,$10,TRUE,'recurrence_expand')`,
      [
        id, t.title, t.description, t.priority, toIsoDate(next),
        JSON.stringify(t.recurrence_rule), newTags,
        t.related_filing_id, t.related_entity_id, t.assignee,
      ],
    );
    createdIds.push(id);
    created += 1;
  }

  await logAudit({
    userId: 'system',
    action: 'tax_task_recurrence_expand',
    targetType: 'tax_ops_tasks',
    targetId: `batch_${toIsoDate(new Date())}`,
    newValue: JSON.stringify({ processed: tasks.length, created, ids: createdIds }),
  });

  return NextResponse.json({
    processed: tasks.length,
    created,
    task_ids: createdIds,
  });
}
