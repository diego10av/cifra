-- ═══════════════════════════════════════════════════════════════════════
-- Migration 003 · app_logs table.
--
-- Persists error / warn records from the structured logger so Diego can
-- browse recent failures without squinting at Vercel's log drawer.
--
-- Only error + warn levels are persisted (see logger.ts). info + debug
-- stay in stdout for the live tail; persisting them would balloon the
-- table for low value.
--
-- Retention: rows are meant to be rotated. Add a cron job to DELETE
-- older than 30 days when we care. Not automated at bootstrap.
--
-- IDEMPOTENT. Safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS app_logs (
  id          TEXT PRIMARY KEY,
  level       TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
  module      TEXT,
  msg         TEXT NOT NULL,
  -- Structured fields as JSONB for flexible querying. Size-bounded at
  -- write time (logger truncates overly large payloads).
  fields      JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Error introspection (only present for level = error).
  err_name    TEXT,
  err_message TEXT,
  err_stack   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hot path for the admin screen: "what went wrong recently?"
CREATE INDEX IF NOT EXISTS idx_app_logs_created
  ON app_logs(created_at DESC);

-- Filter by level + time for "errors in the last hour" drilldown.
CREATE INDEX IF NOT EXISTS idx_app_logs_level_created
  ON app_logs(level, created_at DESC);

-- Filter by module for "what did agents/extract log yesterday?"
CREATE INDEX IF NOT EXISTS idx_app_logs_module_created
  ON app_logs(module, created_at DESC)
  WHERE module IS NOT NULL;

COMMIT;

-- ───────────────────────── retention cron (suggested) ─────────────────
-- When we're ready, add a Supabase scheduled function that does:
--   DELETE FROM app_logs WHERE created_at < NOW() - INTERVAL '30 days';
-- For now this is manual.
