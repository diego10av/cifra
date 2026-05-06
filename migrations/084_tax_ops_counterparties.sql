-- ════════════════════════════════════════════════════════════════════════
-- Migration 084 — Tax-Ops counterparties (stint 84)
--
-- Diego dogfood revealed the first M&A engagement: a debt-assignment +
-- cancellation transaction with five workstreams running in parallel
-- against four counterparties (Swiss tax counsel, Lux CSP, internal
-- mercantil team, client CFO). The existing `assignee` text column on
-- tax_ops_tasks treats them all as a free-text label — useful when the
-- task is pending an internal owner, useless when the reviewer needs
-- to "chase Müller in Zurich" or see at a glance who is responsible
-- for which workstream.
--
-- This migration adds:
--   1. tax_ops_counterparties      — directory of stakeholders Diego
--                                    works with across engagements.
--                                    Reusable across tasks.
--   2. tax_ops_task_counterparties — link table assigning counterparties
--                                    to a task with a role
--                                    (responsible / reviewer / informed).
--
-- Why a NEW table instead of reusing csp_contacts (the JSONB-on-filings
-- model the VAT module uses):
--   - csp_contacts attaches contacts to a tax filing (the operational
--     side). Counterparties attach to a transaction/task workflow (the
--     project-management side). Different lifecycle, different shape.
--   - Rule §14 (module independence) — counterparties live entirely
--     inside Tax-Ops and don't bleed into VAT or CRM. A human who is
--     both a CSP filing-contact AND a transaction counterparty is
--     entered twice (manual duplication accepted).
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. Directory ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_ops_counterparties (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,                       -- "Müller & Partners (Zurich)"
  organization  TEXT,                                 -- "Müller & Partners"
  contact_name  TEXT,                                 -- "Hans Müller"
  contact_email TEXT,
  contact_phone TEXT,
  jurisdiction  TEXT,                                 -- ISO-3166-1 alpha-2 ("CH")
  role          TEXT,                                 -- see comment below
  side          TEXT NOT NULL DEFAULT 'external',     -- 'internal' | 'external'
  notes         TEXT,
  archived_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN tax_ops_counterparties.role IS
  'tax_counsel | corporate_counsel | csp | auditor | notary | bank | '
  'internal_tax | internal_corporate | internal_admin | client_contact | other';

COMMENT ON COLUMN tax_ops_counterparties.side IS
  '"internal" = own firm (mercantil team, internal tax). '
  '"external" = third party (foreign counsel, CSP, client). Drives chase semantics.';

CREATE INDEX IF NOT EXISTS idx_counterparties_active
  ON tax_ops_counterparties (display_name) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_counterparties_role
  ON tax_ops_counterparties (role) WHERE archived_at IS NULL;

-- ─── 2. Link table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tax_ops_task_counterparties (
  task_id          TEXT NOT NULL REFERENCES tax_ops_tasks(id) ON DELETE CASCADE,
  counterparty_id  TEXT NOT NULL REFERENCES tax_ops_counterparties(id) ON DELETE RESTRICT,
  role_in_task     TEXT,                              -- 'responsible' | 'reviewer' | 'informed'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, counterparty_id)
);

COMMENT ON COLUMN tax_ops_task_counterparties.role_in_task IS
  '"responsible" = the one to chase / has the deliverable. '
  '"reviewer" = sign-off path. '
  '"informed" = stakeholder kept in the loop, no action expected.';

CREATE INDEX IF NOT EXISTS idx_task_counterparty_lookup
  ON tax_ops_task_counterparties (counterparty_id);

-- ─── 3. RLS — same policy as the rest of Tax-Ops ──────────────────────
-- Single-user workspace; service_role bypasses, anon/authenticated
-- denied. No cross-org leakage possible because this is a single-tenant
-- DB after the 2026-05-05 reset.

ALTER TABLE tax_ops_counterparties      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_ops_task_counterparties ENABLE ROW LEVEL SECURITY;

-- (No additional policies — default deny + BYPASSRLS on service_role
-- inherited from migration 006 covers reads/writes.)
