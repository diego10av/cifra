// Validation library used by both API routes (server) and forms (client).
// Pure functions, zero dependencies, mirror-safe.
//
// All validators return { ok: true, value } | { ok: false, error }. The error
// object matches the api-errors shape so route handlers can pass it through.

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string; hint?: string } };

// ── VAT number (EU format, per-country regex) ──
// Sources: EU Commission published format patterns (VIES). Check digits not
// validated locally — only format. Use `validateVatViaVIES` below for a
// remote check against the official database.
const VAT_PATTERNS: Record<string, RegExp> = {
  AT: /^U\d{8}$/i,
  BE: /^[0-1]\d{9}$/,
  BG: /^\d{9,10}$/,
  CY: /^\d{8}[A-Z]$/i,
  CZ: /^\d{8,10}$/,
  DE: /^\d{9}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/i,
  FI: /^\d{8}$/,
  FR: /^[A-Z0-9]{2}\d{9}$/i,
  GR: /^\d{9}$/,
  HR: /^\d{11}$/,
  HU: /^\d{8}$/,
  IE: /^(?:\d{7}[A-Z]{1,2}|\d[A-Z]\d{5}[A-Z])$/i,
  IT: /^\d{11}$/,
  LT: /^(?:\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  LV: /^\d{11}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/i,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SE: /^\d{12}$/,
  SI: /^\d{8}$/,
  SK: /^\d{10}$/,
};

export function validateVatNumber(raw: string | null | undefined): ValidationResult<string> {
  if (!raw || !raw.trim()) {
    return { ok: true, value: '' }; // empty is allowed — validation is optional
  }
  // Strip whitespace and common punctuation
  const cleaned = raw.replace(/[\s.\-/]+/g, '').toUpperCase();
  const match = cleaned.match(/^([A-Z]{2})(.+)$/);
  if (!match) {
    return {
      ok: false,
      error: {
        code: 'vat_format',
        message: `VAT number "${raw}" is not in the expected format.`,
        hint: 'Expected format: 2-letter country code followed by digits, e.g. LU12345678.',
      },
    };
  }
  const [, country, rest] = match;
  const pattern = VAT_PATTERNS[country];
  if (!pattern) {
    return {
      ok: false,
      error: {
        code: 'vat_unknown_country',
        message: `"${country}" is not a recognised EU country prefix.`,
        hint: 'Use a 2-letter ISO country code such as LU, DE, FR.',
      },
    };
  }
  if (!pattern.test(rest)) {
    return {
      ok: false,
      error: {
        code: 'vat_country_format',
        message: `VAT number does not match the format expected for ${country}.`,
        hint: 'Double-check the digits and any letters. The platform only validates format, not VIES status.',
      },
    };
  }
  return { ok: true, value: cleaned };
}

// ── IBAN with mod-97 checksum ──
export function validateIban(raw: string | null | undefined): ValidationResult<string> {
  if (!raw || !raw.trim()) return { ok: true, value: '' };
  const cleaned = raw.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(cleaned)) {
    return {
      ok: false,
      error: {
        code: 'iban_format',
        message: 'IBAN format is invalid.',
        hint: 'Expected 2-letter country + 2-digit check + up to 30 alphanumeric characters.',
      },
    };
  }
  // mod-97 checksum
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  // convert letters to digits (A=10..Z=35)
  const numeric = rearranged.replace(/[A-Z]/g, c => String(c.charCodeAt(0) - 55));
  // mod 97 on long string
  let remainder = 0;
  for (let i = 0; i < numeric.length; i += 7) {
    remainder = Number(String(remainder) + numeric.substring(i, i + 7)) % 97;
  }
  if (remainder !== 1) {
    return {
      ok: false,
      error: {
        code: 'iban_checksum',
        message: 'IBAN checksum is invalid.',
        hint: 'The IBAN format is correct but the check digits do not match. Verify the number was copied correctly.',
      },
    };
  }
  return { ok: true, value: cleaned };
}

// ── Invoice date: must be a real ISO date, not in the future, within last 20 years ──
export function validateInvoiceDate(raw: string | null | undefined, referenceDate: Date = new Date()): ValidationResult<string> {
  if (!raw || !raw.trim()) return { ok: true, value: '' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return {
      ok: false,
      error: {
        code: 'date_format',
        message: 'Date must be in YYYY-MM-DD format.',
      },
    };
  }
  const d = new Date(raw + 'T00:00:00Z');
  if (isNaN(d.getTime())) {
    return { ok: false, error: { code: 'date_invalid', message: 'Date is not a real calendar date.' } };
  }
  const future = d.getTime() > referenceDate.getTime();
  if (future) {
    return {
      ok: false,
      error: {
        code: 'date_future',
        message: `Invoice date ${raw} is in the future.`,
        hint: 'Invoice dates cannot be later than today.',
      },
    };
  }
  const tooOld = d.getFullYear() < referenceDate.getFullYear() - 20;
  if (tooOld) {
    return {
      ok: false,
      error: {
        code: 'date_too_old',
        message: `Invoice date ${raw} is more than 20 years old.`,
        hint: 'This is outside the retention period and probably a typo.',
      },
    };
  }
  return { ok: true, value: raw };
}

// ── Luxembourg VAT rate must be in the legal set ──
const ALLOWED_LUX_VAT_RATES = [0, 0.03, 0.08, 0.14, 0.17];

export function validateVatRate(raw: number | null | undefined): ValidationResult<number | null> {
  if (raw == null) return { ok: true, value: null };
  const n = Number(raw);
  if (isNaN(n)) {
    return { ok: false, error: { code: 'rate_not_number', message: 'VAT rate must be a number.' } };
  }
  // Accept a tiny tolerance for floating-point noise
  const allowed = ALLOWED_LUX_VAT_RATES.some(r => Math.abs(r - n) < 0.005);
  if (!allowed) {
    return {
      ok: false,
      error: {
        code: 'rate_not_legal',
        message: `VAT rate ${(n * 100).toFixed(1)}% is not a legal Luxembourg rate.`,
        hint: 'Allowed rates: 0%, 3%, 8%, 14%, 17%. Leave empty for reverse-charge (no rate).',
      },
    };
  }
  return { ok: true, value: n };
}

// ── Invoice totals sanity: ex VAT + VAT ≈ incl VAT ──
export function validateInvoiceTotals(params: {
  amount_ex_vat: number | null | undefined;
  vat_applied: number | null | undefined;
  amount_incl: number | null | undefined;
}): ValidationResult<null> {
  const ex = Number(params.amount_ex_vat ?? 0);
  const vat = Number(params.vat_applied ?? 0);
  const incl = Number(params.amount_incl ?? 0);
  // Only check when all three are provided and non-zero
  if (!ex && !vat && !incl) return { ok: true, value: null };
  if (!incl) return { ok: true, value: null }; // no incl to compare against
  const expected = ex + vat;
  const diff = Math.abs(expected - incl);
  if (diff > 0.02) {
    return {
      ok: false,
      error: {
        code: 'totals_mismatch',
        message: `Totals don't add up: ex-VAT ${ex.toFixed(2)} + VAT ${vat.toFixed(2)} = ${expected.toFixed(2)} but invoice total is ${incl.toFixed(2)}.`,
        hint: 'Difference is more than 2 cents — check the extracted figures.',
      },
    };
  }
  return { ok: true, value: null };
}

// ── ISO 4217 currency code ──
const COMMON_CURRENCIES = new Set([
  'EUR', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'HUF', 'SEK', 'DKK', 'NOK',
  'RON', 'BGN', 'HRK', 'JPY', 'CNY', 'HKD', 'SGD', 'AUD', 'CAD', 'NZD',
]);
export function validateCurrency(raw: string | null | undefined): ValidationResult<string> {
  if (!raw) return { ok: true, value: '' };
  const c = raw.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) {
    return {
      ok: false,
      error: {
        code: 'currency_format',
        message: `"${raw}" is not a 3-letter currency code.`,
        hint: 'Use ISO 4217 codes: EUR, USD, GBP, CHF, PLN, etc.',
      },
    };
  }
  if (!COMMON_CURRENCIES.has(c)) {
    // Don't hard-fail — the merchant might use an exotic currency. Just warn
    // by returning ok=true with the cleaned value; the UI can flag unknowns.
  }
  return { ok: true, value: c };
}

// ── Country code ──
const EU_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE',
  'IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
]);
export function validateCountry(raw: string | null | undefined): ValidationResult<string> {
  if (!raw) return { ok: true, value: '' };
  const c = raw.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) {
    return {
      ok: false,
      error: {
        code: 'country_format',
        message: `Country code "${raw}" is not 2 letters.`,
        hint: 'Use ISO 2-letter codes: LU, DE, FR, GB, US, etc.',
      },
    };
  }
  // We don't restrict to EU only — non-EU suppliers are classified with the
  // RC_NONEU_* rules. Just check it's a real-looking code.
  void EU_COUNTRIES;
  return { ok: true, value: c };
}
