-- ════════════════════════════════════════════════════════════════════════
-- Migration 052 — Invoice price per filing (stint 40.O)
--
-- Diego's feedback: "para cada entidad, al final de la derecha, también
-- debería haber una opción de añadir el precio que estamos facturando
-- al cliente. Por ejemplo, 3.000€ +5% office expenses +VAT if applicable".
-- He factura manualmente y wants el precio a mano cuando escribe al CFO.
--
-- invoice_price_eur — the base fee in euros, NULL when not yet set
-- invoice_price_note — the free-text clarification (office expenses, VAT
--                      applicability). Default mirrors Diego's usual pattern.
--
-- Idempotent (IF NOT EXISTS) so reruns are safe.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE tax_filings
  ADD COLUMN IF NOT EXISTS invoice_price_eur NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS invoice_price_note TEXT;

COMMENT ON COLUMN tax_filings.invoice_price_eur IS
  'Base fee in euros charged to the client for this filing. NULL = not yet set. Stint 40.O.';
COMMENT ON COLUMN tax_filings.invoice_price_note IS
  'Free-text clarification accompanying the price (e.g. "+5% office expenses +VAT if applicable"). Shown next to the price in the matrix.';
