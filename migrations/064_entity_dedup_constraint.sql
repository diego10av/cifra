-- Stint 50.C — prevent future entity duplicates.
--
-- Background: stint 50.B merged 36 duplicate entities (33 distinct groups)
-- that the stint-34 importer had created. Most were exact text variants of
-- the same legal name (e.g. "S.A." vs "SA", "S.à r.l." vs "Sà rl") plus an
-- orphan copy with a NULL client_group_id.
--
-- This migration adds a UNIQUE partial index that prevents the same pattern
-- from re-emerging. Two entities are now considered "the same" if their
-- normalized legal_name (lower-case, common punctuation stripped) AND their
-- client_group_id match. Liquidated / soft-deleted entities (is_active =
-- FALSE) are excluded so that re-creating an entity after a wind-down is
-- still allowed.
--
-- Note on COALESCE: client_group_id is nullable, and partial-index uniqueness
-- treats NULL as distinct from NULL by default. Coalescing to a sentinel
-- string collapses NULLs into one bucket so two ungrouped entities with the
-- same normalized name also collide. (id and client_group_id are TEXT in
-- this schema, not UUID — nanoid-style ids.)
--
-- After this index is in place, /api/tax-ops/entities POST does a pre-check
-- and returns 409 with `existing_entity_id` so the frontend can offer "use
-- existing" instead of producing a constraint-violation surfaced as a 500.

CREATE UNIQUE INDEX IF NOT EXISTS tax_entities_norm_unique
  ON tax_entities (
    LOWER(REGEXP_REPLACE(legal_name, '[,.()]', '', 'g')),
    COALESCE(client_group_id, '__no_group__')
  )
  WHERE is_active = TRUE;
