// ════════════════════════════════════════════════════════════════════════
// GET /api/declarations/[id]/audit-log.csv
//
// CSV export of the same audit trail rendered in the "Audit" tab on
// /declarations/[id]. Contables prefer CSV over PDF for reconciliation
// work — the columns map 1:1 to what accounting systems expect
// (timestamp, user, action, target, field, old value, new value, reason).
//
// Streams RFC-4180 quoted CSV with a sensible filename
// (audit-<entity>-<year>-<period>.csv).
// ════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { apiFail } from '@/lib/api-errors';

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function csvRow(cells: Array<unknown>): string {
  return cells.map(csvEscape).join(',');
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const decl = await queryOne<{
      id: string; year: number; period: string; status: string;
      entity_name: string;
    }>(
      `SELECT d.id, d.year, d.period, d.status, e.name AS entity_name
         FROM declarations d
         JOIN entities e ON d.entity_id = e.id
        WHERE d.id = $1`,
      [id],
    );
    if (!decl) {
      return new Response('Declaration not found', { status: 404 });
    }

    // Same underlying query as the audit-log JSON endpoint, but with
    // provider + description joined for more context.
    const events = await query<{
      created_at: string;
      user_id: string | null;
      action: string;
      target_type: string;
      target_id: string;
      field: string | null;
      old_value: string | null;
      new_value: string | null;
      reason: string | null;
      provider: string | null;
      line_description: string | null;
      ai_suggested_treatment: string | null;
    }>(
      `SELECT al.created_at::text AS created_at,
              al.user_id,
              al.action,
              al.target_type,
              al.target_id,
              al.field,
              al.old_value,
              al.new_value,
              al.reason,
              i.provider,
              il.description AS line_description,
              il.ai_suggested_treatment
         FROM audit_log al
    LEFT JOIN invoice_lines il ON al.target_type = 'invoice_line' AND al.target_id = il.id
    LEFT JOIN invoices i ON il.invoice_id = i.id
        WHERE al.declaration_id = $1
        ORDER BY al.created_at DESC`,
      [id],
    );

    const header = csvRow([
      'timestamp', 'user', 'action', 'target_type', 'target_id',
      'field', 'old_value', 'new_value', 'reason',
      'invoice_provider', 'line_description', 'ai_suggested_treatment',
    ]);

    const rows = events.map(e => csvRow([
      e.created_at,
      e.user_id ?? '',
      e.action,
      e.target_type,
      e.target_id,
      e.field ?? '',
      e.old_value ?? '',
      e.new_value ?? '',
      e.reason ?? '',
      e.provider ?? '',
      e.line_description ?? '',
      e.ai_suggested_treatment ?? '',
    ]));

    const body = [
      // Excel hint: Byte-order mark + UTF-8. Without it, accented LU
      // entity names render as mojibake in Excel's default import.
      '\uFEFF',
      header, ...rows,
    ].join('\r\n');

    const safeEntity = decl.entity_name.replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
    const filename = `audit-${safeEntity}-${decl.year}-${decl.period}.csv`;

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return apiFail(err, 'audit-log.csv');
  }
}
