// ════════════════════════════════════════════════════════════════════════
// Budget guard — hard cap on Anthropic spend.
//
// Called at the top of every expensive agent route (extract, validate,
// drafter) before any Anthropic call. If the current calendar month's
// cumulative cost exceeds BUDGET_MONTHLY_EUR, the call is refused with
// a 429-style error.
//
// Why this exists:
// - A runaway loop (client-side retry storm, a stuck job, a vulnerable
//   endpoint) can burn through an entire Anthropic credit in minutes.
// - The api_calls table already records cost_eur per call — we just
//   SUM it and compare.
// - Single-query, indexed on created_at, negligible overhead.
//
// Limits:
// - Env BUDGET_MONTHLY_EUR defaults to 75 (sensible for a founder-only
//   dogfood month). Production should override via Vercel env var.
// - Soft-warn at 80% of budget via `warn_at_pct` (consumer may
//   surface a banner — not auto-enforced).
// - Hard-block at 100% via `enforce_at_pct`.
//
// Not covered (deliberately):
// - Per-agent caps: one bucket for everything. Simpler; refine later.
// - Per-user caps: single-user product today. Multi-tenant (P2 #25)
//   adds firm_id on api_calls + this query.
// - Rate-limiting per minute: separate concern, handled by middleware
//   when it ships (P0 #6 sub-item).
// ════════════════════════════════════════════════════════════════════════

import { queryOne } from '@/lib/db';

export interface BudgetStatus {
  month_spend_eur: number;
  limit_eur: number;
  pct_used: number;
  over_budget: boolean;
  over_soft_warn: boolean;
  remaining_eur: number;
}

export interface BudgetError {
  code: 'budget_exceeded';
  status: 429;
  message: string;
  hint: string;
  month_spend_eur: number;
  limit_eur: number;
}

const DEFAULT_MONTHLY_LIMIT_EUR = 75;
const SOFT_WARN_PCT = 0.80;
const HARD_BLOCK_PCT = 1.00;

function getBudgetLimitEur(): number {
  const raw = process.env.BUDGET_MONTHLY_EUR;
  if (!raw) return DEFAULT_MONTHLY_LIMIT_EUR;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MONTHLY_LIMIT_EUR;
}

/**
 * Snapshot the current month's Anthropic spend. Cheap query.
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  const row = await queryOne<{ total: number | null }>(
    `SELECT COALESCE(SUM(cost_eur), 0)::float AS total
       FROM api_calls
      WHERE created_at >= date_trunc('month', NOW())
        AND status != 'error'`,
  );
  const spend = Number(row?.total ?? 0);
  const limit = getBudgetLimitEur();
  const pct = limit > 0 ? spend / limit : 0;
  return {
    month_spend_eur: Math.round(spend * 100) / 100,
    limit_eur: limit,
    pct_used: Math.round(pct * 10000) / 10000, // 4 decimals
    over_soft_warn: pct >= SOFT_WARN_PCT,
    over_budget: pct >= HARD_BLOCK_PCT,
    remaining_eur: Math.max(0, Math.round((limit - spend) * 100) / 100),
  };
}

/**
 * Enforce the monthly budget. Call at the top of every Anthropic-using
 * route, before any expensive call. Returns either `{ ok: true, status }`
 * — proceed — or `{ ok: false, error }` — the caller must respond 429.
 *
 * Safe to call every request; the query is SUM-over-index, single-digit
 * milliseconds on the current DB.
 */
export async function requireBudget(): Promise<
  | { ok: true; status: BudgetStatus }
  | { ok: false; error: BudgetError; status: BudgetStatus }
> {
  const status = await getBudgetStatus();
  if (status.over_budget) {
    return {
      ok: false,
      status,
      error: {
        code: 'budget_exceeded',
        status: 429,
        message:
          `Monthly Anthropic budget reached: €${status.month_spend_eur.toFixed(2)} ` +
          `of €${status.limit_eur.toFixed(2)}. New AI calls are blocked until the ` +
          `1st of next month.`,
        hint:
          'Raise BUDGET_MONTHLY_EUR in Vercel env if this was expected, or inspect ' +
          '/metrics for which agent consumed the budget.',
        month_spend_eur: status.month_spend_eur,
        limit_eur: status.limit_eur,
      },
    };
  }
  return { ok: true, status };
}
