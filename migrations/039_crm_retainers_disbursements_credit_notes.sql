-- ════════════════════════════════════════════════════════════════════════
-- Migration 039 — Retainers, disbursements, credit notes (Fase 4.2)
--
-- Three inter-related additions to the billing layer:
--
-- 1. crm_retainer_topups — top-up events against a client (or a
--    specific matter). Balance is derived as SUM(topup amounts) −
--    SUM(drawdowns). We store each top-up as an immutable row for a
--    full audit trail ("why is the balance €7k? oh, €10k top-up in
--    Feb + €3k drawn down by invoice MP-2026-0011").
-- 2. crm_disbursements — out-of-pocket costs (court fees, translator,
--    notary, travel). Flagged billable / non-billable. When billable
--    and not yet billed, the next invoice can auto-include them.
-- 3. Credit notes — extend crm_billing_invoices with
--    original_invoice_id (self-FK) and allow status='credit_note'.
--    Credit notes carry negative amounts that cancel (fully or
--    partly) a previously issued invoice.
--
-- All idempotent. Rollback: DROP the two new tables + DROP column
-- original_invoice_id (after migrating any credit-note rows).
-- ════════════════════════════════════════════════════════════════════════

-- 1. Retainer top-ups + drawdowns --------------------------------------

CREATE TABLE IF NOT EXISTS crm_retainer_topups (
  id              TEXT PRIMARY KEY,
  company_id      TEXT NOT NULL REFERENCES crm_companies(id) ON DELETE CASCADE,
  matter_id       TEXT REFERENCES crm_matters(id) ON DELETE SET NULL,   -- NULL = firm-wide / client-wide retainer
  amount_eur      NUMERIC(12,2) NOT NULL,
  topup_date      DATE NOT NULL,
  reference       TEXT,                -- bank ref / invoice ref that triggered the top-up
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      TEXT,
  CONSTRAINT crm_retainer_topups_amount_nonzero CHECK (amount_eur <> 0)
);

CREATE INDEX IF NOT EXISTS idx_crm_retainer_topups_company ON crm_retainer_topups(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_retainer_topups_matter  ON crm_retainer_topups(matter_id);
CREATE INDEX IF NOT EXISTS idx_crm_retainer_topups_date    ON crm_retainer_topups(topup_date DESC);

COMMENT ON TABLE crm_retainer_topups IS 'Immutable ledger of client retainer top-ups. Positive amounts = top-up; negative = manual adjustment / refund. Drawdowns come from crm_billing_invoices.drawn_from_retainer_eur, not this table.';

-- Drawdown pointer on invoices: how much of this invoice was paid
-- from the retainer (as opposed to requiring a separate payment).
ALTER TABLE crm_billing_invoices
  ADD COLUMN IF NOT EXISTS drawn_from_retainer_eur NUMERIC(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN crm_billing_invoices.drawn_from_retainer_eur IS 'Portion of the invoice that was settled by deducting from the client retainer balance. Can be partial (invoice €5k, retainer covers €3k, €2k still due).';


-- 2. Disbursements -----------------------------------------------------

CREATE TABLE IF NOT EXISTS crm_disbursements (
  id                    TEXT PRIMARY KEY,
  matter_id             TEXT NOT NULL REFERENCES crm_matters(id) ON DELETE CASCADE,
  disbursement_date     DATE NOT NULL,
  description           TEXT NOT NULL,
  amount_eur            NUMERIC(10,2) NOT NULL CHECK (amount_eur > 0),
  currency              TEXT NOT NULL DEFAULT 'EUR',
  billable              BOOLEAN NOT NULL DEFAULT TRUE,
  billed_on_invoice_id  TEXT REFERENCES crm_billing_invoices(id) ON DELETE SET NULL,
  category              TEXT,           -- court_fee / notary / translator / travel / expert / other
  receipt_url           TEXT,           -- link to receipt PDF / image (SharePoint / Drive)
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by            TEXT
);

CREATE INDEX IF NOT EXISTS idx_crm_disbursements_matter     ON crm_disbursements(matter_id);
CREATE INDEX IF NOT EXISTS idx_crm_disbursements_unbilled   ON crm_disbursements(matter_id) WHERE billed_on_invoice_id IS NULL AND billable = TRUE;
CREATE INDEX IF NOT EXISTS idx_crm_disbursements_invoice    ON crm_disbursements(billed_on_invoice_id);


-- 3. Credit notes ------------------------------------------------------

ALTER TABLE crm_billing_invoices
  ADD COLUMN IF NOT EXISTS original_invoice_id TEXT REFERENCES crm_billing_invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN crm_billing_invoices.original_invoice_id IS 'For credit notes (status = credit_note), points at the invoice being cancelled. NULL for regular invoices.';

CREATE INDEX IF NOT EXISTS idx_crm_invoices_credit_note
  ON crm_billing_invoices(original_invoice_id) WHERE original_invoice_id IS NOT NULL;


-- verification
--   SELECT table_name FROM information_schema.tables WHERE table_name IN ('crm_retainer_topups','crm_disbursements');
--   SELECT column_name FROM information_schema.columns WHERE table_name='crm_billing_invoices' AND column_name IN ('drawn_from_retainer_eur','original_invoice_id');
