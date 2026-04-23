-- ════════════════════════════════════════════════════════════════════════
-- Migration 042 — Automation rules (Fase 5.2)
--
-- A lightweight rules engine. Each row is a trigger + conditions +
-- actions. The runner (src/lib/crm-automation.ts) is called from the
-- relevant mutation handlers (opp stage change, invoice status
-- change, etc.) and fires matching enabled rules.
--
-- Starts with 3 pre-seeded rules covering the most common
-- "I keep forgetting to do this" moments in the Notion workflow:
--
--   1. Proposal sent → follow-up task in 5 days
--   2. Opp won → create matter-opening checklist task
--   3. Invoice sent → schedule a "confirm receipt" task for tomorrow
--
-- Users can disable any of these (UI toggle) and edit the params.
-- Creating custom rules from the UI is a future-polish; for now we
-- keep the table open for direct inserts.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_automation_rules (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  trigger_event   TEXT NOT NULL,      -- opportunity_stage_changed / invoice_status_changed / task_completed / matter_created
  trigger_params  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- e.g. {"to_stage": "proposal_sent"}
  action_type     TEXT NOT NULL,      -- create_task / change_field
  action_params   JSONB NOT NULL DEFAULT '{}'::jsonb,   -- e.g. {"task_title_template": "Follow up on {opp_name}", "due_in_days": 5, "priority": "medium"}
  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_fired_at   TIMESTAMPTZ,
  fire_count      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_crm_automation_rules_trigger
  ON crm_automation_rules(trigger_event) WHERE enabled = TRUE;

-- Pre-seed 3 canonical rules. Use ON CONFLICT DO NOTHING so re-running
-- is safe and doesn't overwrite user customisations.
INSERT INTO crm_automation_rules (id, name, description, trigger_event, trigger_params, action_type, action_params)
VALUES
  ('auto_proposal_followup',
   'Proposal sent → follow up in 5 days',
   'When an opportunity moves into the proposal_sent stage, schedule a follow-up task.',
   'opportunity_stage_changed',
   '{"to_stage":"proposal_sent"}'::jsonb,
   'create_task',
   '{"task_title_template":"Follow up on proposal: {opp_name}","due_in_days":5,"priority":"medium"}'::jsonb),

  ('auto_won_matter_open',
   'Opp won → open the matter',
   'When an opportunity is won, create a high-priority task to formally open the matter (engagement letter, conflict check, team assignment).',
   'opportunity_stage_changed',
   '{"to_stage":"won"}'::jsonb,
   'create_task',
   '{"task_title_template":"Open matter for won opp: {opp_name}","due_in_days":2,"priority":"high"}'::jsonb),

  ('auto_invoice_sent_confirm',
   'Invoice sent → confirm receipt tomorrow',
   'When an invoice moves to sent, schedule a quick task to confirm the client received it.',
   'invoice_status_changed',
   '{"to_status":"sent"}'::jsonb,
   'create_task',
   '{"task_title_template":"Confirm receipt of invoice {invoice_number}","due_in_days":1,"priority":"low"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- verification
--   SELECT id, name, trigger_event, enabled FROM crm_automation_rules ORDER BY id;
--   -> 3 rows
