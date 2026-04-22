// Generate next MP-YYYY-NNNN invoice number. Sequence resets per year.
// UNIQUE constraint on crm_billing_invoices.invoice_number enforces
// collision safety at the DB level.

import { query } from '@/lib/db';

export async function nextInvoiceNumber(prefix: string = 'MP'): Promise<string> {
  const year = new Date().getFullYear();
  const like = `${prefix}-${year}-%`;
  const rows = await query<{ max_seq: string | null }>(
    `SELECT MAX(CAST(SPLIT_PART(invoice_number, '-', 3) AS integer))::text AS max_seq
       FROM crm_billing_invoices
      WHERE invoice_number LIKE $1
        AND invoice_number ~ ('^' || $2 || '-[0-9]{4}-[0-9]+$')`,
    [like, prefix + '-' + year],
  );
  const last = Number(rows[0]?.max_seq ?? 0);
  const next = last + 1;
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
}
