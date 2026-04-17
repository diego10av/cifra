import { NextRequest, NextResponse } from 'next/server';
import { query, execute, logAudit, logAuditTx, tx, execTx, qTx } from '@/lib/db';
import { apiError, apiFail } from '@/lib/api-errors';
import { TREATMENT_CODES } from '@/config/treatment-codes';
import { validateInvoiceDate, validateVatRate } from '@/lib/validation';

// POST /api/invoice-lines/bulk
// Two request shapes are supported:
//
// 1. Legacy action shape (kept for existing callers):
//    { ids: string[], action: 'set_treatment' | 'acknowledge_flag' |
//      'mark_reviewed' | 'move_to_excluded', value?: string }
//
// 2. Multi-field update shape (customer feedback 2026-04-18 — "let me
//    change treatment + date + note on 5 lines in one shot"):
//    { ids: string[], action: 'update',
//      patch: { treatment?, invoice_date?, description?, note?,
//               reviewed?, flag_acknowledged? },
//      reason?: string }
//
//    Per-LINE audit entries are written (not one bulk placeholder row),
//    so the AuditTrailPanel correctly renders each AI override as its
//    own event. The `reason` is attached to every treatment-change
//    audit row, mirroring the single-line PATCH endpoint.
//
// Guards: only operates on active lines that are not locked
// (declaration not approved+).

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ids = (body.ids as string[]) || [];
    const action = body.action as string;
    const value = body.value as string | undefined;

    if (!Array.isArray(ids) || ids.length === 0) {
      return apiError('no_ids', 'At least one line id is required.', { status: 400 });
    }
    if (ids.length > 500) {
      return apiError('too_many', 'Bulk operations are capped at 500 lines per request.', { status: 400 });
    }

    // Fetch lines + parent declaration status for lock check + entity for audit
    const rows = await query<{
      id: string; declaration_id: string; entity_id: string; decl_status: string;
    }>(
      `SELECT il.id, il.declaration_id, d2.entity_id, d2.status AS decl_status
         FROM invoice_lines il
         JOIN invoices i ON il.invoice_id = i.id
         JOIN declarations d2 ON il.declaration_id = d2.id
        WHERE il.id = ANY($1::text[])`,
      [ids]
    );
    if (rows.length === 0) return apiError('no_lines', 'No matching lines found.', { status: 404 });

    const locked = rows.filter(r => ['approved', 'filed', 'paid'].includes(r.decl_status));
    if (locked.length > 0) {
      return apiError('declaration_locked', `${locked.length} line(s) belong to approved/filed/paid declarations and can't be modified.`,
        { hint: 'Reopen the declaration first.', status: 409 });
    }

    const declId = rows[0].declaration_id;
    const entityId = rows[0].entity_id;
    let changed = 0;

    switch (action) {
      case 'update': {
        // Multi-field patch with per-line audit entries.
        const patch = (body.patch ?? {}) as Record<string, unknown>;
        const reason = typeof body.reason === 'string' && body.reason.trim()
          ? body.reason.trim().slice(0, 500)
          : undefined;

        // Whitelist: what's actually safe to bulk-edit. Everything else
        // is rejected explicitly (prevents the "oops, I just set
        // amount_eur=0 on 30 lines" incident).
        const LINE_FIELDS = ['treatment', 'description', 'note', 'vat_rate', 'reviewed', 'flag_acknowledged'] as const;
        const INVOICE_FIELDS = ['invoice_date'] as const;

        const linePatch: Record<string, unknown> = {};
        const invoicePatch: Record<string, unknown> = {};

        for (const key of Object.keys(patch)) {
          if ((LINE_FIELDS as readonly string[]).includes(key)) linePatch[key] = patch[key];
          else if ((INVOICE_FIELDS as readonly string[]).includes(key)) invoicePatch[key] = patch[key];
          else return apiError('field_not_bulkable',
            `Field "${key}" cannot be edited in bulk. Allowed: ${[...LINE_FIELDS, ...INVOICE_FIELDS].join(', ')}.`,
            { status: 400 });
        }
        if (Object.keys(linePatch).length === 0 && Object.keys(invoicePatch).length === 0) {
          return apiError('empty_patch', 'Patch must include at least one field.', { status: 400 });
        }

        // Field-level validation (same rules as the single-line PATCH).
        if ('treatment' in linePatch) {
          const t = linePatch.treatment;
          if (typeof t !== 'string' || !(t in TREATMENT_CODES)) {
            return apiError('treatment_unknown',
              `Unknown treatment code "${String(t)}".`,
              { hint: 'Pick a code from the treatment list.', status: 400 });
          }
          // Force the source to 'manual' on every bulk-set — it's a
          // deliberate user action even on many lines.
          linePatch.treatment_source = 'manual';
        }
        if ('vat_rate' in linePatch && linePatch.vat_rate != null) {
          const v = validateVatRate(Number(linePatch.vat_rate));
          if (!v.ok) return apiError(v.error.code, v.error.message, { hint: v.error.hint, status: 400 });
        }
        if ('invoice_date' in invoicePatch && invoicePatch.invoice_date) {
          const v = validateInvoiceDate(String(invoicePatch.invoice_date));
          if (!v.ok) return apiError(v.error.code, v.error.message, { hint: v.error.hint, status: 400 });
        }

        // Per-line processing in a single transaction: read old values,
        // write new, audit every actual change.
        await tx(async (txSql) => {
          // Fetch current values for each line (so audit rows have
          // correct old_value). Join invoices for the invoice-level
          // fields we may be updating.
          const currents = await qTx<Record<string, unknown> & { id: string; invoice_id: string }>(
            txSql,
            `SELECT il.id, il.invoice_id,
                    il.treatment, il.description, il.note, il.vat_rate,
                    il.reviewed, il.flag_acknowledged,
                    i.invoice_date::text AS invoice_date
               FROM invoice_lines il
               JOIN invoices i ON il.invoice_id = i.id
              WHERE il.id = ANY($1::text[])`,
            [ids],
          );

          // Apply line-level updates + audit.
          if (Object.keys(linePatch).length > 0) {
            const setFields = Object.keys(linePatch);
            const assigns = setFields.map((f, i) => `${f} = $${i + 1}`).join(', ');
            const vals = setFields.map(f => linePatch[f]);
            for (const cur of currents) {
              await execTx(
                txSql,
                `UPDATE invoice_lines SET ${assigns}, updated_at = NOW()
                  WHERE id = $${setFields.length + 1}`,
                [...vals, cur.id],
              );
              for (const field of setFields) {
                if (field === 'treatment_source') continue; // side-effect, not user-intent
                const oldVal = cur[field];
                const newVal = linePatch[field];
                if (String(oldVal ?? '') !== String(newVal ?? '')) {
                  await logAuditTx(txSql, {
                    entityId: cur.entity_id as string | undefined,
                    declarationId: declId,
                    action: 'update', targetType: 'invoice_line', targetId: cur.id,
                    field, oldValue: String(oldVal ?? ''), newValue: String(newVal ?? ''),
                    // Attach reason only to the primary business-change field.
                    reason: field === 'treatment' ? reason : undefined,
                  });
                }
              }
            }
          }

          // Apply invoice-level updates (distinct invoice_ids from
          // selection). Each invoice change gets its own audit row so
          // the timeline stays accurate.
          if (Object.keys(invoicePatch).length > 0) {
            const invoiceIds = Array.from(new Set(currents.map(c => c.invoice_id)));
            const setFields = Object.keys(invoicePatch);
            const assigns = setFields.map((f, i) => `${f} = $${i + 1}`).join(', ');
            const vals = setFields.map(f => invoicePatch[f]);
            // Get old invoice values for audit
            const oldInv = await qTx<Record<string, unknown> & { id: string }>(
              txSql,
              `SELECT id, invoice_date::text AS invoice_date FROM invoices WHERE id = ANY($1::text[])`,
              [invoiceIds],
            );
            for (const inv of oldInv) {
              await execTx(
                txSql,
                `UPDATE invoices SET ${assigns} WHERE id = $${setFields.length + 1}`,
                [...vals, inv.id],
              );
              for (const field of setFields) {
                const oldVal = inv[field];
                const newVal = invoicePatch[field];
                if (String(oldVal ?? '') !== String(newVal ?? '')) {
                  await logAuditTx(txSql, {
                    entityId: entityId,
                    declarationId: declId,
                    action: 'update', targetType: 'invoice', targetId: inv.id,
                    field, oldValue: String(oldVal ?? ''), newValue: String(newVal ?? ''),
                    reason,
                  });
                }
              }
            }
          }
        });

        changed = ids.length;
        // Do NOT write a single "bulk_action" audit row here — per-
        // line audit is the contract of the new update action.
        return NextResponse.json({ success: true, action, changed });
      }
      case 'set_treatment': {
        if (!value) return apiError('value_required', 'value (treatment code) is required.', { status: 400 });
        // Validate the treatment against the canonical config. The previous
        // version passed whatever string the client sent straight into SQL,
        // so a typo like "LUX_17%" would be persisted and then silently
        // excluded from every eCDF box filter.
        if (!(value in TREATMENT_CODES)) {
          return apiError('treatment_unknown',
            `Unknown treatment code "${value}".`,
            { hint: 'Pick a code from the treatment list.', status: 400 });
        }
        await execute(
          `UPDATE invoice_lines
              SET treatment = $1, treatment_source = 'manual', updated_at = NOW()
            WHERE id = ANY($2::text[])`,
          [value, ids]
        );
        changed = ids.length;
        break;
      }
      case 'acknowledge_flag': {
        await execute(
          `UPDATE invoice_lines
              SET flag_acknowledged = TRUE, updated_at = NOW()
            WHERE id = ANY($1::text[]) AND flag = TRUE`,
          [ids]
        );
        changed = ids.length;
        break;
      }
      case 'mark_reviewed': {
        await execute(
          `UPDATE invoice_lines
              SET reviewed = TRUE, state = CASE WHEN state = 'classified' THEN 'reviewed' ELSE state END,
                  updated_at = NOW()
            WHERE id = ANY($1::text[])`,
          [ids]
        );
        changed = ids.length;
        break;
      }
      case 'move_to_excluded': {
        await execute(
          `UPDATE invoice_lines
              SET state = 'deleted', deleted_at = NOW(),
                  deleted_reason = 'Moved to excluded by user (bulk)',
                  updated_at = NOW()
            WHERE id = ANY($1::text[])`,
          [ids]
        );
        changed = ids.length;
        break;
      }
      default:
        return apiError('unknown_action', `Unknown bulk action "${action}".`, { status: 400 });
    }

    await logAudit({
      entityId, declarationId: declId,
      action: 'update', targetType: 'invoice_line_bulk', targetId: `bulk-${Date.now()}`,
      field: 'bulk_action', oldValue: '',
      newValue: `${action} on ${ids.length} line(s) · value=${value ?? ''}`,
    });

    return NextResponse.json({ success: true, action, changed });
  } catch (e) { return apiFail(e, 'invoice-lines/bulk'); }
}
