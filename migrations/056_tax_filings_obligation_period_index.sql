-- ════════════════════════════════════════════════════════════════════════
-- Migration 056 — Composite index on tax_filings(obligation_id, period_label)
--
-- Stint 42.F. Post-stint-40 performance audit found the matrix API
-- hot-path query:
--     WHERE obligation_id = ANY($1::text[])
--       AND period_label  = ANY($2::text[])
-- only has a single-column index on obligation_id (idx_tax_filings_obligation
-- from migration 045). With 228 filings today the query is instant, but once
-- the table crosses ~2000 rows the planner will start scanning. A composite
-- btree index on (obligation_id, period_label) lets both ANY() filters use
-- the same index lookup.
--
-- Idempotent: IF NOT EXISTS.
-- Reversible: DROP INDEX idx_tax_filings_obligation_period.
-- ════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_tax_filings_obligation_period
  ON tax_filings (obligation_id, period_label);
