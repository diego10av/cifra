-- ═══════════════════════════════════════════════════════════════════════
-- Migration 005 · Clients as first-class parent + entity approvers.
--
-- Restructures the data model around the reality Diego described
-- (2026-04-18):
--
--   A CLIENT (end customer or Corporate Service Provider) owns one or
--   more ENTITIES (the Lux legal structures: SOPARFI, SCSp, etc.).
--   Each ENTITY can have multiple APPROVERS who need to sign off on
--   its VAT declarations — e.g. the Avallon case: an on-island CSP
--   director in Luxembourg + the Head of Finance at the client's HQ
--   in Poland.
--
-- Changes:
--   1. New `clients` table (name, type, primary contact, address,
--      notes). Unique per cifra install.
--   2. `entities.client_id` FK → clients. Required for new entities;
--      backfilled for existing.
--   3. New `entity_approvers` table: multiple approvers per entity,
--      each carrying the info a reviewer needs to actually reach
--      them (name, role, email, phone, organisation, country, type).
--   4. Retire `entities.client_name`, `client_email`, `csp_name`,
--      `csp_email` — now live in `clients` / `entity_approvers`.
--      Columns kept for a migration grace period; dropped in 006.
--
-- Backfill strategy (runs inside this migration):
--   - Group entities by (client_name, csp_name) tuple → one Client
--     per distinct pair. When `client_name` is NULL we synthesise
--     "Unnamed client (N)" rather than leaving a NULL FK.
--   - Set entities.client_id.
--   - For each entity that had client_email or csp_email populated,
--     create entity_approvers rows (primary = client, CC = CSP).
--
-- IDEMPOTENT. Safe to re-run. The backfill is guarded by
-- "WHERE client_id IS NULL" so rerunning only touches rows that
-- haven't been migrated yet.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────── 1. clients ────────────────────────────

CREATE TABLE IF NOT EXISTS clients (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  -- Nature of the client relationship. The UI presents these as
  -- "End client" (Avallon, the actual economic owner) and "Corporate
  -- service provider" (fiduciary firm that acts between Avallon and
  -- us — e.g. a Lux-based trust company managing the SARL).
  -- `other` is an escape hatch for edge cases (law firm, accountant,
  -- internal / single-seat setups).
  kind                  TEXT NOT NULL DEFAULT 'end_client'
                          CHECK (kind IN ('end_client', 'csp', 'other')),
  -- Primary contact for VAT matters. This is the default "who do we
  -- call?" for any entity owned by this client. Individual entity
  -- approvers override per-entity when configured.
  vat_contact_name      TEXT,
  vat_contact_email     TEXT,
  vat_contact_phone     TEXT,
  vat_contact_role      TEXT,      -- e.g. "CFO", "Head of Finance"
  vat_contact_country   TEXT,      -- ISO-2 where they're based
  -- Optional identity / address fields — we don't demand them at
  -- creation so the wizard stays friction-less.
  address               TEXT,
  website               TEXT,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at           TIMESTAMPTZ
);

-- Lookup by name (quick autocomplete in the "assign to existing client"
-- path when creating a new entity).
CREATE INDEX IF NOT EXISTS idx_clients_name_active
  ON clients(lower(name))
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_kind
  ON clients(kind)
  WHERE archived_at IS NULL;

-- Generic touch_updated_at (reused from 001; redeclared in case 005
-- runs without 001 having run first).
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clients_touch_updated_at ON clients;
CREATE TRIGGER trg_clients_touch_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ───────────────── 2. entities.client_id FK + index ─────────────────

ALTER TABLE entities ADD COLUMN IF NOT EXISTS client_id TEXT;

-- FK added as NOT VALID + then VALIDATE at the end, so the backfill
-- can run before the constraint is enforced. Separated from the ADD
-- COLUMN so a re-run doesn't error on the duplicate FK.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_entities_client'
      AND conrelid = 'entities'::regclass
  ) THEN
    ALTER TABLE entities
      ADD CONSTRAINT fk_entities_client
      FOREIGN KEY (client_id) REFERENCES clients(id)
      ON UPDATE CASCADE ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_entities_client
  ON entities(client_id)
  WHERE client_id IS NOT NULL;

-- ───────────────── 3. entity_approvers table ─────────────────

CREATE TABLE IF NOT EXISTS entity_approvers (
  id              TEXT PRIMARY KEY,
  entity_id       TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  email           TEXT,         -- nullable: some approvers sign via phone only
  phone           TEXT,
  role            TEXT,         -- "Director", "Head of Finance", "Accountant"…
  organization    TEXT,         -- CSP firm name or client HQ name; free text
  country         TEXT,         -- ISO-2 for "where are they?" (Avallon: LU + PL)
  -- What side are they on? Drives the UI pill colour + helps the
  -- reviewer mentally group.
  approver_type   TEXT NOT NULL DEFAULT 'client'
                    CHECK (approver_type IN ('client', 'csp', 'other')),
  -- Is this the primary approver? Only one per entity. The portal
  -- share link uses this address as the to:; others are added as cc:
  -- in the generated draft email.
  is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Display order in lists.
  sort_order      INTEGER NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_approvers_entity
  ON entity_approvers(entity_id, sort_order);

-- At most one primary per entity — enforced via partial unique index
-- rather than a trigger, so the DB is the source of truth.
CREATE UNIQUE INDEX IF NOT EXISTS uq_entity_approvers_primary
  ON entity_approvers(entity_id)
  WHERE is_primary = TRUE;

DROP TRIGGER IF EXISTS trg_entity_approvers_touch_updated_at ON entity_approvers;
CREATE TRIGGER trg_entity_approvers_touch_updated_at
  BEFORE UPDATE ON entity_approvers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ──────────────────────── 4. backfill clients ────────────────────────

-- Strategy: for each unique (client_name, csp_name) tuple in entities,
-- create one client row. If both are null, group under a single
-- "Unnamed client" row. Entities without a client_id get pointed to
-- their new parent.
--
-- This runs ONCE per row that has client_id IS NULL — re-running the
-- migration is safe because already-backfilled rows are skipped.

-- Step 4a: upsert clients from distinct (client_name, csp_name) pairs.
-- We hash the tuple into a deterministic id so re-running produces the
-- same client record.
INSERT INTO clients (id, name, kind, vat_contact_name, vat_contact_email)
SELECT
  'client-bf-' || substring(md5(
    COALESCE(client_name, '') || '|' || COALESCE(csp_name, '')
  ), 1, 12) AS id,
  COALESCE(NULLIF(client_name, ''), NULLIF(csp_name, ''), 'Unnamed client') AS name,
  CASE
    WHEN csp_name IS NOT NULL AND client_name IS NULL THEN 'csp'
    ELSE 'end_client'
  END AS kind,
  COALESCE(client_name, csp_name) AS vat_contact_name,
  COALESCE(client_email, csp_email) AS vat_contact_email
FROM (
  SELECT DISTINCT client_name, csp_name, client_email, csp_email
  FROM entities
  WHERE client_id IS NULL
) src
ON CONFLICT (id) DO NOTHING;

-- Step 4b: point each entity at its new client.
UPDATE entities e
   SET client_id = 'client-bf-' || substring(md5(
         COALESCE(e.client_name, '') || '|' || COALESCE(e.csp_name, '')
       ), 1, 12)
 WHERE e.client_id IS NULL;

-- Step 4c: now that every row has a client_id, validate the FK.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_entities_client'
      AND NOT convalidated
  ) THEN
    ALTER TABLE entities VALIDATE CONSTRAINT fk_entities_client;
  END IF;
END $$;

-- Step 4d: backfill entity_approvers from the existing inline contact
-- fields. client_email → primary approver; csp_email → secondary.
-- Also deterministic ids so re-running is safe.

INSERT INTO entity_approvers
  (id, entity_id, name, email, role, organization, approver_type, is_primary, sort_order)
SELECT
  'appr-' || substring(md5(e.id || '|primary'), 1, 12) AS id,
  e.id AS entity_id,
  COALESCE(NULLIF(e.client_name, ''), 'Primary contact') AS name,
  NULLIF(e.client_email, '') AS email,
  NULL AS role,
  NULLIF(e.client_name, '') AS organization,
  'client' AS approver_type,
  TRUE AS is_primary,
  0 AS sort_order
FROM entities e
WHERE COALESCE(NULLIF(e.client_name, ''), NULLIF(e.client_email, '')) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM entity_approvers a WHERE a.entity_id = e.id AND a.is_primary = TRUE
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO entity_approvers
  (id, entity_id, name, email, role, organization, approver_type, is_primary, sort_order)
SELECT
  'appr-' || substring(md5(e.id || '|csp'), 1, 12) AS id,
  e.id AS entity_id,
  COALESCE(NULLIF(e.csp_name, ''), 'CSP contact') AS name,
  NULLIF(e.csp_email, '') AS email,
  'CSP contact' AS role,
  NULLIF(e.csp_name, '') AS organization,
  'csp' AS approver_type,
  FALSE AS is_primary,
  1 AS sort_order
FROM entities e
WHERE COALESCE(NULLIF(e.csp_name, ''), NULLIF(e.csp_email, '')) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM entity_approvers a WHERE a.id = 'appr-' || substring(md5(e.id || '|csp'), 1, 12)
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────── 5. retire inline columns (grace period) ──────────────
--
-- NOT dropping client_name/client_email/csp_name/csp_email yet. Code
-- still reads them until the UI is fully switched over. Migration 006
-- drops them once we've confirmed the app boots cleanly against the
-- new model.

COMMIT;

-- ───────────────────────────── verification ────────────────────────────
-- After running:
--   SELECT COUNT(*) FROM clients;
--   SELECT COUNT(*) FROM entities WHERE client_id IS NULL;   -- should be 0
--   SELECT COUNT(*) FROM entity_approvers;
--   SELECT e.name, c.name AS client_name FROM entities e JOIN clients c ON e.client_id = c.id LIMIT 10;
