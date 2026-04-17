-- ════════════════════════════════════════════════════════════════════════
-- 007_fk_covering_indexes.sql
--
-- Supabase performance advisor flagged 4 foreign keys without a covering
-- index. With empty/small tables it doesn't matter; with a thousand rows
-- and a DELETE on the referenced parent, it's a sequential scan every
-- time. Cheap to fix once, expensive to diagnose later.
--
-- Idempotent via IF NOT EXISTS.
-- ════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_chat_messages_api_call
  ON public.chat_messages (api_call_id);

CREATE INDEX IF NOT EXISTS idx_chat_threads_entity
  ON public.chat_threads (entity_id);

CREATE INDEX IF NOT EXISTS idx_registrations_entity
  ON public.registrations (entity_id);

CREATE INDEX IF NOT EXISTS idx_validator_findings_invoice
  ON public.validator_findings (invoice_id);
