-- ════════════════════════════════════════════════════════════════════════
-- Migration 047 — Tax-Ops status enum rework (stint 37.A)
--
-- Background: Diego reviewed the tax_filings status enum after 2 weeks
-- of real usage and flagged three mismatches with his actual workflow:
--
--   1. 'pending_info' is a misnomer — the first step is "nosotros
--      tenemos que pedir la información". Renaming to 'info_to_request'
--      makes the action obvious.
--
--   2. 'draft_sent' and 'pending_client_approval' are functionally the
--      same ("mandé el borrador, el cliente lo tiene") — sometimes the
--      draft is sent for review, sometimes just as FYI. Collapse them.
--
--   3. A new state is missing between 'working' and 'draft_sent': the
--      moment where the team needs a clarification from the client and
--      has emailed them waiting for feedback. Name:
--      'awaiting_client_clarification'.
--
--   4. 'paid' should NOT be a status — it's an orthogonal fact Diego
--      rarely knows about ("la gran mayoría de los casos no sabemos si
--      se paga el IVA, lo hace el contable o el cliente"). Paid now
--      lives as paid_at + amount_paid fields (already in the table,
--      visible on filing detail only). Removing from the enum.
--
--   5. Purge historical 2024 filings — Diego's instruction: "vamos a
--      empezar todo nuevo desde el año 2025". The 31 CIT 2024 rows
--      (carried from the 'Assessment received 2024' column in the
--      Excel) disappear. 2024 assessments will rebuild naturally as
--      2025 filings age into them.
-- ════════════════════════════════════════════════════════════════════════

-- Safety: log counts before + after for the audit trail.
DO $$
DECLARE
  before_total INTEGER;
  before_2024  INTEGER;
BEGIN
  SELECT COUNT(*) INTO before_total FROM tax_filings;
  SELECT COUNT(*) INTO before_2024  FROM tax_filings WHERE period_year < 2025;
  RAISE NOTICE 'Migration 047: before — total=%, pre_2025=%', before_total, before_2024;
END $$;

-- 1. Purge all filings pre-2025.
DELETE FROM tax_filings WHERE period_year < 2025;

-- 2. Status rename: pending_info → info_to_request.
UPDATE tax_filings
   SET status = 'info_to_request',
       updated_at = NOW()
 WHERE status = 'pending_info';

-- 3. Merge pending_client_approval → draft_sent.
UPDATE tax_filings
   SET status = 'draft_sent',
       updated_at = NOW()
 WHERE status = 'pending_client_approval';

-- 4. Migrate any status='paid' filings (none in prod today, but defensive):
--    copy filed_at into paid_at if paid_at missing, then flip status to
--    'assessment_received' (downstream state after filing + paid).
UPDATE tax_filings
   SET paid_at = COALESCE(paid_at, filed_at),
       status = 'assessment_received',
       updated_at = NOW()
 WHERE status = 'paid';

-- 5. Update the status documentation column.
COMMENT ON COLUMN tax_filings.status IS
  'info_to_request | info_received | working | awaiting_client_clarification | draft_sent | filed | assessment_received | waived | blocked';

-- 6. Audit trail row.
INSERT INTO audit_log
  (id, user_id, action, target_type, target_id, new_value)
VALUES (
  gen_random_uuid()::text,
  'migration_047',
  'tax_filings_status_rework',
  'tax_filings', 'batch_047',
  jsonb_build_object(
    'migration', '047',
    'description', 'Renamed pending_info→info_to_request; merged pending_client_approval→draft_sent; introduced awaiting_client_clarification; dropped paid from enum (paid_at field still present); purged pre-2025 filings.',
    'post_total',
      (SELECT COUNT(*) FROM tax_filings)
  )::text
);

DO $$
DECLARE
  after_total INTEGER;
BEGIN
  SELECT COUNT(*) INTO after_total FROM tax_filings;
  RAISE NOTICE 'Migration 047: after — total=% (expect 259 - 31 = 228).', after_total;
END $$;

-- Verification
--   SELECT status, COUNT(*) FROM tax_filings GROUP BY status ORDER BY 2 DESC;
--   expected: info_to_request=129, working=54, filed=41 (incl. re-mapped 2024 assessments gone), assessment_received<=30 minus deleted 2024, draft_sent=1, blocked=4
