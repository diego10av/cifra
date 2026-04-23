-- ════════════════════════════════════════════════════════════════════════
-- Migration 040 — Invoice FX + approval workflow + reminders (Fase 4.3)
--
-- Three billing additions:
--
-- 1. Multi-currency support. Store the ECB reference rate at the
--    invoice issue date so downstream aggregations (dashboards,
--    top-clients, YoY reports) can convert to EUR using a stable
--    snapshot — not today's live rate, which would retroactively
--    shift historical figures.
--
-- 2. Two-person approval gate. Firms can optionally require that
--    invoices above a threshold (e.g. €10k) be signed off before
--    they transition from draft → sent. Gate is enforced server-
--    side in the billing PUT handler.
--
-- 3. Reminder cadence. Track when we last nudged the client for
--    this invoice so the daily scheduled reminder task can avoid
--    creating duplicate follow-up tasks.
-- ════════════════════════════════════════════════════════════════════════

-- 1. FX fields on invoices --------------------------------------------

ALTER TABLE crm_billing_invoices
  ADD COLUMN IF NOT EXISTS fx_rate_at_issue      NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS fx_currency_at_issue  TEXT;

COMMENT ON COLUMN crm_billing_invoices.fx_rate_at_issue IS 'ECB reference rate per 1 EUR on the issue date. E.g. GBP = 0.840000 means 1 EUR = 0.84 GBP. NULL for EUR invoices (rate = 1).';
COMMENT ON COLUMN crm_billing_invoices.fx_currency_at_issue IS 'Snapshot of currency used for the fx_rate_at_issue fetch. Defensive — usually equals `currency`, but held separately in case an invoice is restated later.';


-- 2. Approval workflow ------------------------------------------------

ALTER TABLE crm_billing_invoices
  ADD COLUMN IF NOT EXISTS approved_by  TEXT,
  ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ;

COMMENT ON COLUMN crm_billing_invoices.approved_by IS 'User who approved the invoice (when firm-settings.require_approval_above_eur is set). NULL = not yet approved.';

ALTER TABLE crm_firm_settings
  ADD COLUMN IF NOT EXISTS require_approval_above_eur NUMERIC(12,2);

COMMENT ON COLUMN crm_firm_settings.require_approval_above_eur IS 'Optional threshold: invoices with amount_incl_vat above this require approval_by before status can become sent/paid. NULL = no approval required.';


-- 3. Reminder cadence -------------------------------------------------

ALTER TABLE crm_billing_invoices
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reminder_kind    TEXT;   -- friendly / overdue / escalated

COMMENT ON COLUMN crm_billing_invoices.last_reminder_sent_at IS 'Timestamp of the most recent reminder task auto-created for this invoice. Guards the daily cron from creating duplicate tasks for the same invoice.';
COMMENT ON COLUMN crm_billing_invoices.last_reminder_kind IS 'friendly (3d before due) | overdue (7d past due) | escalated (30d past due).';


-- verification
--   SELECT column_name FROM information_schema.columns WHERE table_name='crm_billing_invoices'
--     AND column_name IN ('fx_rate_at_issue','fx_currency_at_issue','approved_by','approved_at','last_reminder_sent_at','last_reminder_kind');
--   -> 6 rows
