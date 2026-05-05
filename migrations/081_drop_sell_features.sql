-- ═══════════════════════════════════════════════════════════════════════
-- Migration 081 · Drop sell-feature tables (single-user reset)
--
-- Drops the schema for features removed in the dogfood-first reset:
--
--   • entity_approvers (mig 005, 016) — per-entity approver list +
--     approver_role column. Was used by client portal share-link to
--     pick To/Cc; portal removed.
--   • client_contacts (mig 012) — multi-contact-per-client roster.
--     Was used by ApproversCard to inherit contacts; ApproversCard removed.
--   • chat_threads + chat_messages (mig 001) — in-product chat backing
--     store. Chat UI + endpoints + lib helpers removed.
--
-- The feedback table is kept (single-user feedback to Claude is still
-- useful as a personal log). The api_calls table is kept for budget
-- tracking (see mig 080 — user_id FK gone, column kept as plain text).
--
-- IDEMPOTENT via DROP TABLE IF EXISTS … CASCADE. Safe to re-run.
--
-- Author: Claude (reset 2026-05-05)
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_threads CASCADE;
DROP TABLE IF EXISTS client_contacts CASCADE;
DROP TABLE IF EXISTS entity_approvers CASCADE;

COMMIT;

-- ───────────────────────────── verification ────────────────────────────
--
--   SELECT to_regclass('public.chat_messages');     -- NULL
--   SELECT to_regclass('public.chat_threads');      -- NULL
--   SELECT to_regclass('public.client_contacts');   -- NULL
--   SELECT to_regclass('public.entity_approvers');  -- NULL
