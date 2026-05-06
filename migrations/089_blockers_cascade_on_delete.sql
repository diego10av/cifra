-- ════════════════════════════════════════════════════════════════════════
-- Migration 089 — tax_ops_task_blockers.blocker_id ON DELETE CASCADE
--
-- Mig 088 set blocker_id to ON DELETE RESTRICT to prevent accidentally
-- orphaning state. In practice, that breaks the natural "delete an
-- engagement and all its workstreams" cascade when sibling sub-tasks
-- block each other: trying to drop the parent fails because the link
-- table holds a RESTRICT'd reference between two children that BOTH
-- get deleted.
--
-- Switching to CASCADE matches semantics: if the blocker no longer
-- exists, the dependency it represented can't matter anymore.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE tax_ops_task_blockers
  DROP CONSTRAINT tax_ops_task_blockers_blocker_id_fkey;

ALTER TABLE tax_ops_task_blockers
  ADD CONSTRAINT tax_ops_task_blockers_blocker_id_fkey
    FOREIGN KEY (blocker_id) REFERENCES tax_ops_tasks(id) ON DELETE CASCADE;
