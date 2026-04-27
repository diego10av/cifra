-- Stint 52 — separate VAT return price from ICS price.
--
-- Diego: "que esa columna se llame Price Per Return y luego añadas
-- otra columna que sea Price Per ICS (Intra Community Supply of
-- Services), porque hay para algunas entidades que tenemos que
-- preparar también este formulario, entonces para distinguir el
-- precio que cobramos por una cosa y por la otra. Esto sólo para el IVA."
--
-- Today `tax_filings.invoice_price_eur` (mig 052) holds the price for
-- the filing as a whole. The ICS (Liste récapitulative / EC Sales
-- List) is a SEPARATE deliverable cifra prepares for clients with
-- intra-EU supplies of services, charged at a different rate. This
-- migration adds dedicated columns so the two prices can coexist on
-- the same filing without overwriting each other.
--
-- Per-filing granularity (matches existing invoice_price_eur). The
-- VAT matrix UI propagates a single edit across Q1-Q4 by PATCHing
-- every filing in the row; ICS works the same way.

ALTER TABLE tax_filings
  ADD COLUMN IF NOT EXISTS invoice_price_ics_eur  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS invoice_price_ics_note TEXT;

COMMENT ON COLUMN tax_filings.invoice_price_ics_eur IS
  'Price (EUR) charged for the ICS / EC Sales List companion to this VAT filing. NULL = not applicable / no ICS prepared. Stint 52.';
COMMENT ON COLUMN tax_filings.invoice_price_ics_note IS
  'Free-text note for the ICS price (e.g. scope, billing month). Stint 52.';
