// ════════════════════════════════════════════════════════════════════════
// GET /api/declarations/[id]/audit-log
//
// Returns the audit trail for a declaration — every change that's been
// logged (treatment overrides, date edits, status transitions, approvals,
// etc.) — enriched with the context the UI needs to render a proper
// timeline: the line description, the provider, the AI's original
// suggestion (from invoice_lines.ai_suggested_treatment), and the reason
// captured at the time (if any).
//
// The big compliance story this endpoint powers:
//
//     "cifra said EXEMPT_44 (RULE 2) → on 14:23 you changed it to
//      LUX_17 because 'supplier invoiced at 17% originally'."
//
// Every one of those rows is defensible evidence that a human made
// the final call.
//
// Query:
//   - filter=overrides  → only rows where an AI suggestion was overridden
//                         (i.e. the current treatment on the line differs
//                         from ai_suggested_treatment)
//   - filter=treatments → only treatment changes, regardless of AI overlap
//   - filter=all        → every audit row (default)
//
// Response: flat array of events, newest first. Fields are the same
// across filter modes so the UI doesn't branch.
// ════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiOk, apiFail } from '@/lib/api-errors';

type Filter = 'all' | 'treatments' | 'overrides';

interface AuditEvent {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;

  // Denormalised for the UI (saves a round-trip per row).
  line_description: string | null;
  line_provider: string | null;
  ai_suggested_treatment: string | null;
  ai_suggested_rule: string | null;

  // Derived: true iff this event represents the user changing
  // `treatment` to a value that differs from the AI's original
  // suggestion. The UI renders these with an "AI override" badge.
  is_ai_override: boolean;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: declarationId } = await params;
    const filterParam = request.nextUrl.searchParams.get('filter');
    const filter: Filter =
      filterParam === 'treatments' ? 'treatments' :
      filterParam === 'overrides'  ? 'overrides' : 'all';

    // One SQL query for all three filter modes — the WHERE clause
    // changes, the SELECT is the same. Rows are enriched with
    // invoice_lines + invoices so the UI doesn't need N+1 lookups.
    const rows = await query<{
      id: string;
      created_at: string;
      user_id: string | null;
      action: string;
      target_type: string;
      target_id: string;
      field: string | null;
      old_value: string | null;
      new_value: string | null;
      reason: string | null;
      line_description: string | null;
      line_provider: string | null;
      ai_suggested_treatment: string | null;
      ai_suggested_rule: string | null;
      current_treatment: string | null;
    }>(
      `SELECT a.id, a.created_at::text AS created_at,
              a.user_id, a.action, a.target_type, a.target_id,
              a.field, a.old_value, a.new_value, a.reason,
              il.description AS line_description,
              i.provider AS line_provider,
              il.ai_suggested_treatment,
              il.ai_suggested_rule,
              il.treatment AS current_treatment
         FROM audit_log a
         LEFT JOIN invoice_lines il
           ON a.target_type = 'invoice_line' AND a.target_id = il.id
         LEFT JOIN invoices i
           ON a.target_type = 'invoice'      AND a.target_id = i.id
         WHERE a.declaration_id = $1
           ${filter === 'treatments'
             ? `AND a.target_type = 'invoice_line' AND a.field = 'treatment'`
             : filter === 'overrides'
             ? `AND a.target_type = 'invoice_line' AND a.field = 'treatment'
                AND il.ai_suggested_treatment IS NOT NULL
                AND il.ai_suggested_treatment <> il.treatment`
             : ''}
         ORDER BY a.created_at DESC
         LIMIT 500`,
      [declarationId],
    );

    const events: AuditEvent[] = rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      user_id: r.user_id,
      action: r.action,
      target_type: r.target_type,
      target_id: r.target_id,
      field: r.field,
      old_value: r.old_value,
      new_value: r.new_value,
      reason: r.reason,
      line_description: r.line_description,
      line_provider: r.line_provider,
      ai_suggested_treatment: r.ai_suggested_treatment,
      ai_suggested_rule: r.ai_suggested_rule,
      // is_ai_override fires when:
      //   - this is a treatment change on an invoice_line
      //   - AI had suggested something originally (ai_suggested_treatment != null)
      //   - the new value differs from the AI suggestion
      is_ai_override:
        r.target_type === 'invoice_line' &&
        r.field === 'treatment' &&
        r.ai_suggested_treatment != null &&
        r.new_value !== r.ai_suggested_treatment,
    }));

    // Summary counts so the UI can show "3 AI overrides · 12 edits" at a glance.
    const summary = {
      total: events.length,
      ai_overrides: events.filter(e => e.is_ai_override).length,
      treatment_changes: events.filter(e => e.target_type === 'invoice_line' && e.field === 'treatment').length,
      other: events.filter(e => !(e.target_type === 'invoice_line' && e.field === 'treatment')).length,
    };

    return apiOk({ events, summary });
  } catch (err) {
    return apiFail(err, 'declaration/audit-log');
  }
}
