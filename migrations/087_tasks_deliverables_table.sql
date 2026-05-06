-- ════════════════════════════════════════════════════════════════════════
-- Migration 087 — Promote deliverables from JSONB column to its own table
--
-- Mig 086 stored deliverables as JSONB on tax_ops_tasks. After Diego
-- challenged me on it ("¿de verdad crees que sería mejor tener los
-- deliverables de manera separada pero al mismo tiempo vinculada?"),
-- I revised my answer: yes. Reasons:
--
-- 1. Cross-engagement queries (e.g. "deliverables due in next 14 days
--    across every engagement") collapse from jsonb_array_elements
--    contortions to one-line SQL.
-- 2. Audit trail per deliverable instead of "deliverables array changed".
-- 3. Concurrent-edit safety — JSONB full-replace blew away parallel
--    edits to different items.
-- 4. F3 stale alerts can index status + due_date directly.
-- 5. Future /tax-ops/deliverables page uses standard CRUD.
--
-- Migration is non-destructive: data in the JSONB column is unnested
-- into rows before the column is dropped.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tax_ops_task_deliverables (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL REFERENCES tax_ops_tasks(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
                -- 'pending' | 'drafted' | 'reviewed' | 'signed' | 'filed' | 'na'
  due_date      DATE,
  link_url      TEXT,             -- iManage / Drive / Dropbox URL (no upload here)
  notes         TEXT,
  sort_order    INT NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tod_task_id ON tax_ops_task_deliverables(task_id);
CREATE INDEX IF NOT EXISTS idx_tod_status_due
  ON tax_ops_task_deliverables(status, due_date)
  WHERE status NOT IN ('filed', 'na');

ALTER TABLE tax_ops_task_deliverables ENABLE ROW LEVEL SECURITY;

-- Migrate any existing JSONB deliverables into rows. Idempotent.
INSERT INTO tax_ops_task_deliverables (id, task_id, label, status, due_date, link_url, notes, sort_order)
SELECT
  COALESCE(elem->>'id', gen_random_uuid()::text),
  t.id,
  COALESCE(NULLIF(elem->>'label', ''), 'Untitled deliverable'),
  COALESCE(NULLIF(elem->>'status', ''), 'pending'),
  CASE WHEN COALESCE(elem->>'due_date', '') = '' THEN NULL
       ELSE (elem->>'due_date')::date END,
  NULLIF(elem->>'link_url', ''),
  NULLIF(elem->>'notes', ''),
  COALESCE((elem->>'sort_order')::int, 0)
FROM tax_ops_tasks t,
     LATERAL jsonb_array_elements(t.deliverables) elem
WHERE jsonb_typeof(t.deliverables) = 'array'
  AND jsonb_array_length(t.deliverables) > 0
ON CONFLICT (id) DO NOTHING;

ALTER TABLE tax_ops_tasks DROP COLUMN IF EXISTS deliverables;
DROP INDEX IF EXISTS idx_tax_ops_tasks_deliverables_gin;
