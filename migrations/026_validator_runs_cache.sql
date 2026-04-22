-- 026_validator_runs_cache — persist validator run summaries so a
-- re-open of the same declaration (no edits since last run) skips the
-- €0.05-0.15 Opus call and serves the cached result.
--
-- Without this table, runValidator was essentially memoryless: each
-- "Second opinion" click cost money even if the lines were byte-
-- identical to the previous run. In practice a reviewer re-opens a
-- declaration many times as they move between tabs, which turned into
-- real budget drain on the €75/mo cap.
--
-- Cache key: (declaration_id, lines_hash, ai_model). lines_hash is a
-- SHA-256 over the line fields that actually affect the validator's
-- reasoning: line_id, treatment, amount_eur, vat_applied, description,
-- classification_rule, flag, exemption_reference, invoice direction.
--
-- Invalidation:
--   - Any edit that changes one of those fields bumps the hash → miss.
--   - Classifier model bump bumps ai_model → miss.
--   - TTL: 7 days (CACHE_TTL_DAYS in validator.ts). Beyond that we
--     re-run even if nothing changed, so a shipped RULE upgrade
--     doesn't get hidden forever by an old cached "no findings".
--
-- Idempotent: ALL DDL uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS validator_runs (
  id                text PRIMARY KEY,
  declaration_id    text NOT NULL REFERENCES declarations(id) ON DELETE CASCADE,
  lines_hash        text NOT NULL,
  ai_model          text NOT NULL,
  findings_count    integer NOT NULL DEFAULT 0,
  by_severity       jsonb NOT NULL DEFAULT '{}'::jsonb,
  skipped_batches   integer NOT NULL DEFAULT 0,
  model_errors      text[] NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validator_runs_cache_lookup
  ON validator_runs (declaration_id, lines_hash, ai_model, created_at DESC);

COMMENT ON TABLE validator_runs IS
  'Validator run summaries. Used for cache-hit detection on Second Opinion — skips the Opus call when declaration+lines have not changed since the last run.';
COMMENT ON COLUMN validator_runs.lines_hash IS
  'SHA-256 hex of the sorted line inputs that affect validator reasoning. Mismatch → cache miss → fresh Opus call.';
