// ════════════════════════════════════════════════════════════════════════
// yearOptions — single source of truth for the year dropdown on every
// matrix page.
//
// Stint 43.D1 — narrowed the window from 4 years to 3:
//   `[currentYear - 1, currentYear, currentYear + 1]`.
// Diego's feedback: "el 2024 lo puedes borrar, no hace falta que aparezca
// nada". The N-2 bound was useful when Diego needed visibility on 2024
// CIT assessments coming in late, but at this point the 2024 work is
// done and 2024 is just noise in the dropdown. We keep N-1 (e.g. 2025
// when current is 2026) so prior-year assessments + late filings stay
// reachable, current-year obviously, and N+1 for rollover preview.
//
// Filings of older years stay alive in the DB; they're reachable via
// /tax-ops/entities/[id] (filings history matrix) or /tax-ops/filings.
// ════════════════════════════════════════════════════════════════════════

export function yearOptions(): number[] {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1];
}

/** Default selected year. Most matrix pages default to the current year
 *  (VAT Q/M), except annual filings which lag one year (CIT, VAT annual,
 *  NWT review) — those default to current_year - 1. */
export function defaultYear(periodPattern: 'annual' | 'quarterly' | 'monthly' | 'semester' | 'adhoc' = 'quarterly'): number {
  const y = new Date().getFullYear();
  if (periodPattern === 'annual' || periodPattern === 'semester') return y - 1;
  return y;
}
