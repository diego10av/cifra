-- ════════════════════════════════════════════════════════════════════════
-- Migration 054 — WHT ad-hoc deadline rule (stint 40.E)
--
-- Diego's feedback: "el withholding tax on director fees tiene que haber
-- una mejor manera de hacer el seguimiento porque la manera en la que es
-- no es una periodicidad. Algunas empresas lo hacen quarterly, otras
-- mensualmente, otras semestralmente, otras cada dos meses, cada tres,
-- según le dé a la gana. Entonces, tiene que estar esto más que se
-- pueda adaptar."
--
-- Adds a 4th WHT cadence: ad-hoc. Entities whose director-fee payments
-- don't fit a regular schedule get an ad-hoc obligation; each filing
-- carries its own free-text period_label and manually-entered deadline.
--
-- Full per-entity cadence switcher (move an entity between monthly ↔
-- quarterly ↔ semester ↔ annual ↔ adhoc) is deferred to stint 41.
-- For now Diego can manually archive one WHT obligation and create
-- another with a different tax_type via the entity detail / matrix
-- flows.
--
-- Applied via Supabase MCP execute_sql on 2026-04-24.
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO tax_deadline_rules (
  id, tax_type, period_pattern, rule_kind, rule_params,
  admin_tolerance_days, statutory_description, market_practice_note,
  sidebar_visible, sidebar_order, sidebar_label, sidebar_icon
)
VALUES (
  gen_random_uuid()::text,
  'wht_director_adhoc',
  'adhoc',
  'adhoc_no_deadline',
  '{}'::jsonb,
  0,
  'Withholding tax on director fees — ad-hoc filings (triggered by actual payment events, no fixed cadence).',
  'Some entities pay director fees irregularly (quarterly some years, annually others). Each filing gets its own period label + deadline entered manually.',
  FALSE,  -- hidden from sidebar; reached via WHT tabs + /tax-ops/other
  43,
  'WHT ad-hoc',
  'WalletIcon'
)
ON CONFLICT DO NOTHING;
