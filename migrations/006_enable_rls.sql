-- ════════════════════════════════════════════════════════════════════════
-- 006_enable_rls.sql
--
-- Turn on Row-Level Security on every `public.*` table. No policies are
-- created, which means:
--
--   - `service_role` (used by the Next.js server — see src/lib/db.ts)
--     has the BYPASSRLS attribute in Supabase, so it continues to read
--     and write every row. The app behaves exactly the same.
--
--   - `anon` and `authenticated` roles are denied by default (no policy
--     = no access). This matters because Supabase exposes these tables
--     via PostgREST on a URL any browser can hit. Without RLS, anyone
--     with the project's public URL + anon key could read everything.
--     With RLS and no permissive policy, they read nothing.
--
-- This is the "deny-all for public roles, service-role still works"
-- posture — the cheapest way to close the Supabase security advisor
-- ERROR for a single-tenant backend that already gates access through
-- its own API layer.
--
-- If/when we introduce per-user auth (see ROADMAP "multi-tenant"),
-- we'll add policies like:
--    USING (organization_id = auth.jwt() ->> 'org_id')
-- at that point. For now, the server-side service role is the only
-- caller that needs to reach these tables.
--
-- Also fixes `touch_updated_at` function: SET search_path = '' is the
-- advisor-recommended hardening to prevent search-path injection on
-- SECURITY DEFINER functions.
--
-- Idempotent: enabling RLS on an already-enabled table is a no-op, and
-- ALTER FUNCTION ... SET search_path is safe to re-run.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Enable RLS on every public table.
--    Listed alphabetically; kept verbose (no dynamic SQL) so it's
--    greppable and auditable.
ALTER TABLE public.aed_communications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_calls            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.declarations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_approvers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_overrides      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.precedents           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validator_findings   ENABLE ROW LEVEL SECURITY;

-- 2. Pin search_path on touch_updated_at().
--    The function is a trivial BEFORE UPDATE trigger (sets
--    updated_at = now()); pinning search_path to '' ensures it can
--    never be subverted by a rogue schema on the caller's path.
ALTER FUNCTION public.touch_updated_at() SET search_path = '';
