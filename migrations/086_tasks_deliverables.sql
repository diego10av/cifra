-- ════════════════════════════════════════════════════════════════════════
-- Migration 086 — Deliverables on tax-ops tasks (stint 84.C)
--
-- Diego dogfood feedback: when a workstream produces multiple documents
-- (SPA + Loan Assignment + Board Resolutions + Notarial deed for an
-- M&A engagement), listing them in title or description is an anti-
-- pattern — there's no per-document tracking of state, due date, or
-- where the doc actually lives.
--
-- Instead of a new table (Diego: "no quiero más tablas"), we add a
-- JSONB column to tax_ops_tasks. Each task carries its own list of
-- deliverables; status is manual only (cifra is not the doc store —
-- iManage etc. is) and adding/uploading anything never auto-bumps.
--
-- Item shape:
--   {
--     id:        string (uuid),
--     label:     string,
--     status:    'pending' | 'drafted' | 'reviewed' | 'signed' | 'filed' | 'na',
--     due_date:  ISO 'YYYY-MM-DD' | null,
--     link_url:  string | null,    -- iManage / Drive / Dropbox URL
--     notes:     string | null,
--     sort_order: int
--   }
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE tax_ops_tasks
  ADD COLUMN IF NOT EXISTS deliverables JSONB NOT NULL DEFAULT '[]'::jsonb;

-- GIN index so future queries like "all SPAs pending across my engagements"
-- can use jsonb operators without a full scan.
CREATE INDEX IF NOT EXISTS idx_tax_ops_tasks_deliverables_gin
  ON tax_ops_tasks USING GIN (deliverables);
