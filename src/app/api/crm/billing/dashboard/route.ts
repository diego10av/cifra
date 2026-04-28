import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/crm/billing/dashboard?year=2025
//
// Returns aggregated data powering the annual billing dashboard charts:
// top-10 clients, practice area split, monthly trend, aging buckets,
// YoY comparison vs previous year.
//
// Stint 64.I — Diego: "el dashboard no funciona para cuando das a
// todos los años." Right call. The previous code defaulted to
// current year on `?year=` (empty), so the page silently fell back
// without the user noticing. Now an empty/missing year is a real
// "all years" mode:
//   • KPIs aggregate across every year on file.
//   • Top clients ranked lifetime.
//   • Practice split aggregated lifetime.
//   • The monthly-trend card is replaced by an annual-trend card
//     (one bar per year) — the API ships `yearly` instead of
//     `monthly` in this mode.
//   • YoY card is hidden (no meaningful baseline when comparing
//     against itself).
//   • Aging is unchanged — it's an "as of today" snapshot of
//     outstanding receivables, year-independent by construction.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get('year');
  // Empty / missing / "0" / "all" → all-years mode.
  const allYears = !yearParam || yearParam === '' || yearParam === '0' || yearParam.toLowerCase() === 'all';
  const year = allYears ? null : Number(yearParam);
  if (!allYears && !Number.isFinite(year)) {
    return NextResponse.json({ error: 'invalid_year' }, { status: 400 });
  }
  const prevYear = allYears ? null : (year as number) - 1;

  // Build the WHERE clause once so each query stays consistent.
  // For per-year queries we use a parameter; for all-years we drop
  // the filter entirely (TRUE).
  const yearClause = allYears
    ? { sql: 'TRUE', params: [] as unknown[] }
    : { sql: 'EXTRACT(YEAR FROM issue_date) = $1', params: [year] };

  const yearClauseB = allYears
    ? { sql: 'TRUE', params: [] as unknown[] }
    : { sql: 'EXTRACT(YEAR FROM b.issue_date) = $1', params: [year] };

  const [kpis, topClients, monthly, yearly, practiceSplit, aging, prevKpis] = await Promise.all([
    // ── KPIs ──────────────────────────────────────────────────────
    query<{ total_incl_vat: string; total_paid: string; total_outstanding: string; invoice_count: string }>(
      `SELECT COALESCE(SUM(amount_incl_vat), 0)::text AS total_incl_vat,
              COALESCE(SUM(amount_paid), 0)::text     AS total_paid,
              COALESCE(SUM(outstanding), 0)::text     AS total_outstanding,
              COUNT(*)::text                           AS invoice_count
         FROM crm_billing_invoices
        WHERE ${yearClause.sql}`,
      yearClause.params,
    ),

    // ── Top 10 clients ────────────────────────────────────────────
    query<{ company_name: string; total: string; invoice_count: string }>(
      `SELECT c.company_name, SUM(b.amount_incl_vat)::text AS total, COUNT(*)::text AS invoice_count
         FROM crm_billing_invoices b
         JOIN crm_companies c ON c.id = b.company_id
        WHERE ${yearClauseB.sql}
        GROUP BY c.company_name
        ORDER BY SUM(b.amount_incl_vat) DESC
        LIMIT 10`,
      yearClauseB.params,
    ),

    // ── Monthly (only when a specific year is selected) ───────────
    allYears ? Promise.resolve([] as Array<{ month: number; total: string }>) :
      query<{ month: number; total: string }>(
        `SELECT EXTRACT(MONTH FROM issue_date)::int AS month,
                COALESCE(SUM(amount_incl_vat), 0)::text AS total
           FROM crm_billing_invoices
          WHERE EXTRACT(YEAR FROM issue_date) = $1
          GROUP BY EXTRACT(MONTH FROM issue_date)
          ORDER BY month`,
        [year],
      ),

    // ── Yearly (only in all-years mode) ───────────────────────────
    !allYears ? Promise.resolve([] as Array<{ year: number; total: string }>) :
      query<{ year: number; total: string }>(
        `SELECT EXTRACT(YEAR FROM issue_date)::int AS year,
                COALESCE(SUM(amount_incl_vat), 0)::text AS total
           FROM crm_billing_invoices
          WHERE issue_date IS NOT NULL
          GROUP BY EXTRACT(YEAR FROM issue_date)
          ORDER BY year`,
      ),

    // ── Practice split ────────────────────────────────────────────
    // When a matter has N practice areas, the invoice revenue is
    // split EQUALLY (1/N) across them — sum across buckets equals
    // total invoiced, no double-counting. Invoices without a matter
    // bucket as 'unassigned'. (Diego confirmed equal-split default
    // 2026-04-24; per-matter weights deferred.)
    query<{ practice: string; total: string }>(
      `SELECT practice, SUM(share)::text AS total
         FROM (
           SELECT unnest(areas.arr) AS practice,
                  b.amount_incl_vat / CARDINALITY(areas.arr)::numeric AS share
             FROM crm_billing_invoices b
             LEFT JOIN crm_matters m ON m.id = b.matter_id,
                  LATERAL (
                    SELECT COALESCE(
                      NULLIF(m.practice_areas, '{}'::text[]),
                      ARRAY['unassigned']::text[]
                    ) AS arr
                  ) areas
            WHERE ${yearClauseB.sql}
         ) t
        GROUP BY practice
        ORDER BY SUM(share) DESC`,
      yearClauseB.params,
    ),

    // ── Aging — always year-independent ───────────────────────────
    query<{ bucket: string; total: string; count: string }>(
      `WITH buckets AS (
         SELECT CASE
                  WHEN due_date IS NULL THEN 'no_due'
                  WHEN CURRENT_DATE - due_date <= 0 THEN 'not_yet_due'
                  WHEN CURRENT_DATE - due_date <= 30 THEN '0_30'
                  WHEN CURRENT_DATE - due_date <= 60 THEN '31_60'
                  WHEN CURRENT_DATE - due_date <= 90 THEN '61_90'
                  ELSE 'over_90'
                END AS bucket,
                outstanding
           FROM crm_billing_invoices
          WHERE outstanding > 0
       )
       SELECT bucket, SUM(outstanding)::text AS total, COUNT(*)::text AS count
         FROM buckets
        GROUP BY bucket`,
      [],
    ),

    // ── Previous-year KPIs for YoY (only when a specific year) ────
    allYears ? Promise.resolve([] as Array<{ total_incl_vat: string }>) :
      query<{ total_incl_vat: string }>(
        `SELECT COALESCE(SUM(amount_incl_vat), 0)::text AS total_incl_vat
           FROM crm_billing_invoices
          WHERE EXTRACT(YEAR FROM issue_date) = $1`,
        [prevYear],
      ),
  ]);

  return NextResponse.json({
    year: allYears ? 'all' : year,
    prev_year: prevYear,
    all_years: allYears,
    kpis: kpis[0] ?? null,
    prev_kpis: allYears ? null : (prevKpis[0] ?? null),
    top_clients: topClients,
    monthly,        // [] when allYears=true
    yearly,         // [] when allYears=false
    practice_split: practiceSplit,
    aging,
  });
}
