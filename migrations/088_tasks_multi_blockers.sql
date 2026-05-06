-- ════════════════════════════════════════════════════════════════════════
-- Migration 088 — Multi-blocker dependencies on tasks
--
-- Stint 84.F. Today depends_on_task_id is a 1:1 column. For real M&A
-- workflows a task can be blocked by several others (signing depends on
-- final draft + client approval + notary slot). The link table makes
-- the graph natural; existing data is migrated and the legacy column
-- stays for one release cycle as a rollback safety net.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tax_ops_task_blockers (
  task_id    TEXT NOT NULL REFERENCES tax_ops_tasks(id) ON DELETE CASCADE,
  blocker_id TEXT NOT NULL REFERENCES tax_ops_tasks(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, blocker_id),
  CHECK (task_id <> blocker_id)
);

CREATE INDEX IF NOT EXISTS idx_task_blockers_blocker ON tax_ops_task_blockers(blocker_id);

ALTER TABLE tax_ops_task_blockers ENABLE ROW LEVEL SECURITY;

INSERT INTO tax_ops_task_blockers (task_id, blocker_id)
SELECT id, depends_on_task_id
  FROM tax_ops_tasks
 WHERE depends_on_task_id IS NOT NULL
   AND depends_on_task_id <> id
ON CONFLICT (task_id, blocker_id) DO NOTHING;
