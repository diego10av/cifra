import { describe, it, expect } from 'vitest';
import {
  validateVatNumber, validateIban, validateInvoiceDate,
  validateVatRate, validateInvoiceTotals, validateCurrency, validateCountry,
} from '@/lib/validation';

describe('VAT number validation', () => {
  it.each([
    ['LU12345678', true],
    ['DE123456789', true],
    ['FR12123456789', true],
    ['ES A39200019', true],
    ['PL1234567890', true],
    ['IT12345678901', true],
    ['NL123456789B01', true],
  ])('accepts %s', (vat, ok) => {
    const r = validateVatNumber(vat);
    expect(r.ok).toBe(ok);
  });

  it.each([
    ['LU12', 'too short LU'],
    ['LU1234567890', 'too long LU'],
    ['XX12345678', 'unknown country'],
    ['12345678', 'no prefix'],
  ])('rejects %s (%s)', (vat) => {
    const r = validateVatNumber(vat);
    expect(r.ok).toBe(false);
  });

  it('empty string is OK (optional field)', () => {
    expect(validateVatNumber('').ok).toBe(true);
    expect(validateVatNumber(null).ok).toBe(true);
  });

  it('strips whitespace and case-folds', () => {
    const r = validateVatNumber('lu 1234 5678');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('LU12345678');
  });
});

describe('IBAN validation', () => {
  it('accepts valid LU IBAN', () => {
    // AED's public IBAN — valid checksum
    const r = validateIban('LU35 0019 5655 0668 3000');
    expect(r.ok).toBe(true);
  });
  it('rejects bad checksum', () => {
    const r = validateIban('LU99 0019 5655 0668 3000');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('iban_checksum');
  });
  it('rejects malformed', () => {
    expect(validateIban('not-an-iban').ok).toBe(false);
  });
});

describe('Invoice date validation', () => {
  const REF = new Date('2026-04-15T00:00:00Z');

  it('accepts valid past date', () => {
    expect(validateInvoiceDate('2025-12-31', REF).ok).toBe(true);
  });
  it('rejects future date', () => {
    const r = validateInvoiceDate('2030-01-01', REF);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('date_future');
  });
  it('rejects > 20 years old', () => {
    const r = validateInvoiceDate('1990-01-01', REF);
    expect(r.ok).toBe(false);
  });
  it('rejects non-YYYY-MM-DD format', () => {
    expect(validateInvoiceDate('15/04/2026', REF).ok).toBe(false);
  });
});

describe('VAT rate validation', () => {
  it.each([0, 0.03, 0.08, 0.14, 0.17])('accepts %s', (r) => {
    expect(validateVatRate(r).ok).toBe(true);
  });
  it('rejects 0.20', () => {
    expect(validateVatRate(0.20).ok).toBe(false);
  });
  it('rejects 0.99', () => {
    expect(validateVatRate(0.99).ok).toBe(false);
  });
  it('null is OK (reverse charge)', () => {
    expect(validateVatRate(null).ok).toBe(true);
  });
});

describe('Invoice totals', () => {
  it('accepts matching totals', () => {
    const r = validateInvoiceTotals({ amount_ex_vat: 100, vat_applied: 17, amount_incl: 117 });
    expect(r.ok).toBe(true);
  });
  it('accepts rounding difference within 2c', () => {
    const r = validateInvoiceTotals({ amount_ex_vat: 100, vat_applied: 17, amount_incl: 117.01 });
    expect(r.ok).toBe(true);
  });
  it('rejects mismatch > 2c', () => {
    const r = validateInvoiceTotals({ amount_ex_vat: 100, vat_applied: 17, amount_incl: 120 });
    expect(r.ok).toBe(false);
  });
  it('skips check when totals are zero', () => {
    expect(validateInvoiceTotals({ amount_ex_vat: 0, vat_applied: 0, amount_incl: 0 }).ok).toBe(true);
  });
});

describe('Currency and country', () => {
  it('currency: accepts EUR, USD, GBP', () => {
    expect(validateCurrency('EUR').ok).toBe(true);
    expect(validateCurrency('usd').ok).toBe(true); // case-insensitive
  });
  it('currency: rejects 2-letter', () => {
    expect(validateCurrency('EU').ok).toBe(false);
  });
  it('country: accepts LU, DE, FR', () => {
    expect(validateCountry('lu').ok).toBe(true);
    expect(validateCountry('DE').ok).toBe(true);
  });
  it('country: rejects 3-letter', () => {
    expect(validateCountry('LUX').ok).toBe(false);
  });
});
