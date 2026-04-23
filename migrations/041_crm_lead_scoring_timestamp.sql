-- ════════════════════════════════════════════════════════════════════════
-- Migration 041 — Lead scoring timestamp (Fase 5.1)
--
-- Adds crm_contacts.lead_score_updated_at so the monthly lead-scoring
-- cron can select oldest-scored-first and rotate through the full
-- cohort over time without thrashing the same contacts every run.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS lead_score_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN crm_contacts.lead_score_updated_at IS 'When the lead_score was last (re)computed. NULLS FIRST in ORDER BY lets the cron pick never-scored contacts before re-scoring stale ones.';

CREATE INDEX IF NOT EXISTS idx_crm_contacts_lead_scoring
  ON crm_contacts(lead_score_updated_at NULLS FIRST, created_at)
  WHERE deleted_at IS NULL AND lifecycle_stage IN ('lead', 'prospect');

-- verification
--   SELECT column_name FROM information_schema.columns WHERE table_name='crm_contacts' AND column_name='lead_score_updated_at';
