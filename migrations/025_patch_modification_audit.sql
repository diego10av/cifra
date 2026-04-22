-- 025_patch_modification_audit — persist human edits to AI-drafted patches.
--
-- When the reviewer clicks "Modificar" on an AI-proposed rule patch, they
-- edit the diff in a textarea and save. We preserve the ORIGINAL drafter
-- output in ai_patch_original_diff so the audit trail can diff AI-proposal
-- vs human-final, and stamp who/when on the edit.
--
-- The accept-patch endpoint reads ai_patch_modified_by_human to append
-- `human_edited: true` to the commit-message trailer, making it trivial
-- to split AI-pure commits from human-edited ones via `git log --grep`.
--
-- Idempotent: all columns ADD IF NOT EXISTS.

ALTER TABLE legal_watch_queue
  ADD COLUMN IF NOT EXISTS ai_patch_modified_by_human boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_patch_modified_at       timestamptz,
  ADD COLUMN IF NOT EXISTS ai_patch_modified_by       text,
  ADD COLUMN IF NOT EXISTS ai_patch_original_diff     text;

COMMENT ON COLUMN legal_watch_queue.ai_patch_modified_by_human IS
  'True when the reviewer edited ai_patch_diff via the Modificar button before accepting. Flows to the commit-message trailer (`human_edited: true`).';
COMMENT ON COLUMN legal_watch_queue.ai_patch_original_diff IS
  'Preserved copy of the Opus 4.7 drafter output, captured the first time the diff was edited. NULL when the reviewer accepted the AI proposal as-is.';
