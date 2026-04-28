-- Migration 074 — Backfill crm_billing_invoices.vat_rate
--
-- Stint 64.I follow-up to Diego: "no aparece siempre el iva de las
-- facturas. especialmente de las antiguas. en la ultima factura que
-- he incluido si que aparece el iva pero deberia de aparecer en
-- todas." Right call.
--
-- Diagnosis (executed 2026-04-28):
--   • 21 invoices total in crm_billing_invoices.
--   • 20 of 21 have vat_amount + amount_excl_vat populated and
--     internally consistent (vat_amount = amount_excl_vat * 0.17 to
--     the cent on every row), but vat_rate is NULL because the
--     legacy import path (and pre-stint-26 manual entries) never
--     persisted the rate. Only the most recent invoice
--     (22602379, 2026-04-10) has vat_rate=17.00 stored — that's the
--     one Diego just created through the new form.
--   • 1 invoice (MP-2025-0004) has both vat_amount NULL AND
--     incoherent amounts (incl < excl). Left alone — Diego edits
--     manually.
--
-- This migration derives vat_rate = round((vat_amount /
-- amount_excl_vat) * 100, 2) for every row where it can be safely
-- computed: vat_rate IS NULL, vat_amount IS NOT NULL, amount_excl_vat
-- > 0, and vat_amount >= 0 (sanity).
--
-- The rate is the ground truth ratio of what was actually charged,
-- not a guess. Idempotent: re-running is a no-op once vat_rate
-- columns are populated.

UPDATE crm_billing_invoices
   SET vat_rate = ROUND((vat_amount / amount_excl_vat) * 100, 2)
 WHERE vat_rate IS NULL
   AND vat_amount IS NOT NULL
   AND amount_excl_vat IS NOT NULL
   AND amount_excl_vat > 0
   AND vat_amount >= 0;

-- Verify (logs the populated count to migration output).
DO $$
DECLARE
  populated  int;
  remaining  int;
BEGIN
  SELECT COUNT(*) INTO populated
    FROM crm_billing_invoices
   WHERE vat_rate IS NOT NULL;
  SELECT COUNT(*) INTO remaining
    FROM crm_billing_invoices
   WHERE vat_rate IS NULL;
  RAISE NOTICE 'mig 074: vat_rate populated=%, still_null=%', populated, remaining;
END $$;
