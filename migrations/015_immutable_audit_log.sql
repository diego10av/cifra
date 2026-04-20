-- ═══════════════════════════════════════════════════════════════════════
-- Migration 015 · Immutable audit log (applied via Supabase MCP 2026-04-20).
--
-- Append-only enforcement on audit_log. Matches the compliance
-- baseline expected by Big-4 / regulated-vertical customers: the
-- audit trail cannot be rewritten by any role, including admin,
-- without a visible out-of-band operation (dropping the triggers).
--
-- If a correction is ever genuinely needed:
--   1. DROP TRIGGER audit_log_no_update, audit_log_no_delete ON audit_log;
--   2. Perform the correction.
--   3. Re-apply this migration.
-- Each of those steps is visible in Postgres logs + Supabase UI.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION audit_log_is_append_only()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '45000',
    MESSAGE = 'audit_log is append-only — UPDATE and DELETE are not permitted (immutability guarantee, migration 015).',
    HINT = 'If a genuine correction is needed, drop the audit_log_no_update / audit_log_no_delete triggers in a monitored maintenance window. The drop itself will be visible in Postgres logs.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log;
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log;
CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();
