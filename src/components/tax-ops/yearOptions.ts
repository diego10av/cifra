// ════════════════════════════════════════════════════════════════════════
// yearOptions — single source of truth for the year dropdown on every
// matrix page. Diego: "ahora aparecen 24, 25, 26 y 27, pero entiendo que
// luego de manera automática cada año se irán añadiendo un año más. O sea,
// no tiene sentido que aparezca hasta 2035. Está bien que aparezca 25, 26
// y 27, pero entiendo que luego el 1 de enero del 27 ya aparecerá el 28."
// Stint 39.C.
//
// Formula: `[currentYear - 2, currentYear - 1, currentYear, currentYear + 1]`.
// On 2026: [2024, 2025, 2026, 2027]. On 2027: [2025, 2026, 2027, 2028].
// The "N-2" bound keeps prior-year assessments visible (CIT has a lag).
// The "+1" lets Diego preview/roll over ahead of year-end.
// ════════════════════════════════════════════════════════════════════════

export function yearOptions(): number[] {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y, y + 1];
}

/** Default selected year. Most matrix pages default to the current year
 *  (VAT Q/M), except annual filings which lag one year (CIT, VAT annual,
 *  NWT review) — those default to current_year - 1. */
export function defaultYear(periodPattern: 'annual' | 'quarterly' | 'monthly' | 'semester' | 'adhoc' = 'quarterly'): number {
  const y = new Date().getFullYear();
  if (periodPattern === 'annual' || periodPattern === 'semester') return y - 1;
  return y;
}
