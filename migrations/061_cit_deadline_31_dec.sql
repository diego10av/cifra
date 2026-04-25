-- ════════════════════════════════════════════════════════════════════════
-- Migration 061 — CIT extension date back to 31 December N+1 (stint 43.D5)
--
-- Diego corrected himself: "ahora te has equivocado con la del IVA. La
-- deadline aquí de las declaraciones [CIT] es siempre el 31 de diciembre
-- del año siguiente." So we revert mig 053 (which had moved CIT to 30 Oct
-- believing the AED letter capped there).
--
-- Reverts:
--   - rule_params.extension_month = 12
--   - rule_params.extension_day   = 31
--   - admin_tolerance_days        = 0 (no tolerance past the extension —
--     after 31 Dec it's overdue, period)
--   - statutory_description       = restored to the pre-053 phrasing
--
-- Then recompute deadline_date on every OPEN cit_annual filing (status
-- not yet 'filed') so the matrix shows the corrected date right away.
-- Already-filed rows keep their historical deadline.
-- ════════════════════════════════════════════════════════════════════════

UPDATE tax_deadline_rules
SET rule_params = rule_params
                    || '{"extension_month": 12}'
                    || '{"extension_day": 31}',
    admin_tolerance_days = 0,
    statutory_description = 'Form 500 — statutory 31 March N+1 (LIR Art. 170). AED extension granted on request typically extends to 31 December N+1.',
    market_practice_note = 'In practice every CIT filing uses the AED extension; the working deadline is 31 Dec N+1.',
    updated_at = NOW()
WHERE tax_type = 'cit_annual';

-- Recompute deadline_date on open filings so the matrix shows the new date.
UPDATE tax_filings f
SET deadline_date = make_date(f.period_year + 1, 12, 31),
    updated_at = NOW()
FROM tax_obligations o
WHERE f.obligation_id = o.id
  AND o.tax_type = 'cit_annual'
  AND f.status <> 'filed';

-- Audit row capturing the revert.
INSERT INTO audit_log (id, user_id, action, target_type, target_id, new_value, created_at)
VALUES (
  gen_random_uuid()::text,
  'system',
  'tax_deadline_rule_correction',
  'tax_deadline_rule',
  'cit_annual',
  jsonb_build_object(
    'migration', '061',
    'reverts', '053',
    'extension_changed_from', '30 Oct N+1',
    'extension_changed_to', '31 Dec N+1',
    'reason', 'Diego corrected — 31 Dec is the working deadline, not 30 Oct'
  )::text,
  NOW()
);
