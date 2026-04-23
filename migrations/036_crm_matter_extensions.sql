-- ════════════════════════════════════════════════════════════════════════
-- Migration 036 — CRM matter extensions (Fase 3 of the CRM rebuild)
--
-- Catch-up migration that consolidates four Fase-3 schema changes that
-- were applied directly to prod via the Supabase MCP during stints
-- 28.A / 28.B / 28.C before we got around to filing them here. All
-- statements are IF NOT EXISTS, so running this against prod is a no-op
-- and running it against a fresh clone catches the clone up.
--
-- Additions:
--   1. crm_matters: estimated_budget_eur, cap_eur, counterparty_name,
--      related_parties[], conflict_check_result JSONB
--   2. crm_time_entries: per-matter time log with rate override + billable
--   3. crm_matter_documents: URL-based document references (SharePoint /
--      iManage / Drive) — not file storage; we store a URL + filename.
--   4. crm_matter_closing_steps: 7 canonical steps lazy-populated on
--      first GET; matter.status='closed' is blocked until all checked.
--
-- Rollback: drop the three new tables + drop the five new matter
-- columns. Not trivially reversible if data exists — think before.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Matter budget + parties + conflict-check result -----------------

ALTER TABLE crm_matters
  ADD COLUMN IF NOT EXISTS estimated_budget_eur  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cap_eur               NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS counterparty_name     TEXT,
  ADD COLUMN IF NOT EXISTS related_parties       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS conflict_check_result JSONB;

COMMENT ON COLUMN crm_matters.estimated_budget_eur IS 'Agreed budget with client; used by MatterTimeTracker burn bar.';
COMMENT ON COLUMN crm_matters.cap_eur IS 'Hard ceiling beyond which client re-approval is required. Warning at 90%.';
COMMENT ON COLUMN crm_matters.counterparty_name IS 'Free-text: the other side for conflict-check purposes.';
COMMENT ON COLUMN crm_matters.related_parties IS 'Additional parties (funds, targets, advisors) scanned in conflict-check.';
COMMENT ON COLUMN crm_matters.conflict_check_result IS 'Latest scan output: { checked_at, hits[], false_positive_ids[] }.';


-- 2. crm_time_entries ------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_time_entries (
  id                    TEXT PRIMARY KEY,
  matter_id             TEXT NOT NULL REFERENCES crm_matters(id) ON DELETE CASCADE,
  user_id               TEXT,            -- free-text today (pre-multi-user); user id when we ship it
  activity_id           TEXT REFERENCES crm_activities(id) ON DELETE SET NULL,
  entry_date            DATE NOT NULL,
  hours                 NUMERIC(5,2) NOT NULL CHECK (hours > 0),
  rate_eur              NUMERIC(8,2),    -- NULL = use matter's hourly_rate_eur
  billable              BOOLEAN NOT NULL DEFAULT TRUE,
  billed_on_invoice_id  TEXT REFERENCES crm_billing_invoices(id) ON DELETE SET NULL,
  description           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_time_entries_matter    ON crm_time_entries(matter_id);
CREATE INDEX IF NOT EXISTS idx_crm_time_entries_unbilled  ON crm_time_entries(matter_id) WHERE billed_on_invoice_id IS NULL AND billable = TRUE;
CREATE INDEX IF NOT EXISTS idx_crm_time_entries_date      ON crm_time_entries(entry_date DESC);


-- 3. crm_matter_documents (URL references only) ----------------------

CREATE TABLE IF NOT EXISTS crm_matter_documents (
  id           TEXT PRIMARY KEY,
  matter_id    TEXT NOT NULL REFERENCES crm_matters(id) ON DELETE CASCADE,
  file_path    TEXT NOT NULL,        -- URL to SharePoint / iManage / Drive etc.
  filename     TEXT NOT NULL,
  kind         TEXT,                 -- engagement_letter / draft / signed_document / opinion / research / correspondence / other
  notes        TEXT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by  TEXT
);

CREATE INDEX IF NOT EXISTS idx_crm_matter_documents_matter ON crm_matter_documents(matter_id);


-- 4. crm_matter_closing_steps ----------------------------------------

CREATE TABLE IF NOT EXISTS crm_matter_closing_steps (
  matter_id     TEXT NOT NULL REFERENCES crm_matters(id) ON DELETE CASCADE,
  step_name     TEXT NOT NULL,        -- conflict_final_check / engagement_letter_archived / closing_letter_sent / final_invoice_sent / files_archived / research_saved / time_reconciled
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  completed_by  TEXT,
  notes         TEXT,
  PRIMARY KEY (matter_id, step_name)
);

CREATE INDEX IF NOT EXISTS idx_crm_matter_closing_steps_incomplete
  ON crm_matter_closing_steps(matter_id) WHERE completed = FALSE;


-- verification
--   SELECT COUNT(*) FROM information_schema.columns WHERE table_name='crm_matters' AND column_name IN ('estimated_budget_eur','cap_eur','counterparty_name','related_parties','conflict_check_result');
--   -> 5
--   SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('crm_time_entries','crm_matter_documents','crm_matter_closing_steps');
--   -> 3
