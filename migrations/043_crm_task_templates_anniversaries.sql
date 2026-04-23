-- ════════════════════════════════════════════════════════════════════════
-- Migration 043 — Task templates + anniversaries + meeting prep (Fase 5.3)
--
-- Three related additions that close out the intelligence layer of
-- the CRM rebuild:
--
-- 1. crm_task_templates — named sets of task definitions that can
--    be applied in one click to any target record (matter, contact,
--    company). Pre-seeds 3 templates covering the most common
--    "I forget to do these 5 things every time" moments.
-- 2. crm_contacts.birthday + .client_anniversary — dates used by
--    the weekly anniversary cron to surface upcoming milestones.
-- 3. crm_contacts.last_brief_generated_at — timestamp gated so we
--    don't regenerate the same brief twice within 24h.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Task templates ---------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_task_templates (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  scope        TEXT NOT NULL,           -- 'matter' | 'contact' | 'company' | 'any'
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of {title, description?, due_offset_days, priority}
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_task_templates_scope ON crm_task_templates(scope);

COMMENT ON TABLE crm_task_templates IS 'Named task bundles applied in one click. Items carry due_offset_days (days from apply) and priority. Scope limits which detail page the Apply button appears on.';

-- Seed 3 canonical templates.
INSERT INTO crm_task_templates (id, name, description, scope, items)
VALUES
  ('tpl_client_onboarding',
   'New client onboarding',
   'Standard 7-step onboarding after a new client signs their engagement letter.',
   'company',
   '[
     {"title":"Send welcome email + firm introduction pack","due_offset_days":1,"priority":"high"},
     {"title":"Set up secure document-sharing folder","due_offset_days":1,"priority":"high"},
     {"title":"Schedule kickoff call with primary contact","due_offset_days":3,"priority":"high"},
     {"title":"Add billing contact + payment terms","due_offset_days":3,"priority":"medium"},
     {"title":"Request KYC / CDD documentation","due_offset_days":5,"priority":"medium"},
     {"title":"Confirm VAT + matricule on file","due_offset_days":7,"priority":"medium"},
     {"title":"30-day check-in call","due_offset_days":30,"priority":"low"}
   ]'::jsonb),

  ('tpl_matter_closing',
   'Matter closing — 7 canonical steps',
   'Mirrors the closing checklist. Use this on a matter when it is time to wind down.',
   'matter',
   '[
     {"title":"Final conflict check (confirm no new parties)","due_offset_days":2,"priority":"medium"},
     {"title":"Archive engagement letter to matter folder","due_offset_days":3,"priority":"medium"},
     {"title":"Draft + send closing letter to client","due_offset_days":5,"priority":"high"},
     {"title":"Issue final invoice","due_offset_days":7,"priority":"high"},
     {"title":"Archive working files + research","due_offset_days":10,"priority":"medium"},
     {"title":"Save research artifacts to the firm library","due_offset_days":10,"priority":"low"},
     {"title":"Reconcile time entries + disbursements","due_offset_days":12,"priority":"medium"}
   ]'::jsonb),

  ('tpl_ma_deal_kickoff',
   'M&A deal kickoff',
   'Opening a new M&A transaction. Tracks the first 2 weeks of groundwork.',
   'matter',
   '[
     {"title":"Set up data room access","due_offset_days":1,"priority":"high"},
     {"title":"Circulate working group list + roles","due_offset_days":2,"priority":"high"},
     {"title":"Confirm fee structure + cap with client","due_offset_days":2,"priority":"high"},
     {"title":"Review NDA vs target — request additions","due_offset_days":4,"priority":"medium"},
     {"title":"Begin due-diligence request list","due_offset_days":5,"priority":"high"},
     {"title":"Schedule weekly status call with client","due_offset_days":7,"priority":"medium"},
     {"title":"Deliver preliminary legal due-diligence memo","due_offset_days":14,"priority":"high"}
   ]'::jsonb)
ON CONFLICT (id) DO NOTHING;


-- 2. Contact anniversaries --------------------------------------------

ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS birthday              DATE,
  ADD COLUMN IF NOT EXISTS client_anniversary    DATE,
  ADD COLUMN IF NOT EXISTS last_brief_generated_at TIMESTAMPTZ;

COMMENT ON COLUMN crm_contacts.birthday IS 'Birthday (YYYY-MM-DD — year is used as placeholder; month/day are what we query). NULL for contacts who haven''t shared.';
COMMENT ON COLUMN crm_contacts.client_anniversary IS 'Date the relationship began (first engagement letter, first matter, etc.). Surfaces in weekly reminders.';


-- verification
--   SELECT id, name, scope, jsonb_array_length(items) AS item_count FROM crm_task_templates ORDER BY id;
--   -> 3 rows
