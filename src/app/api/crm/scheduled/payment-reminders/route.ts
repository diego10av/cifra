import { NextRequest, NextResponse } from 'next/server';
import { query, execute, generateId, logAudit } from '@/lib/db';

// POST /api/crm/scheduled/payment-reminders
//
// Daily cron: scan open invoices and create follow-up tasks on
// three cadence buckets:
//   - 3 days before due date → "friendly reminder" task
//   - 7 days past due        → "overdue notice" task
//   - 30 days past due       → "escalated — consider collections"
//
// Idempotency: each invoice stores last_reminder_kind +
// last_reminder_sent_at. We skip invoices where the most recent
// reminder matches the bucket we'd otherwise issue, OR where it was
// triggered within the last 20 hours (guards against double-firing
// if the cron is run twice). Escalation (30d+) always wins, even
// if a 7d-overdue nudge was already sent.
//
// Only creates tasks; does NOT send emails directly. The task
// becomes a row in crm_tasks that surfaces on the Today view + NBA
// widget (Fase 5.2).
export async function POST(_request: NextRequest) {
  const now = new Date();

  // Candidate invoices: issued + outstanding > 0 + not credit notes.
  const candidates = await query<{
    id: string; invoice_number: string; status: string;
    due_date: string; outstanding: string;
    company_id: string | null; matter_id: string | null;
    last_reminder_sent_at: string | null; last_reminder_kind: string | null;
    client_name: string | null;
  }>(
    `SELECT b.id, b.invoice_number, b.status,
            b.due_date::text AS due_date, b.outstanding::text,
            b.company_id, b.matter_id,
            b.last_reminder_sent_at::text AS last_reminder_sent_at,
            b.last_reminder_kind,
            c.company_name AS client_name
       FROM crm_billing_invoices b
       LEFT JOIN crm_companies c ON c.id = b.company_id
      WHERE b.status IN ('sent','partial_paid','overdue')
        AND b.outstanding > 0
        AND b.due_date IS NOT NULL`,
  );

  const created: Array<{ invoice_id: string; invoice_number: string; kind: string; task_id: string }> = [];

  for (const inv of candidates) {
    const due = new Date(inv.due_date);
    const daysDelta = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    //  daysDelta = 3 means due in 3 days; -7 means 7 days past due.

    let kind: 'friendly' | 'overdue' | 'escalated' | null = null;
    if (daysDelta >= -90 && daysDelta <= 3) {
      if (daysDelta <= -30) kind = 'escalated';
      else if (daysDelta <= -7) kind = 'overdue';
      else if (daysDelta >= 0 && daysDelta <= 3) kind = 'friendly';
      else if (daysDelta < 0 && daysDelta > -7) continue;   // in the "grace" window
    } else continue;

    if (!kind) continue;

    // Idempotency: skip if this exact kind was already logged within the
    // last 20 hours (prevents duplicate tasks on cron retries / double-runs).
    if (inv.last_reminder_kind === kind && inv.last_reminder_sent_at) {
      const ageHrs = (now.getTime() - new Date(inv.last_reminder_sent_at).getTime()) / (1000 * 60 * 60);
      if (ageHrs < 20) continue;
    }

    const taskId = generateId();
    const { title, detail } = reminderTemplate(kind, inv);

    await execute(
      `INSERT INTO crm_tasks
         (id, title, description, related_type, related_id, status,
          priority, due_date, auto_generated, created_at, updated_at)
       VALUES ($1,$2,$3,'crm_invoice',$4,'open',$5,$6,TRUE,NOW(),NOW())`,
      [
        taskId, title, detail,
        inv.id,
        kind === 'escalated' ? 'high' : kind === 'overdue' ? 'medium' : 'low',
        new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      ],
    );

    await execute(
      `UPDATE crm_billing_invoices
          SET last_reminder_sent_at = NOW(),
              last_reminder_kind    = $1,
              status                = CASE WHEN $1 IN ('overdue','escalated') AND status = 'sent' THEN 'overdue' ELSE status END,
              updated_at            = NOW()
        WHERE id = $2`,
      [kind, inv.id],
    );

    await logAudit({
      action: 'reminder_created',
      targetType: 'crm_invoice',
      targetId: inv.id,
      field: 'reminder',
      newValue: kind,
      reason: `Auto-created ${kind} reminder task for invoice ${inv.invoice_number}`,
    });

    created.push({ invoice_id: inv.id, invoice_number: inv.invoice_number, kind, task_id: taskId });
  }

  return NextResponse.json({
    checked: candidates.length,
    created: created.length,
    details: created,
    ran_at: now.toISOString(),
  });
}

// Allow GET too for manual testing / sanity checks.
export const GET = POST;

function reminderTemplate(
  kind: 'friendly' | 'overdue' | 'escalated',
  inv: { invoice_number: string; due_date: string; outstanding: string; client_name: string | null },
): { title: string; detail: string } {
  const client = inv.client_name ?? 'client';
  const amt = Number(inv.outstanding).toFixed(2);

  if (kind === 'friendly') {
    return {
      title: `Friendly reminder — invoice ${inv.invoice_number} due ${inv.due_date}`,
      detail: `Send a courtesy nudge to ${client}: "Hi, just a friendly heads-up that invoice ${inv.invoice_number} (€${amt}) is due on ${inv.due_date}. Please let us know if you anticipate any issues with timely payment. Thanks!"`,
    };
  }
  if (kind === 'overdue') {
    return {
      title: `Overdue: ${inv.invoice_number} — €${amt} past due`,
      detail: `Invoice ${inv.invoice_number} was due ${inv.due_date} and remains unpaid. Send overdue notice to ${client}. Suggested copy: "Our records show that invoice ${inv.invoice_number} (€${amt}) is now overdue. Please remit payment at your earliest convenience or contact us to arrange alternative terms."`,
    };
  }
  return {
    title: `ESCALATED: ${inv.invoice_number} — €${amt} 30+ days past due`,
    detail: `Invoice ${inv.invoice_number} is now more than 30 days past due. Consider: (a) phone call to the billing contact at ${client}; (b) formal demand letter; (c) escalate to collections if the client is unresponsive. This amount also affects our aging buckets on the billing dashboard.`,
  };
}
