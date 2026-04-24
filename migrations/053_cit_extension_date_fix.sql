-- ════════════════════════════════════════════════════════════════════════
-- Migration 053 — CIT extension date realigned with AED practice (stint 40.L)
--
-- Diego's feedback: "la tolerancia administrativa anual es hasta el 30 de
-- octubre. Suelen enviar una carta que es hasta el 30 de octubre. Y tú me
-- dices que quedan 6 días, que son 2 meses."
--
-- The cit_annual rule was seeded with extension 31 Dec (the formal latest
-- filing date) but in practice AED issues a letter extending to 30 Oct.
-- Updating the rule to match reality so the matrix's deadline badge
-- matches what Diego tells clients.
--
-- Also propagates to existing open filings (status NOT IN filed /
-- assessment_received / waived) so the UI doesn't show stale Dec 31
-- deadlines overnight. Already-filed rows keep their historical deadline.
--
-- Was applied via Supabase MCP execute_sql on 2026-04-24; this file
-- ships as the audit trail. Idempotent: re-running rewrites the same
-- values.
-- ════════════════════════════════════════════════════════════════════════

UPDATE tax_deadline_rules
SET rule_params = rule_params
                    || '{"extension_month": 10}'
                    || '{"extension_day": 30}',
    admin_tolerance_days = 0,
    statutory_description = 'Form 500 — statutory 31 March N+1 (LIR Art. 170). AED typically issues a letter extending to 30 October N+1.',
    market_practice_note = 'Most filings use the AED extension letter (30 Oct). If a specific letter pushes later, edit the filing''s deadline directly.',
    updated_at = NOW()
WHERE tax_type = 'cit_annual';

-- Propagate to open filings so the UI reflects the new effective date.
UPDATE tax_filings f
SET deadline_date = make_date(f.period_year + 1, 10, 30),
    updated_at = NOW()
FROM tax_obligations o
WHERE f.obligation_id = o.id
  AND o.tax_type = 'cit_annual'
  AND f.status NOT IN ('filed', 'assessment_received', 'waived');
