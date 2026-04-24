-- ════════════════════════════════════════════════════════════════════════
-- Migration 050 — Dynamic tax-ops sidebar metadata (stint 38.A)
--
-- Today the Tax-Ops sidebar items (CIT, NWT, VAT Annual/Q/M, …) are
-- hardcoded in Sidebar.tsx. Diego creates a new rule in Settings →
-- needs a redeploy to see it. Fix: add sidebar metadata on the rule
-- itself so the sidebar can render dynamically.
--
-- New tax_deadline_rules columns:
--   sidebar_label    TEXT      — display name (null falls back to
--                                 humanized tax_type)
--   sidebar_icon     TEXT      — lucide icon name; null → default
--   sidebar_group    TEXT      — optional logical group for nesting
--                                 (e.g. 'vat' so Annual/Q/M nest)
--   sidebar_order    INTEGER   — position within its group
--   sidebar_visible  BOOLEAN   — show in sidebar at all (default true)
--
-- Then seed the current hardcoded layout so behaviour is preserved.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE tax_deadline_rules
  ADD COLUMN IF NOT EXISTS sidebar_label   TEXT,
  ADD COLUMN IF NOT EXISTS sidebar_icon    TEXT,
  ADD COLUMN IF NOT EXISTS sidebar_group   TEXT,
  ADD COLUMN IF NOT EXISTS sidebar_order   INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS sidebar_visible BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_tax_deadline_rules_sidebar
  ON tax_deadline_rules(sidebar_order)
  WHERE sidebar_visible = TRUE;

-- Seed current hardcoded layout — matches what Sidebar.tsx renders today.
UPDATE tax_deadline_rules SET
  sidebar_label   = 'Corporate tax returns',
  sidebar_icon    = 'LandmarkIcon',
  sidebar_group   = NULL,
  sidebar_order   = 10
WHERE tax_type = 'cit_annual';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'NWT reviews',
  sidebar_icon    = 'SearchCheckIcon',
  sidebar_group   = NULL,
  sidebar_order   = 15,
  sidebar_visible = FALSE   -- NWT now lives as a column on CIT page (stint 37.D)
WHERE tax_type = 'nwt_annual';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'Annual',
  sidebar_icon    = 'ReceiptIcon',
  sidebar_group   = 'vat',
  sidebar_order   = 20
WHERE tax_type = 'vat_annual';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'Annual simplified',
  sidebar_icon    = 'ReceiptIcon',
  sidebar_group   = 'vat',
  sidebar_order   = 21,
  sidebar_visible = FALSE   -- rendered inside /tax-ops/vat/annual as a subtype
WHERE tax_type = 'vat_simplified_annual';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'Quarterly',
  sidebar_icon    = 'ReceiptIcon',
  sidebar_group   = 'vat',
  sidebar_order   = 22
WHERE tax_type = 'vat_quarterly';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'Monthly',
  sidebar_icon    = 'ReceiptIcon',
  sidebar_group   = 'vat',
  sidebar_order   = 23
WHERE tax_type = 'vat_monthly';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'Subscription tax',
  sidebar_icon    = 'CoinsIcon',
  sidebar_order   = 30
WHERE tax_type = 'subscription_tax_quarterly';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'Withholding tax',
  sidebar_icon    = 'WalletIcon',
  sidebar_order   = 40
WHERE tax_type = 'wht_director_monthly';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'WHT semester',
  sidebar_icon    = 'WalletIcon',
  sidebar_order   = 41,
  sidebar_visible = FALSE
WHERE tax_type = 'wht_director_semester';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'WHT annual',
  sidebar_icon    = 'WalletIcon',
  sidebar_order   = 42,
  sidebar_visible = FALSE
WHERE tax_type = 'wht_director_annual';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'FATCA / CRS',
  sidebar_icon    = 'LibraryBigIcon',
  sidebar_order   = 50
WHERE tax_type = 'fatca_crs_annual';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'BCL SBS',
  sidebar_icon    = 'LibraryBigIcon',
  sidebar_order   = 60
WHERE tax_type = 'bcl_sbs_quarterly';

UPDATE tax_deadline_rules SET
  sidebar_label   = 'BCL 2.16',
  sidebar_icon    = 'LibraryBigIcon',
  sidebar_order   = 61
WHERE tax_type = 'bcl_216_monthly';

INSERT INTO audit_log (id, user_id, action, target_type, target_id, new_value)
VALUES (
  gen_random_uuid()::text, 'migration_050',
  'tax_deadline_rules_sidebar_seed',
  'tax_deadline_rules', 'batch_050',
  jsonb_build_object('migration', '050', 'description', 'Added sidebar metadata columns + seed values to match the hardcoded layout.')::text
);
