import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/crm/next-actions
//
// Aggregates the "what should I do today?" list from multiple sources.
// Each action carries a priority score (0-100) so the UI can rank and
// trim to the top N. Sources:
//
//   1. Overdue tasks (priority = 90-100 based on age + high-priority flag)
//   2. Invoices 30+ days overdue (85)
//   3. Invoices 7-30 days overdue (70)
//   4. Opportunities stuck in stage > 14 days (55-70)
//   5. Dormant Key Accounts (60)
//   6. Tasks due today (50-60)
//   7. Unfilled next-action on opportunities with date ≤ today (50)
//
// Never more than 20 actions returned. Deduplicated by (type, id).
export interface NextAction {
  id: string;
  type: 'task' | 'invoice_overdue' | 'opp_stuck' | 'opp_next_action' | 'dormant_key_account';
  priority: number;
  title: string;
  detail: string;
  link: string;
  target_type: string;
  target_id: string;
  meta?: Record<string, unknown>;
}

const MAX_ACTIONS = 20;

export async function GET(_request: NextRequest) {
  const actions: NextAction[] = [];

  // ─── 1. Overdue + high-priority tasks ─────────────────────────────
  const tasks = await query<{
    id: string; title: string; priority: string; due_date: string | null;
    related_type: string | null; related_id: string | null;
    days_overdue: number;
  }>(
    `SELECT id, title, priority, due_date::text AS due_date,
            related_type, related_id,
            COALESCE(CURRENT_DATE - due_date, 0)::int AS days_overdue
       FROM crm_tasks
      WHERE status = 'open'
        AND due_date IS NOT NULL
        AND due_date <= CURRENT_DATE + INTERVAL '1 day'
      ORDER BY due_date ASC
      LIMIT 30`,
  );
  for (const t of tasks) {
    const isHigh = t.priority === 'high';
    const overdue = (t.days_overdue ?? 0) > 0;
    const priority = overdue
      ? Math.min(100, 80 + (isHigh ? 15 : 5) + Math.min(10, t.days_overdue))
      : isHigh ? 65 : 50;
    actions.push({
      id: `task:${t.id}`, type: 'task', priority,
      title: t.title,
      detail: overdue ? `${t.days_overdue}d overdue · ${t.priority} priority` : `Due today · ${t.priority} priority`,
      link: `/crm/tasks`,
      target_type: 'crm_task', target_id: t.id,
      meta: { due_date: t.due_date, days_overdue: t.days_overdue },
    });
  }

  // ─── 2 & 3. Overdue invoices ──────────────────────────────────────
  const invs = await query<{
    id: string; invoice_number: string; due_date: string;
    outstanding: string; client_name: string | null; days_overdue: number;
  }>(
    `SELECT b.id, b.invoice_number, b.due_date::text AS due_date,
            b.outstanding::text, c.company_name AS client_name,
            (CURRENT_DATE - b.due_date)::int AS days_overdue
       FROM crm_billing_invoices b
       LEFT JOIN crm_companies c ON c.id = b.company_id
      WHERE b.status IN ('sent','partial_paid','overdue')
        AND b.outstanding > 0
        AND b.due_date IS NOT NULL
        AND b.due_date < CURRENT_DATE
      ORDER BY b.due_date ASC`,
  );
  for (const inv of invs) {
    const days = inv.days_overdue;
    const amt = Number(inv.outstanding).toFixed(2);
    const priority = days >= 30 ? 85 : days >= 7 ? 70 : 55;
    actions.push({
      id: `invoice:${inv.id}`, type: 'invoice_overdue', priority,
      title: `Chase ${inv.invoice_number} · €${amt}`,
      detail: `${inv.client_name ?? 'client'} · ${days}d past due`,
      link: `/crm/billing/${inv.id}`,
      target_type: 'crm_invoice', target_id: inv.id,
      meta: { days_overdue: days, outstanding: amt },
    });
  }

  // ─── 4. Opportunities stuck in stage ──────────────────────────────
  const stuckOpps = await query<{
    id: string; name: string; stage: string;
    client_name: string | null; days_in_stage: number;
    weighted_value_eur: string | null;
  }>(
    `SELECT o.id, o.name, o.stage,
            c.company_name AS client_name,
            (CURRENT_DATE - o.stage_entered_at::date)::int AS days_in_stage,
            o.weighted_value_eur::text
       FROM crm_opportunities o
       LEFT JOIN crm_companies c ON c.id = o.client_company_id
      WHERE o.deleted_at IS NULL
        AND o.stage NOT IN ('won', 'lost')
        AND o.stage_entered_at IS NOT NULL
        AND (CURRENT_DATE - o.stage_entered_at::date) > 14
      ORDER BY o.stage_entered_at ASC
      LIMIT 10`,
  );
  for (const o of stuckOpps) {
    const priority = o.days_in_stage > 30 ? 70 : 55;
    actions.push({
      id: `opp_stuck:${o.id}`, type: 'opp_stuck', priority,
      title: `Unstick ${o.name}`,
      detail: `${o.client_name ?? '—'} · ${o.stage} for ${o.days_in_stage}d${o.weighted_value_eur ? ` · weighted €${Number(o.weighted_value_eur).toFixed(0)}` : ''}`,
      link: `/crm/opportunities/${o.id}`,
      target_type: 'crm_opportunity', target_id: o.id,
      meta: { days_in_stage: o.days_in_stage, stage: o.stage },
    });
  }

  // ─── 5. Dormant Key-Account contacts ──────────────────────────────
  const dormantKA = await query<{
    id: string; full_name: string; job_title: string | null;
    last_activity_at: string | null; company_name: string | null;
    days_since: number;
  }>(
    `SELECT c.id, c.full_name, c.job_title,
            c.last_activity_at::text,
            (SELECT co.company_name
               FROM crm_contact_companies cc
               JOIN crm_companies co ON co.id = cc.company_id
              WHERE cc.contact_id = c.id AND co.classification = 'key_account'
              ORDER BY cc.is_primary DESC
              LIMIT 1) AS company_name,
            COALESCE(
              (CURRENT_DATE - c.last_activity_at::date)::int,
              9999
            ) AS days_since
       FROM crm_contacts c
      WHERE c.deleted_at IS NULL
        AND c.engagement_level = 'dormant'
        AND EXISTS (
          SELECT 1 FROM crm_contact_companies cc
          JOIN crm_companies co ON co.id = cc.company_id
          WHERE cc.contact_id = c.id AND co.classification = 'key_account' AND co.deleted_at IS NULL
        )
      ORDER BY c.last_activity_at ASC NULLS FIRST
      LIMIT 5`,
  );
  for (const d of dormantKA) {
    actions.push({
      id: `dormant:${d.id}`, type: 'dormant_key_account', priority: 60,
      title: `Reach out to ${d.full_name}`,
      detail: `${d.job_title ? `${d.job_title} · ` : ''}${d.company_name ?? 'Key Account'} · dormant ${d.days_since}d`,
      link: `/crm/contacts/${d.id}`,
      target_type: 'crm_contact', target_id: d.id,
      meta: { days_since: d.days_since },
    });
  }

  // ─── 6. Opportunity next-action dates ─────────────────────────────
  const oppActions = await query<{
    id: string; name: string; next_action: string;
    next_action_due: string; client_name: string | null;
  }>(
    `SELECT o.id, o.name, o.next_action, o.next_action_due::text AS next_action_due,
            c.company_name AS client_name
       FROM crm_opportunities o
       LEFT JOIN crm_companies c ON c.id = o.client_company_id
      WHERE o.deleted_at IS NULL
        AND o.stage NOT IN ('won', 'lost')
        AND o.next_action IS NOT NULL
        AND o.next_action_due IS NOT NULL
        AND o.next_action_due <= CURRENT_DATE + INTERVAL '1 day'
      LIMIT 10`,
  );
  for (const a of oppActions) {
    actions.push({
      id: `opp_next:${a.id}`, type: 'opp_next_action', priority: 50,
      title: a.next_action,
      detail: `${a.name} · ${a.client_name ?? '—'}`,
      link: `/crm/opportunities/${a.id}`,
      target_type: 'crm_opportunity', target_id: a.id,
    });
  }

  // Dedupe + sort by priority desc, cap at MAX_ACTIONS.
  const seen = new Set<string>();
  const deduped = actions.filter(a => {
    const k = `${a.target_type}:${a.target_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  deduped.sort((a, b) => b.priority - a.priority);
  return NextResponse.json({
    actions: deduped.slice(0, MAX_ACTIONS),
    total_candidates: actions.length,
  });
}
