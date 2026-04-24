-- ════════════════════════════════════════════════════════════════════════
-- Migration 049 — /crm/outreach prospects tracker (stint 37.J)
--
-- Diego asked for a pestaña bajo CRM para plan de captación — lista de
-- prospectos de gestoras de fondos alternativos. MVP schema: enough to
-- track pipeline stages without reinventing HubSpot. GTM playbook doc
-- lives at docs/go-to-market-alt-fund-managers.md (stint 38.B).
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_outreach_prospects (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  firm_type           TEXT,
  company_name        TEXT,
  contact_linkedin_url TEXT,
  contact_email       TEXT,
  stage               TEXT NOT NULL DEFAULT 'identified',
  next_action         TEXT,
  next_action_date    DATE,
  notes               TEXT,
  source              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by          TEXT DEFAULT 'founder'
);

CREATE INDEX IF NOT EXISTS idx_crm_outreach_stage ON crm_outreach_prospects(stage);
CREATE INDEX IF NOT EXISTS idx_crm_outreach_next  ON crm_outreach_prospects(next_action_date)
  WHERE next_action_date IS NOT NULL AND stage NOT IN ('won','lost');

COMMENT ON COLUMN crm_outreach_prospects.firm_type IS
  'fondo | boutique | big4 | fiduciary | in_house | other';
COMMENT ON COLUMN crm_outreach_prospects.stage IS
  'identified | warm | first_touch | meeting_booked | proposal | won | lost';
COMMENT ON COLUMN crm_outreach_prospects.source IS
  'event | referral | linkedin | cold_email | other';

-- Audit row
INSERT INTO audit_log (id, user_id, action, target_type, target_id, new_value)
VALUES (
  gen_random_uuid()::text, 'migration_049',
  'crm_outreach_prospects_created',
  'crm_outreach_prospects', 'batch_049',
  jsonb_build_object('migration', '049', 'description', 'Created prospects tracker table for /crm/outreach MVP.')::text
);
