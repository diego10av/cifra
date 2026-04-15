import { NextRequest, NextResponse } from 'next/server';
import { query, execute, logAudit, queryOne } from '@/lib/db';
import { fetchECBRate } from '@/lib/ecb';

// POST /api/declarations/[id]/fill-fx
// Iterates every line where currency != EUR and ecb_rate is null, fetches the
// ECB reference rate for the invoice_date, and updates ecb_rate + amount_eur.
//
// Idempotent: lines that already have an ecb_rate are not touched.
// Lines with no invoice_date or no currency_amount are skipped.
//
// Returns: { processed, updated, skipped, errors }
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const decl = await queryOne<{ entity_id: string }>(
    'SELECT entity_id FROM declarations WHERE id = $1',
    [id]
  );
  if (!decl) return NextResponse.json({ error: 'Declaration not found' }, { status: 404 });

  // Find candidate lines: non-EUR, no rate yet, has invoice_date and currency_amount.
  const rows = await query<{
    line_id: string; invoice_id: string; currency: string; invoice_date: string;
    currency_amount: number;
  }>(
    `SELECT il.id AS line_id, i.id AS invoice_id, i.currency,
            i.invoice_date, i.currency_amount::float AS currency_amount
       FROM invoice_lines il
       JOIN invoices i ON il.invoice_id = i.id
      WHERE il.declaration_id = $1
        AND il.state != 'deleted'
        AND i.currency IS NOT NULL
        AND UPPER(i.currency) != 'EUR'
        AND i.ecb_rate IS NULL
        AND i.invoice_date IS NOT NULL
        AND i.invoice_date ~ '^\\d{4}-\\d{2}-\\d{2}'
        AND i.currency_amount IS NOT NULL`,
    [id]
  );

  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Group by invoice (invoice-level fields are currency / ecb_rate)
  const byInvoice = new Map<string, { currency: string; date: string; lineIds: string[] }>();
  for (const r of rows) {
    const k = r.invoice_id;
    const entry = byInvoice.get(k) || { currency: r.currency, date: r.invoice_date, lineIds: [] };
    entry.lineIds.push(r.line_id);
    byInvoice.set(k, entry);
  }

  for (const [invoiceId, info] of byInvoice) {
    try {
      const rate = await fetchECBRate(info.currency, info.date);
      if (!rate || rate <= 0) { skipped += 1; continue; }
      // Update invoice header
      await execute(
        `UPDATE invoices SET ecb_rate = $1 WHERE id = $2`,
        [rate, invoiceId]
      );
      // Recompute amount_eur for each line of that invoice (proportionally if a single line)
      const lines = await query<{ id: string; currency_amount: number | null; amount_eur: number | null }>(
        `SELECT id, currency_amount::float AS currency_amount, amount_eur::float AS amount_eur
           FROM invoice_lines WHERE invoice_id = $1 AND state != 'deleted'`,
        [invoiceId]
      );
      for (const l of lines) {
        const newEur = l.currency_amount != null ? l.currency_amount / rate : l.amount_eur;
        await execute(
          `UPDATE invoice_lines SET amount_eur = $1, updated_at = NOW() WHERE id = $2`,
          [newEur, l.id]
        );
      }
      await logAudit({
        entityId: decl.entity_id,
        declarationId: id,
        action: 'update',
        targetType: 'invoice',
        targetId: invoiceId,
        field: 'ecb_rate',
        oldValue: '',
        newValue: `${info.currency} on ${info.date} = ${rate}`,
      });
      updated += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${info.currency}/${info.date}: ${msg}`);
    }
  }

  return NextResponse.json({
    processed: byInvoice.size,
    updated,
    skipped,
    errors,
  });
}
