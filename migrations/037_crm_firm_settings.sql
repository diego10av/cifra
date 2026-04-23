-- ════════════════════════════════════════════════════════════════════════
-- Migration 037 — CRM firm settings (singleton)
--
-- Introduces `crm_firm_settings` — a single-row table holding the
-- issuing firm's identity (name, address, VAT number, matricule),
-- bank details (IBAN / BIC), default payment terms, and footer text.
-- Consumed by the invoice PDF renderer (stint 29.A, Fase 4.1) so
-- invoices carry proper letterhead instead of hard-coding strings in
-- code.
--
-- Design: singleton enforced via id='default' check constraint. Use
-- ON CONFLICT DO NOTHING on the seed INSERT so re-running is safe.
-- Adding multi-firm support (per-user or per-org) is out of scope for
-- the Manso Partners single-tenant setup.
--
-- Rollback: DROP TABLE crm_firm_settings.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crm_firm_settings (
  id                  TEXT PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  firm_name           TEXT NOT NULL DEFAULT 'My Firm',
  firm_address_lines  TEXT[] NOT NULL DEFAULT '{}',     -- e.g. ['12 rue du Fossé', 'L-1536 Luxembourg']
  firm_vat_number     TEXT,
  firm_matricule      TEXT,
  firm_rcs_number     TEXT,
  firm_email          TEXT,
  firm_phone          TEXT,
  firm_website        TEXT,
  bank_name           TEXT,
  bank_iban           TEXT,
  bank_bic            TEXT,
  payment_terms_days  INTEGER NOT NULL DEFAULT 30,
  footer_text         TEXT,
  logo_data_url       TEXT,    -- base64 data URL, inline in the PDF header
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the default row if it's missing so the app always has
-- something to render.
INSERT INTO crm_firm_settings (id, firm_name)
VALUES ('default', 'My Firm')
ON CONFLICT (id) DO NOTHING;


-- verification
--   SELECT id, firm_name, payment_terms_days FROM crm_firm_settings;
--   -> 1 row
