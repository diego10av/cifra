import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

// GET /api/metrics — quality and operational metrics derived from audit_log
// + invoice_lines.
//
// PRD §17.4 quality framework:
//   - Extraction accuracy: % of invoices where no field was manually corrected
//   - Classification accuracy: % of lines where the user did not change the treatment
//   - Draft email quality: % of emails sent without significant modification
//
// Cost per-invoice estimate (PRD §17.3):
//   triage (Haiku) ~€0.003 + extractor (Haiku) ~€0.003 = ~€0.006 per invoice
//   classifier ~€0.08 (Opus) — but we currently use Haiku, so much lower
export async function GET() {
  // Total invoices ever processed
  const totalInvoices = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM invoices WHERE extraction_source = 'ai'`
  );

  // Invoices that had any manual correction post-extraction
  const correctedInvoices = await queryOne<{ n: number }>(
    `SELECT COUNT(DISTINCT i.id)::int AS n
       FROM invoices i
       JOIN audit_log a
         ON a.target_type = 'invoice_line' AND a.action = 'update'
        AND a.target_id IN (SELECT id FROM invoice_lines WHERE invoice_id = i.id)
        AND a.field IN ('description','amount_eur','vat_rate','vat_applied','rc_amount','provider','country','invoice_date','invoice_number')
      WHERE i.extraction_source = 'ai'`
  );

  // Invoices that had treatment changed by user (treatment_source went to 'manual')
  const treatmentChanges = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n
       FROM audit_log
      WHERE target_type = 'invoice_line'
        AND field = 'treatment'
        AND new_value LIKE '%(manual)%'`
  );

  // AI-classified lines vs total classified
  const totalLines = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM invoice_lines WHERE state != 'deleted' AND treatment IS NOT NULL`
  );
  const ruleClassified = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM invoice_lines
      WHERE state != 'deleted' AND treatment_source = 'rule'`
  );
  const inferredLines = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM invoice_lines
      WHERE state != 'deleted' AND treatment_source = 'inference'`
  );
  const precedentLines = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM invoice_lines
      WHERE state != 'deleted' AND treatment_source = 'precedent'`
  );
  const manualLines = await queryOne<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM invoice_lines
      WHERE state != 'deleted' AND treatment_source = 'manual'`
  );

  // Per-rule frequency
  const byRule = await query<{ classification_rule: string; n: number }>(
    `SELECT classification_rule, COUNT(*)::int AS n
       FROM invoice_lines
      WHERE state != 'deleted' AND classification_rule IS NOT NULL
      GROUP BY classification_rule
      ORDER BY n DESC`
  );

  // Declarations by status
  const declarations = await query<{ status: string; n: number }>(
    `SELECT status, COUNT(*)::int AS n FROM declarations GROUP BY status ORDER BY n DESC`
  );

  // Activity over time (last 30 days)
  const activity = await query<{ d: string; n: number }>(
    `SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS d, COUNT(*)::int AS n
       FROM audit_log
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1`
  );

  // Actual spend from api_calls table (populated by the wrapper)
  const spend = await queryOne<{ calls: number; total_eur: number; total_tokens: number }>(
    `SELECT COUNT(*)::int AS calls,
            COALESCE(SUM(cost_eur), 0)::float AS total_eur,
            COALESCE(SUM(input_tokens + output_tokens), 0)::int AS total_tokens
       FROM api_calls`
  );
  const spendByAgent = await query<{ agent: string; calls: number; total_eur: number }>(
    `SELECT agent, COUNT(*)::int AS calls, COALESCE(SUM(cost_eur),0)::float AS total_eur
       FROM api_calls GROUP BY agent ORDER BY total_eur DESC`
  );

  // Fallback estimate when no api_calls rows exist (e.g. pre-wrapper data).
  const estimatedApiCalls = (totalInvoices?.n || 0) * 2;
  const estimatedCostEUR = estimatedApiCalls * 0.003;
  const haveRealData = (spend?.calls || 0) > 0;

  // Accuracy KPIs
  const totalAi = totalInvoices?.n || 0;
  const corrected = correctedInvoices?.n || 0;
  const extractionAccuracy = totalAi > 0 ? ((totalAi - corrected) / totalAi) * 100 : null;

  const totalClassified = totalLines?.n || 0;
  const treatmentChanged = treatmentChanges?.n || 0;
  const classificationAccuracy = totalClassified > 0
    ? ((totalClassified - treatmentChanged) / totalClassified) * 100
    : null;

  return NextResponse.json({
    extraction: {
      total_invoices: totalAi,
      corrected: corrected,
      accuracy_pct: extractionAccuracy,
      target_pct: 95,
    },
    classification: {
      total_lines: totalClassified,
      changed_by_user: treatmentChanged,
      accuracy_pct: classificationAccuracy,
      target_pct: 90,
      by_source: {
        rule: ruleClassified?.n || 0,
        precedent: precedentLines?.n || 0,
        inference: inferredLines?.n || 0,
        manual: manualLines?.n || 0,
      },
      by_rule: byRule,
    },
    declarations_by_status: declarations,
    activity_last_30d: activity,
    cost_estimate: {
      anthropic_api_calls: haveRealData ? (spend?.calls || 0) : estimatedApiCalls,
      anthropic_eur: haveRealData ? (spend?.total_eur || 0) : estimatedCostEUR,
      total_tokens: haveRealData ? (spend?.total_tokens || 0) : null,
      by_agent: spendByAgent,
      is_real: haveRealData,
      note: haveRealData
        ? 'Actual spend from logged API calls.'
        : 'Estimate assumes triage + extract per invoice. No real usage logged yet.',
    },
  });
}
