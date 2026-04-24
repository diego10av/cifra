#!/usr/bin/env tsx
// ════════════════════════════════════════════════════════════════════════
// scripts/tax-ops-data-fix.ts
//
// One-shot data fix for stint 35. Corrects the period year of annual
// filings imported from Diego's 2026-named Excel books — he reused last
// year's file and kept filling 2025 data into cells labelled "2026".
//
// Rule:
//   - Annual filings (cit_annual, nwt_annual, vat_annual, vat_simplified_
//     annual, wht_director_annual, fatca_crs_annual) originally imported
//     with period_year=2026 → move to period_year=2025, period_label='2025',
//     recompute deadline via computeDeadline().
//   - Periodic filings (vat_quarterly, vat_monthly, subscription_tax_
//     quarterly, wht_director_monthly, bcl_sbs_quarterly, bcl_216_monthly)
//     stay at 2026 — they're current-year ongoing filings.
//   - Historical filings at year=2024 stay untouched.
//   - Everything scoped to import_source='excel_import' only.
//
// Usage:
//   tsx scripts/tax-ops-data-fix.ts --dry-run     (default)
//   tsx scripts/tax-ops-data-fix.ts --commit
// ════════════════════════════════════════════════════════════════════════

import { query, tx, qTx, execTx, logAuditTx } from '../src/lib/db';
import { computeDeadline, type DeadlineRule } from '../src/lib/tax-ops-deadlines';

const args = process.argv.slice(2);
const mode = args.includes('--commit') ? 'commit' : 'dry_run';

const ANNUAL_TYPES_TO_SHIFT = [
  'cit_annual',
  'nwt_annual',
  'vat_annual',
  'vat_simplified_annual',
  'wht_director_annual',
  'fatca_crs_annual',
];

interface Filing {
  id: string;
  tax_type: string;
  period_pattern: string;
  period_year: number;
  period_label: string;
  deadline_date: string | null;
  status: string;
  entity_name: string;
}

async function main(): Promise<void> {
  console.log('─────────────────────────────────────────────');
  console.log(`Tax-Ops data-fix · mode=${mode}`);
  console.log('Target: annual filings wrongly labelled 2026 → 2025.');
  console.log('Periodic filings (VAT Q/M, sub-tax, BCL, WHT mensual) untouched.');
  console.log('─────────────────────────────────────────────\n');

  // 1. Fetch the affected filings
  const affected = await query<Filing>(
    `SELECT f.id, o.tax_type, o.period_pattern, f.period_year, f.period_label,
            f.deadline_date::text AS deadline_date, f.status,
            e.legal_name AS entity_name
       FROM tax_filings f
       JOIN tax_obligations o ON o.id = f.obligation_id
       JOIN tax_entities e    ON e.id = o.entity_id
      WHERE f.import_source = 'excel_import'
        AND f.period_year = 2026
        AND o.tax_type = ANY($1::text[])
      ORDER BY o.tax_type, e.legal_name`,
    [ANNUAL_TYPES_TO_SHIFT],
  );

  console.log(`Found ${affected.length} filings to shift 2026 → 2025.\n`);

  // Breakdown by tax_type
  const byType = new Map<string, number>();
  for (const f of affected) byType.set(f.tax_type, (byType.get(f.tax_type) ?? 0) + 1);
  for (const [t, n] of Array.from(byType.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t.padEnd(30)} ${n}`);
  }
  console.log();

  // 2. Load deadline rules (needed to recompute)
  const ruleRows = await query<DeadlineRule>(
    `SELECT tax_type, period_pattern, rule_kind, rule_params, admin_tolerance_days
       FROM tax_deadline_rules`,
  );
  const ruleByKey = new Map<string, DeadlineRule>();
  for (const r of ruleRows) ruleByKey.set(`${r.tax_type}|${r.period_pattern}`, r);

  // 3. Preview: show old vs new for first 10 rows
  console.log('──── Preview (first 10) ────');
  for (const f of affected.slice(0, 10)) {
    const rule = ruleByKey.get(`${f.tax_type}|${f.period_pattern}`);
    let newDeadline: string | null = null;
    if (rule) {
      try { newDeadline = computeDeadline(rule, 2025, '2025').effective; }
      catch { newDeadline = null; }
    }
    console.log(`  ${f.entity_name.padEnd(40).slice(0, 40)} ${f.tax_type.padEnd(22)} ${f.period_label} → 2025  ·  deadline ${f.deadline_date ?? '—'} → ${newDeadline ?? '—'}`);
  }
  if (affected.length > 10) console.log(`  …and ${affected.length - 10} more.`);
  console.log();

  if (mode === 'dry_run') {
    console.log('DRY RUN — no DB changes. Re-run with --commit to apply.');
    return;
  }

  // 4. Commit mode — transactional update
  console.log('Writing to DB (transactional)…\n');

  let updatedCount = 0;
  await tx(async (txSql) => {
    for (const f of affected) {
      const rule = ruleByKey.get(`${f.tax_type}|${f.period_pattern}`);
      let newDeadline: string | null = null;
      if (rule) {
        try { newDeadline = computeDeadline(rule, 2025, '2025').effective; }
        catch { newDeadline = null; }
      }

      // period_label is '2026' for true annuals; change to '2025'.
      // If some odd row has a sub-period label (shouldn't happen for
      // annuals) we still just replace the leading year prefix.
      const newLabel = f.period_label === '2026'
        ? '2025'
        : f.period_label.replace(/^2026/, '2025');

      await execTx(
        txSql,
        `UPDATE tax_filings
            SET period_year   = 2025,
                period_label  = $1,
                deadline_date = $2,
                updated_at    = NOW()
          WHERE id = $3`,
        [newLabel, newDeadline, f.id],
      );
      updatedCount += 1;
    }

    // Also: verify no residual periodic filings got caught in this set.
    const sanity = await qTx<{ n: string }>(
      txSql,
      `SELECT COUNT(*)::text AS n FROM tax_filings f
         JOIN tax_obligations o ON o.id = f.obligation_id
        WHERE f.import_source = 'excel_import'
          AND f.period_year = 2026
          AND o.tax_type = ANY($1::text[])`,
      [ANNUAL_TYPES_TO_SHIFT],
    );
    if (Number(sanity[0]?.n ?? 0) !== 0) {
      throw new Error(`Post-update sanity failed: ${sanity[0]?.n} annual rows still at year 2026. Rolling back.`);
    }

    await logAuditTx(txSql, {
      userId: 'stint_35_data_fix',
      action: 'tax_ops_year_2025_shift',
      targetType: 'tax_filings',
      targetId: 'batch_35A',
      newValue: JSON.stringify({
        reason: 'Diego\'s Excel was labelled 2026 but annual filings inside are 2025 work.',
        updated: updatedCount,
        types_affected: Object.fromEntries(byType),
      }),
    });

    console.log(`✓ Updated ${updatedCount} filings (period_year 2026 → 2025, period_label + deadline recomputed).`);
  });

  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
