// ════════════════════════════════════════════════════════════════════════
// Synthetic VAT registration letter extraction.
//
// Used by vat-letter-extract.test.ts to exercise fieldsToEntityPatch()
// and any future post-processing logic WITHOUT calling Opus (CI has no
// API key) and WITHOUT embedding real client data.
//
// ALL VALUES BELOW ARE DELIBERATELY FAKE:
//   - "Example Holdings Luxembourg SCS" is not a real LU entity
//   - matricule "2024000001" would resolve to a rejected AED lookup
//   - VAT "LU00000000" fails the VAT-ID check algorithm
//   - IBAN "LU000000000000000000" fails the IBAN checksum
//   - BIC "DUMMYLU0" is not an assigned SWIFT code
//   - bank "DUMMY BANK AG" does not exist
//   - address is a placeholder
//
// These fake values mirror the real AED Fiche Signalétique LAYOUT
// (the fields the extractor is expected to pull) without borrowing any
// real-client data. Anyone reading this fixture can confirm at a glance
// that no confidential info leaked into the test suite.
// ════════════════════════════════════════════════════════════════════════

import type { ExtractedVatLetterFields } from '@/lib/vat-letter-extract';

/** Synthetic happy-path extraction of a fund registration letter. */
export const SYNTHETIC_VAT_LETTER_EXTRACTION: ExtractedVatLetterFields = {
  name: 'Example Holdings Luxembourg SCS',
  legal_form: 'SCS',
  vat_number: 'LU00000000',
  matricule: '2024000001',
  rcs_number: 'B000001',
  address: '1, Rue Example, L-0000 Luxembourg',
  regime: 'simplified',
  frequency: 'yearly',
  entity_type: 'fund',
  effective_date: '2024-01-01',

  // Stint 24 additions
  tax_office: 'Luxembourg 3',
  activity_code: 'AN',
  activity_description: 'Alternative investment fund',
  bank_name: 'DUMMY BANK AG',
  bank_iban: 'LU000000000000000000',
  bank_bic: 'DUMMYLU0',
  deregistration_date: null,
  document_date: '2024-01-05',

  warnings: [],
};

/** Synthetic extraction from a de-registration letter — same entity,
 *  but now `deregistration_date` is set. Used to regression-test that
 *  the patch flow surfaces this field so the UI can render the
 *  "inactive entity" banner. */
export const SYNTHETIC_DEREGISTERED_EXTRACTION: ExtractedVatLetterFields = {
  ...SYNTHETIC_VAT_LETTER_EXTRACTION,
  deregistration_date: '2025-06-30',
  warnings: ['Entity de-registered on 2025-06-30 — no new declarations should be filed.'],
};

/** Synthetic extraction with only partial banking info (IBAN but no
 *  bank name or BIC). Real letters sometimes arrive with one of the
 *  three fields blank on the form; the patch must still surface the
 *  IBAN alone rather than dropping it because the trio isn't complete. */
export const SYNTHETIC_PARTIAL_BANK_EXTRACTION: ExtractedVatLetterFields = {
  ...SYNTHETIC_VAT_LETTER_EXTRACTION,
  bank_name: null,
  bank_iban: 'LU111111111111111111',
  bank_bic: null,
};

/** Synthetic extraction where the extractor returned empty strings
 *  instead of nulls (a known failure mode with certain Opus responses).
 *  The normaliser in extractVatLetterFields() is supposed to coerce
 *  these to null, but the patch function should be defensive too. */
export const SYNTHETIC_EMPTY_STRINGS_EXTRACTION: ExtractedVatLetterFields = {
  ...SYNTHETIC_VAT_LETTER_EXTRACTION,
  bank_name: '' as unknown as string | null,
  bank_iban: '   ' as unknown as string | null,
  bank_bic: '' as unknown as string | null,
};
