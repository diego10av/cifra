-- Stint 50.A — recovery migration for lost contacts.
--
-- Background: stint 48.U3.A refactored `contactsColumn` so that the matrix
-- UI now reads/writes `tax_entities.csp_contacts` (entity-level) instead of
-- `tax_filings.csp_contacts` (filing-level). Diego had previously added
-- contacts at the filing level — those rows were preserved in the database
-- but the UI stopped surfacing them after the refactor, looking like a
-- silent data loss.
--
-- This migration backfills entity-level contacts from the most recent
-- filing-level entry per entity, only when the entity-level value is empty.
-- Idempotent: re-runs that find an entity already populated leave it alone.
--
-- Diego's words: "no quiero que nada de lo que meta, actualice se borre.
-- eso es CLAVE."

WITH latest_filing_contacts AS (
  SELECT DISTINCT ON (o.entity_id)
    o.entity_id,
    f.csp_contacts AS contacts
  FROM tax_filings f
  JOIN tax_obligations o ON o.id = f.obligation_id
  WHERE f.csp_contacts IS NOT NULL
    AND jsonb_typeof(f.csp_contacts) = 'array'
    AND jsonb_array_length(f.csp_contacts) > 0
  ORDER BY o.entity_id, f.updated_at DESC NULLS LAST, f.created_at DESC
)
UPDATE tax_entities e
   SET csp_contacts = lfc.contacts,
       updated_at = NOW()
  FROM latest_filing_contacts lfc
 WHERE e.id = lfc.entity_id
   AND (
     e.csp_contacts IS NULL
     OR jsonb_typeof(e.csp_contacts) != 'array'
     OR jsonb_array_length(e.csp_contacts) = 0
   );
