-- ════════════════════════════════════════════════════════════════════════
-- Migration 046 — Tax-Ops service_kind + NWT re-classification (stint 35)
--
-- Background: after the stint 34 ship, Diego clarified that NWT is NOT a
-- filing — it's an advisory review done at year-end for opted-in clients
-- only. Interim financials are requested for Nov/Dec, the team checks for
-- tax leakage, and proposes restructuring. The output is a recommendation
-- memo, not a return submitted to AED. It coexists with the CIT annual
-- return (Form 500) but has its own workflow and cadence.
--
-- This migration introduces a `service_kind` dimension on obligations so
-- the UI can render filings and reviews with distinct columns + semantics
-- while keeping the data model uniform. Existing nwt_annual obligations
-- are re-classified to 'review' in bulk. No rows deleted.
-- ════════════════════════════════════════════════════════════════════════

-- 1. New column on tax_obligations
ALTER TABLE tax_obligations
  ADD COLUMN IF NOT EXISTS service_kind TEXT NOT NULL DEFAULT 'filing';

COMMENT ON COLUMN tax_obligations.service_kind IS
  'filing = submitted to AED (CIT, VAT, WHT, sub-tax, BCL, FATCA/CRS).
   review = internal advisory, no AED submission (NWT year-end review today;
   extensible to other advisory services later).';

-- Partial index so "give me all active reviews" queries stay fast even
-- when reviews are a small minority of rows.
CREATE INDEX IF NOT EXISTS idx_tax_obligations_reviews
  ON tax_obligations(entity_id)
  WHERE service_kind = 'review' AND is_active = TRUE;

-- 2. Re-classify existing NWT obligations as reviews.
--    nwt_annual is the only review kind today; keep the tax_type value
--    so downstream code that filters by tax_type continues to work.
UPDATE tax_obligations
   SET service_kind = 'review',
       updated_at   = NOW()
 WHERE tax_type = 'nwt_annual';

-- 3. Adjust the seeded deadline rule for NWT review.
--    Previously: fixed_md_with_extension {month:3,day:31, ext:12/31} — same
--    mechanics as CIT filing. Wrong model.
--    New: fixed_md month=11 day=30 (closing interim ~end of November is the
--    trigger to kick off the review). Diego can fine-tune via settings.
UPDATE tax_deadline_rules
   SET rule_kind             = 'fixed_md',
       rule_params           = '{"month":11,"day":30}'::jsonb,
       statutory_description = 'Internal advisory review — no statutory deadline. Target trigger date: interim financials for year-end check.',
       admin_tolerance_days  = 30,
       market_practice_note  = 'NWT review kicks off when interim financials arrive (typically late Nov / early Dec). Done for opted-in clients only; review output is a restructuring recommendation memo, not a return filed with AED.',
       updated_at            = NOW(),
       updated_by            = 'migration_046'
 WHERE id = 'rule_nwt_annual';

-- 4. Audit trail entry for the cleanup
INSERT INTO audit_log
  (id, user_id, action, target_type, target_id, new_value)
VALUES
  (gen_random_uuid()::text, 'migration_046',
   'tax_obligations_service_kind_init',
   'tax_obligations', 'batch_046',
   jsonb_build_object(
     'migration', '046',
     'description', 'Added service_kind column; reclassified nwt_annual obligations as reviews.',
     'review_count',
       (SELECT COUNT(*) FROM tax_obligations WHERE service_kind = 'review')
   )::text);

-- verification
--   SELECT service_kind, COUNT(*) FROM tax_obligations GROUP BY service_kind;
--   SELECT id, rule_params, market_practice_note FROM tax_deadline_rules WHERE id='rule_nwt_annual';
