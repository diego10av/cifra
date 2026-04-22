-- Migration 024 — legal_watch_queue AI patch columns (rule-patch-drafter)
--
-- Diego 2026-04-22: "no podrías actualizar tú las reglas de manera
-- automática?" — yes, with a 2-click human review. When the AI
-- triage marks a queue item as severity high/critical + affected rules
-- non-empty + confidence ≥ 0.7, an Opus 4.7 "rule-patch-drafter"
-- reads the full baseline (classification-rules.ts, legal-sources.ts,
-- exemption-keywords.ts, classification-research.md) and drafts the
-- actual code diff needed to incorporate the new legal development.
--
-- The diff is stored here; the UI renders it in the queue card with
-- Accept / Modify / Reject buttons. Accept applies the diff as a
-- new commit (follow-up stint will wire this; MVP shows the diff +
-- copy-the-command affordance).
--
-- Idempotent.

BEGIN;

ALTER TABLE legal_watch_queue
  ADD COLUMN IF NOT EXISTS ai_patch_diff          text,
  ADD COLUMN IF NOT EXISTS ai_patch_target_files  text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_patch_reasoning     text,
  ADD COLUMN IF NOT EXISTS ai_patch_confidence    numeric(3, 2),
  ADD COLUMN IF NOT EXISTS ai_patch_model         text,
  ADD COLUMN IF NOT EXISTS ai_patch_generated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS ai_patch_tests_pass    boolean,
  ADD COLUMN IF NOT EXISTS ai_patch_tests_output  text,
  ADD COLUMN IF NOT EXISTS patch_applied_at       timestamptz,
  ADD COLUMN IF NOT EXISTS patch_applied_by       text,
  ADD COLUMN IF NOT EXISTS patch_commit_sha       text;

-- Index so the UI can surface "has a pending patch proposal" cheaply.
CREATE INDEX IF NOT EXISTS legal_watch_queue_has_patch_idx
  ON legal_watch_queue((ai_patch_diff IS NOT NULL))
  WHERE ai_patch_diff IS NOT NULL;

COMMIT;
