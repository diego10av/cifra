-- ════════════════════════════════════════════════════════════════════════
-- Migration 059 — `last_action_at` on tax_filings (stint 43.D6)
--
-- Diego: "Last Chase no me pega como nombre, porque tiene que ser en plan
-- de cuándo ha sido la última vez que se ha tomado una acción. Si es
-- cuándo le pedí información... si es file, pues que cuando la he
-- depositado."
--
-- Renames the semantic of the existing field. Old: `last_info_request_sent_at`
-- = the date Diego last chased the CSP for info. New: `last_action_at` =
-- the date of the latest action taken on the filing (status change,
-- comment edit, contacts update, etc.).
--
-- Implementation: add `last_action_at DATE` (NEW). Backfill from
-- `last_info_request_sent_at` (preserves Diego's existing data) AND
-- from updated_at where last_info_request_sent_at is null. The old
-- column stays for now (don't break older audit-log entries that
-- reference it); future migration can drop it after a grace period.
--
-- Auto-stamp lives in API code: every PATCH on tax_filings (status,
-- comments, prepared_with, etc.) sets last_action_at = CURRENT_DATE
-- unless the patch explicitly provides a value.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE tax_filings
  ADD COLUMN IF NOT EXISTS last_action_at DATE;

-- Backfill: prefer the existing chase-date if set, else the row's
-- updated_at. This preserves the most actionable signal Diego had.
UPDATE tax_filings
   SET last_action_at = COALESCE(last_info_request_sent_at, updated_at::date)
 WHERE last_action_at IS NULL;

COMMENT ON COLUMN tax_filings.last_action_at IS
  'Date of the most recent action on the filing (status change, comment edit, contacts update, info chase, etc.). Auto-stamped server-side on every PATCH unless the request provides an explicit value. Diego can override manually.';
