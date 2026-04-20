-- ═══════════════════════════════════════════════════════════════════════
-- Migration 014 · Persist classifier reason text on invoice_lines.
--
-- Gassner audit item #8 (stint 12, 2026-04-19): the classifier's
-- reason string carries the LTVA article + CJEU case + AED circular
-- citation for every classification decision. Today it's computed
-- on the fly and thrown away. Persisting it lets the Review-table
-- TreatmentBadge tooltip render the full legal trail on hover
-- without re-running the classifier — and lets the audit trail PDF
-- include it per line.
--
-- No backfill: the column fills on next re-classification. Existing
-- rows read as NULL and fall back to flag_reason + treatment label
-- in the UI.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS classification_reason TEXT;
