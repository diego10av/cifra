-- ════════════════════════════════════════════════════════════════════════
-- Migration 085 — Enable RLS on every public-schema table
--
-- Triggered by Supabase security advisor 2026-04-27 (lint 0013
-- rls_disabled_in_public). 29 tables created across earlier migrations
-- skipped the `ALTER TABLE … ENABLE ROW LEVEL SECURITY` step. Without
-- RLS, the auto-exposed PostgREST API at
-- `https://<project>.supabase.co/rest/v1/*` would let anyone with the
-- (publicly-derivable) anon key SELECT/INSERT/UPDATE/DELETE these
-- tables directly, bypassing the cifra app entirely.
--
-- App impact: zero. The DATABASE_URL connects with a Supabase pooler
-- role that has BYPASSRLS, and the storage SDK uses
-- SUPABASE_SERVICE_ROLE_KEY which also bypasses. With NO policies
-- created, RLS denies every other role by default — exactly what we
-- want for this single-user workspace where the REST API is not an
-- intended surface.
--
-- Also fixes lint 0011 function_search_path_mutable on
-- audit_log_is_append_only — pinning search_path prevents schema
-- shadowing.
-- ════════════════════════════════════════════════════════════════════════

-- ─── CRM module (19 tables) ────────────────────────────────────────────
ALTER TABLE crm_contacts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_opportunities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_contact_companies       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activities              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activity_contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_billing_payments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_matters                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_matter_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_time_entries            ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_disbursements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_matter_closing_steps    ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_companies               ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_retainer_topups         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_billing_invoices        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_firm_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_automation_rules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_task_templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_taxonomies              ENABLE ROW LEVEL SECURITY;

-- ─── Tax-Ops module (9 tables) ─────────────────────────────────────────
ALTER TABLE tax_obligations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_client_groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_entities                ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_deadline_rules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_team_members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_ops_task_comments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_filings                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_ops_task_attachments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_ops_tasks               ENABLE ROW LEVEL SECURITY;

-- ─── Other (1 table) ───────────────────────────────────────────────────
ALTER TABLE validator_runs              ENABLE ROW LEVEL SECURITY;

-- ─── Pin search_path on the audit-log append-only trigger function ────
ALTER FUNCTION public.audit_log_is_append_only() SET search_path = public, pg_temp;
