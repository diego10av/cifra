-- ═══════════════════════════════════════════════════════════════════════
-- Migration 016 · Intermediary CSP on clients + approver-role distinction
--                 (applied via Supabase MCP 2026-04-20).
--
-- Stint 14 follow-up from Diego's screenshot review. Two shape changes:
--
-- 1. Clients: optional intermediary / engaged-via relationship.
--    A law firm often serves an end-client (BlackRock) through a
--    CSP (JTC). Cifra tracks both in a single client row — the end
--    client is the record, the intermediary is metadata on that
--    row. The UI shows the intermediary fields only when type =
--    end_client AND "engaged via intermediary" is toggled on.
--
-- 2. entity_approvers + client_contacts: approver-role distinction.
--    Today the schema conflated "I approve declarations" with
--    "please CC me on the approval email". Per Diego's note, these
--    are distinct: a director might approve, while the CFO + finance
--    team only want to be CC'd. A `contact_role` / `approver_role`
--    column (approver / cc / both) captures the difference.
--
-- Defaults preserve existing behaviour:
--   - entity_approvers.approver_role defaults to 'approver' so
--     existing rows still sign off.
--   - client_contacts.contact_role defaults to 'both' so existing
--     contacts continue to play both roles.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS engaged_via_name TEXT,
  ADD COLUMN IF NOT EXISTS engaged_via_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS engaged_via_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS engaged_via_contact_role TEXT,
  ADD COLUMN IF NOT EXISTS engaged_via_notes TEXT;

ALTER TABLE entity_approvers
  ADD COLUMN IF NOT EXISTS approver_role TEXT NOT NULL DEFAULT 'approver'
    CHECK (approver_role IN ('approver', 'cc', 'both'));

ALTER TABLE client_contacts
  ADD COLUMN IF NOT EXISTS contact_role TEXT NOT NULL DEFAULT 'both'
    CHECK (contact_role IN ('approver', 'cc', 'both'));
