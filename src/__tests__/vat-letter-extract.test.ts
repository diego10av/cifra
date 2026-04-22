// Unit tests for the VAT registration letter extractor — specifically
// the post-processing + patch-mapping helpers. We do NOT exercise the
// Opus call itself (CI has no API key, and integration testing that
// path is the job of scripts/extractor-diagnostic.ts run by Diego
// against real paper on demand).
//
// All test inputs use synthetic fixtures with obviously-fake data.
// See src/__tests__/fixtures/vat-letter-synthetic.ts for the
// anonymization rationale.

import { describe, it, expect } from 'vitest';
import { fieldsToEntityPatch } from '@/lib/vat-letter-extract';
import {
  SYNTHETIC_VAT_LETTER_EXTRACTION,
  SYNTHETIC_DEREGISTERED_EXTRACTION,
  SYNTHETIC_PARTIAL_BANK_EXTRACTION,
} from './fixtures/vat-letter-synthetic';

describe('fieldsToEntityPatch — stint 24 expanded schema', () => {
  it('maps all 16 persistable fields from a happy-path extraction', () => {
    const patch = fieldsToEntityPatch(SYNTHETIC_VAT_LETTER_EXTRACTION);
    // Legacy 9 fields (pre-stint 24)
    expect(patch).toMatchObject({
      name: 'Example Holdings Luxembourg SCS',
      legal_form: 'SCS',
      vat_number: 'LU00000000',
      matricule: '2024000001',
      rcs_number: 'B000001',
      address: '1, Rue Example, L-0000 Luxembourg',
      entity_type: 'fund',
      regime: 'simplified',
    });
    // Stint 24 additions
    expect(patch).toMatchObject({
      tax_office: 'Luxembourg 3',
      activity_code: 'AN',
      activity_description: 'Alternative investment fund',
      bank_name: 'DUMMY BANK AG',
      bank_iban: 'LU000000000000000000',
      bank_bic: 'DUMMYLU0',
      deregistration_date: null,
    });
    // Frequency translation: 'yearly' (extractor vocab) → 'annual' (DB enum)
    expect(patch.frequency).toBe('annual');
  });

  it('never surfaces document_date — it is audit-only, lives in extracted_fields JSONB', () => {
    const patch = fieldsToEntityPatch(SYNTHETIC_VAT_LETTER_EXTRACTION);
    // The synthetic fixture has document_date = '2024-01-05' but the
    // patch function must not propagate it to entity columns.
    expect(patch).not.toHaveProperty('document_date');
  });

  it('frequency "yearly" translates to "annual" (existing DB enum)', () => {
    const patch = fieldsToEntityPatch({
      ...SYNTHETIC_VAT_LETTER_EXTRACTION,
      frequency: 'yearly',
    });
    expect(patch.frequency).toBe('annual');
  });

  it('frequency "quarterly" and "monthly" pass through unchanged', () => {
    const q = fieldsToEntityPatch({ ...SYNTHETIC_VAT_LETTER_EXTRACTION, frequency: 'quarterly' });
    const m = fieldsToEntityPatch({ ...SYNTHETIC_VAT_LETTER_EXTRACTION, frequency: 'monthly' });
    expect(q.frequency).toBe('quarterly');
    expect(m.frequency).toBe('monthly');
  });

  it('surfaces deregistration_date when the letter is a de-registration', () => {
    const patch = fieldsToEntityPatch(SYNTHETIC_DEREGISTERED_EXTRACTION);
    expect(patch.deregistration_date).toBe('2025-06-30');
    // Other fields unchanged from the baseline — the re-upload diff
    // would only surface deregistration_date as the delta.
    expect(patch.name).toBe('Example Holdings Luxembourg SCS');
  });

  it('preserves partial banking info — IBAN without name/BIC is still surfaced', () => {
    const patch = fieldsToEntityPatch(SYNTHETIC_PARTIAL_BANK_EXTRACTION);
    expect(patch.bank_iban).toBe('LU111111111111111111');
    expect(patch.bank_name).toBeNull();
    expect(patch.bank_bic).toBeNull();
  });

  it('passes null fields through — never invents a value', () => {
    const allNull: typeof SYNTHETIC_VAT_LETTER_EXTRACTION = {
      name: null,
      legal_form: null,
      vat_number: null,
      matricule: null,
      rcs_number: null,
      address: null,
      regime: null,
      frequency: null,
      entity_type: null,
      effective_date: null,
      tax_office: null,
      activity_code: null,
      activity_description: null,
      bank_name: null,
      bank_iban: null,
      bank_bic: null,
      deregistration_date: null,
      document_date: null,
      warnings: [],
    };
    const patch = fieldsToEntityPatch(allNull);
    expect(Object.values(patch).every(v => v === null)).toBe(true);
  });
});
