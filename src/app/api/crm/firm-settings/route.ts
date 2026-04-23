import { NextRequest, NextResponse } from 'next/server';
import { execute, logAudit } from '@/lib/db';
import { getFirmSettings } from '@/lib/crm-firm-settings';

// GET — read the singleton firm-settings row.
export async function GET() {
  const settings = await getFirmSettings();
  return NextResponse.json(settings);
}

const UPDATABLE = [
  'firm_name', 'firm_address_lines', 'firm_vat_number', 'firm_matricule',
  'firm_rcs_number', 'firm_email', 'firm_phone', 'firm_website',
  'bank_name', 'bank_iban', 'bank_bic', 'payment_terms_days',
  'footer_text', 'logo_data_url', 'require_approval_above_eur',
] as const;

// PUT — update any subset of settings. Fires an audit row per changed
// field so we can later prove "on date X, the firm's IBAN on invoices
// was Y" if a payment dispute arises.
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const before = await getFirmSettings();

  const setClauses: string[] = [];
  const values: unknown[] = [];
  const changed: string[] = [];
  let idx = 1;

  for (const f of UPDATABLE) {
    if (!(f in body)) continue;
    let next = body[f];
    if (f === 'firm_address_lines') {
      next = Array.isArray(next) ? next.filter((l: unknown) => typeof l === 'string' && l.trim()).map((l: string) => l.trim()) : [];
    } else if (f === 'payment_terms_days') {
      const n = Number(next);
      next = Number.isFinite(n) && n > 0 ? Math.floor(n) : 30;
    } else if (f === 'require_approval_above_eur') {
      if (next === '' || next === null || next === undefined) next = null;
      else {
        const n = Number(next);
        next = Number.isFinite(n) && n > 0 ? n : null;
      }
    } else if (typeof next === 'string') {
      next = next.trim() || null;
    }
    const beforeVal = (before as unknown as Record<string, unknown>)[f] ?? null;
    const beforeStr = Array.isArray(beforeVal) ? JSON.stringify(beforeVal) : String(beforeVal ?? '');
    const afterStr = Array.isArray(next) ? JSON.stringify(next) : String(next ?? '');
    if (beforeStr === afterStr) continue;
    setClauses.push(`${f} = $${idx}`);
    values.push(next);
    idx += 1;
    changed.push(f);
  }

  if (changed.length === 0) return NextResponse.json({ changed: [] });

  setClauses.push(`updated_at = NOW()`);
  await execute(
    `UPDATE crm_firm_settings SET ${setClauses.join(', ')} WHERE id = 'default'`,
    values,
  );

  for (const f of changed) {
    // Deliberately omit old/new values for banking fields — we log
    // WHICH setting changed, but keep the actual values out of the
    // audit_log table. The source-of-truth is the row itself + its
    // updated_at timestamp.
    await logAudit({
      action: 'update',
      targetType: 'crm_firm_settings',
      targetId: 'default',
      field: f,
      reason: `Firm setting changed: ${f}`,
    });
  }

  return NextResponse.json({ changed });
}
