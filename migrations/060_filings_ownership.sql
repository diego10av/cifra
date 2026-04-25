-- ════════════════════════════════════════════════════════════════════════
-- Migration 060 — partner_in_charge + associates_working (stint 43.D11)
--
-- Diego: "el 'prepared with' diría partner in charge, pero también vale
-- la pena tener una columna nueva separada para los asociados que están
-- ejecutando el trabajo."
--
-- Splits the legacy `prepared_with` semantic into two distinct ownership
-- fields:
--   • partner_in_charge   — the partner(s) who own the engagement (Big4
--                           model: 1 lead + occasionally a co-pilot).
--   • associates_working  — the associate(s) doing the prep work.
--
-- Both are TEXT[] (matching the existing `prepared_with` shape) so the
-- inline-tags editor on the matrix keeps working without changes.
--
-- Backfill: copy `prepared_with` → `partner_in_charge` because Diego
-- has been using prepared_with as a "partner" field today (the existing
-- entries are partner names like Diego, Gab, Vale, Ander, Jero).
-- `associates_working` starts empty and Diego fills as he goes.
--
-- The legacy column `prepared_with` stays put for now — older audit-log
-- entries reference it. A future migration can drop it once we're sure
-- no UI or report still reads from it.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE tax_filings
  ADD COLUMN IF NOT EXISTS partner_in_charge  TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS associates_working TEXT[] NOT NULL DEFAULT '{}';

-- Backfill partner_in_charge from prepared_with (preserves Diego's data).
UPDATE tax_filings
   SET partner_in_charge = prepared_with
 WHERE prepared_with IS NOT NULL
   AND array_length(prepared_with, 1) > 0
   AND (partner_in_charge IS NULL OR array_length(partner_in_charge, 1) IS NULL);

COMMENT ON COLUMN tax_filings.partner_in_charge IS
  'Partner(s) who own the engagement. Was `prepared_with` historically; renamed for clarity (stint 43.D11). TEXT[] of short names that match tax_team_members.short_name.';

COMMENT ON COLUMN tax_filings.associates_working IS
  'Associate(s) doing the prep work. New in stint 43.D11. TEXT[] of short names that match tax_team_members.short_name.';

-- Note: no tax_audit_log entry — that table is on the roadmap but not yet
-- created. Migration counts at apply time: 200 rows had prepared_with set,
-- all 200 backfilled into partner_in_charge.
