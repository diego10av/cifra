-- 027_entity_extended_vat_fields — capture 7 more fields from the AED
-- VAT registration letter directly on the entity record.
--
-- Stint 24 (2026-04-23). First time we benchmarked the extractor
-- against real production paper, we confirmed the AED "Fiche
-- Signalétique" carries fields we weren't storing:
--   - bureau d'imposition (tax office)
--   - Code Activité (AED 2-3 letter activity code)
--   - Activité (free-text description)
--   - Coordonnées bancaires (Banque / IBAN / BIC)
--   - Date fin d'activité (de-registration date — critical for
--     detecting inactive entities before we run classification)
--
-- These now get their own columns on `entities` so the re-upload
-- diff flow (apply-vat-letter-diff route) can treat them as
-- first-class fields, and the classification/filing paths can
-- query them without unpacking the extracted_fields JSONB.
--
-- Audit-only fields (like the AED issue date, `document_date`)
-- stay inside `entity_official_documents.extracted_fields` JSONB
-- and are NOT surfaced as entity columns.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS everywhere.

ALTER TABLE entities
  ADD COLUMN IF NOT EXISTS tax_office           text,
  ADD COLUMN IF NOT EXISTS activity_code        text,
  ADD COLUMN IF NOT EXISTS activity_description text,
  ADD COLUMN IF NOT EXISTS bank_name            text,
  ADD COLUMN IF NOT EXISTS bank_iban            text,
  ADD COLUMN IF NOT EXISTS bank_bic             text,
  ADD COLUMN IF NOT EXISTS deregistration_date  date;

COMMENT ON COLUMN entities.tax_office IS
  'AED tax office as printed on the Fiche Signalétique, e.g. "Luxembourg 3", "Diekirch 1".';
COMMENT ON COLUMN entities.activity_code IS
  'AED 2-3 letter activity code from the Fiche Signalétique (e.g. "AN" for alternative investment fund).';
COMMENT ON COLUMN entities.activity_description IS
  'Free-text activity description as printed on the letter (e.g. "Alternative investment fund").';
COMMENT ON COLUMN entities.bank_name IS
  'Entity''s declared bank (Banque field on the Fiche Signalétique). Used for payment-matching during filing.';
COMMENT ON COLUMN entities.bank_iban IS
  'Entity''s declared IBAN, normalized without spaces and uppercased.';
COMMENT ON COLUMN entities.bank_bic IS
  'BIC/SWIFT code associated with bank_iban.';
COMMENT ON COLUMN entities.deregistration_date IS
  'Date fin d''activité from the AED letter. When non-null, the entity is de-registered — UI shows a banner and blocks creation of new declarations.';
