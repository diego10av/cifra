-- ════════════════════════════════════════════════════════════════════════
-- Migration 038 — Company billing fields for invoice PDFs
--
-- The Fase-4.1 invoice PDF renders a "Bill to" block with the client's
-- legal name, billing address, and VAT / matricule. Today crm_companies
-- only has company_name; this migration adds the three fields the PDF
-- needs (+ a registered_address for completeness).
--
-- All fields optional — invoices will render without them; they just
-- show a thinner Bill-to block. Adding them progressively means we
-- don't need to backfill any data.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE crm_companies
  ADD COLUMN IF NOT EXISTS billing_address     TEXT,
  ADD COLUMN IF NOT EXISTS registered_address  TEXT,
  ADD COLUMN IF NOT EXISTS vat_number          TEXT,
  ADD COLUMN IF NOT EXISTS matricule           TEXT;

COMMENT ON COLUMN crm_companies.billing_address IS 'Multi-line address rendered in invoice PDFs (and engagement letters).';
COMMENT ON COLUMN crm_companies.registered_address IS 'Registered office, if different from billing.';
COMMENT ON COLUMN crm_companies.vat_number IS 'E.g. LUxxxxxxxx — rendered on invoices, enables future intra-EU checks.';
COMMENT ON COLUMN crm_companies.matricule IS 'LU-specific 11/13-digit national ID. Optional.';


-- verification
--   SELECT column_name FROM information_schema.columns WHERE table_name='crm_companies' AND column_name IN ('billing_address','registered_address','vat_number','matricule');
--   -> 4 rows
