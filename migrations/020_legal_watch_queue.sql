-- Migration 020 — legal_watch_queue
--
-- Purpose: Close the loop on docs/classification-research.md §13
-- ("Legal-watch as a living system"). The principle from stint 16:
-- cifra's moat is *current* legal depth, not a point-in-time snapshot.
-- This table is the inbox for candidate jurisprudence / circulars /
-- AED notices auto-fetched by the scanner cron — the reviewer triages
-- and escalates relevant ones into src/config/legal-sources.ts.
--
-- Design:
--   - One row per (source, external_id) — uniqueness prevents the
--     scanner from re-inserting the same item on every run.
--   - status lifecycle: 'new' -> 'flagged' | 'dismissed' | 'escalated'.
--     'flagged' = reviewer wants to come back; 'escalated' = we added
--     a LegalSource entry + affected-rule flag.
--   - matched_keywords[] records which of our watchlist terms caused
--     the hit so the reviewer can judge relevance at a glance.
--   - No FK on triaged_by — we just store the user id string because
--     the lifecycle can span user departures.
--
-- Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS legal_watch_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source            TEXT NOT NULL,
  external_id       TEXT,
  title             TEXT NOT NULL,
  url               TEXT,
  summary           TEXT,
  published_at      TIMESTAMPTZ,
  matched_keywords  TEXT[] NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'flagged', 'dismissed', 'escalated')),
  triaged_at        TIMESTAMPTZ,
  triaged_by        TEXT,
  triage_note       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS legal_watch_queue_source_external_idx
  ON legal_watch_queue(source, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS legal_watch_queue_status_idx
  ON legal_watch_queue(status, created_at DESC);

CREATE INDEX IF NOT EXISTS legal_watch_queue_published_idx
  ON legal_watch_queue(published_at DESC NULLS LAST);

-- Touch trigger reuse (stint 6 helper).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'legal_watch_queue_touch'
  ) THEN
    CREATE TRIGGER legal_watch_queue_touch
      BEFORE UPDATE ON legal_watch_queue
      FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- RLS: follow the same pattern as every other public table — deny-all
-- for anon/authenticated, bypass via service_role.
ALTER TABLE legal_watch_queue ENABLE ROW LEVEL SECURITY;

COMMIT;
