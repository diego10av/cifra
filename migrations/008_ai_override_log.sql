-- ════════════════════════════════════════════════════════════════════════
-- 008_ai_override_log.sql
--
-- Adds the pieces needed for cifra's "AI-override audit trail" — the
-- compliance story VAT professionals care about: cifra is the tool,
-- YOU are the professional, and every time you disagree with the AI
-- we log it as evidence.
--
-- Schema changes:
--
--   1. invoice_lines.ai_suggested_treatment
--      The treatment the classifier FIRST suggested for this line.
--      Frozen the moment it's first set — subsequent re-classifications
--      or manual overrides never rewrite this value. This is the
--      "left side" of every override event in the UI timeline.
--
--   2. invoice_lines.ai_suggested_rule
--      The RULE id the classifier cited when it made that first
--      suggestion (e.g. "RULE 4" for EU intra-community services).
--      Rendered next to the suggestion so the reviewer sees *why*
--      cifra said what it said.
--
--   3. audit_log.reason
--      Free-text reason captured when the user makes an override. The
--      UI will optionally prompt for it ("tell future-you why you
--      changed this"). Not required — an override without a reason
--      is still logged, just with reason=NULL.
--
-- Backfill:
--
--   For existing rows where `treatment_source IN ('classifier',
--   'ai_suggested', 'learned')`, the current `treatment` IS what the
--   AI suggested (because no human has overridden it yet), so we
--   populate ai_suggested_treatment from that. Rows already with
--   `treatment_source='manual'` have lost the original AI opinion
--   forever — we leave their ai_suggested_treatment NULL, and the UI
--   renders "AI suggestion: —" for those lines.
--
-- Also: an index on audit_log(declaration_id, created_at) so the new
-- "audit log for this declaration" endpoint is fast even with thousands
-- of events.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE invoice_lines
  ADD COLUMN IF NOT EXISTS ai_suggested_treatment TEXT,
  ADD COLUMN IF NOT EXISTS ai_suggested_rule TEXT;

-- Backfill from current state. Conservative: only where we're sure the
-- current treatment came from the classifier (not a manual decision).
-- The actual treatment_source values used by src/config/classification-
-- rules.ts are: 'rule' | 'precedent' | 'inference' | 'override' | 'manual'.
-- 'manual' is the only one that means "user decided" — we exclude it.
UPDATE invoice_lines
   SET ai_suggested_treatment = treatment,
       ai_suggested_rule = classification_rule
 WHERE treatment_source IN ('rule', 'precedent', 'inference', 'override')
   AND ai_suggested_treatment IS NULL
   AND treatment IS NOT NULL;

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS reason TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_log_decl_time
  ON audit_log (declaration_id, created_at DESC)
  WHERE declaration_id IS NOT NULL;
