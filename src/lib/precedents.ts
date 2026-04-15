// Precedent learning: triggered when a declaration transitions to APPROVED.
// For each confirmed line (provider + country + treatment), upsert into the
// precedents table so future declarations for the same entity benefit from
// the user's professional judgment.

import { query, execute, generateId, logAudit, queryOne } from '@/lib/db';

export interface PrecedentUpsertReport {
  inserted: number;
  updated: number;
  skipped: number;
  total_lines_considered: number;
}

export async function upsertPrecedentsFromDeclaration(
  declarationId: string
): Promise<PrecedentUpsertReport> {
  const decl = await queryOne<{ entity_id: string }>(
    'SELECT entity_id FROM declarations WHERE id = $1',
    [declarationId]
  );
  if (!decl) throw new Error('Declaration not found');
  const entityId = decl.entity_id;

  const lines = await query<{
    provider: string | null;
    country: string | null;
    treatment: string | null;
    description: string | null;
    amount_eur: number | null;
  }>(
    `SELECT i.provider, i.country, il.treatment, il.description,
            il.amount_eur::float AS amount_eur
       FROM invoice_lines il
       JOIN invoices i ON il.invoice_id = i.id
      WHERE il.declaration_id = $1
        AND il.state != 'deleted'
        AND il.treatment IS NOT NULL
        AND i.provider IS NOT NULL
        AND TRIM(i.provider) != ''`,
    [declarationId]
  );

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const line of lines) {
    const provider = (line.provider || '').trim();
    const country = (line.country || '').toUpperCase().slice(0, 2) || null;
    const treatment = line.treatment!;

    if (!provider || provider.toLowerCase() === 'unknown') {
      skipped += 1;
      continue;
    }

    // Upsert by (entity_id, provider, country) — matches the existing UNIQUE constraint.
    const existing = await queryOne<{ id: string; treatment: string; times_used: number }>(
      `SELECT id, treatment, times_used FROM precedents
        WHERE entity_id = $1
          AND provider = $2
          AND COALESCE(country, '') = COALESCE($3, '')`,
      [entityId, provider, country]
    );

    if (existing) {
      await execute(
        `UPDATE precedents
            SET treatment = $1,
                description = COALESCE($2, description),
                last_amount = COALESCE($3, last_amount),
                last_used = CURRENT_DATE,
                times_used = times_used + 1,
                updated_at = NOW()
          WHERE id = $4`,
        [treatment, line.description, line.amount_eur, existing.id]
      );
      // Audit only when the treatment actually changed
      if (existing.treatment !== treatment) {
        await logAudit({
          entityId,
          declarationId,
          action: 'update',
          targetType: 'precedent',
          targetId: existing.id,
          field: 'treatment',
          oldValue: existing.treatment,
          newValue: treatment,
        });
      }
      updated += 1;
    } else {
      const newId = generateId();
      await execute(
        `INSERT INTO precedents (id, entity_id, provider, country, treatment,
                                  description, last_amount, last_used, times_used)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, 1)
         ON CONFLICT (entity_id, provider, country) DO UPDATE
           SET treatment = EXCLUDED.treatment,
               description = COALESCE(EXCLUDED.description, precedents.description),
               last_amount = COALESCE(EXCLUDED.last_amount, precedents.last_amount),
               last_used = CURRENT_DATE,
               times_used = precedents.times_used + 1,
               updated_at = NOW()`,
        [newId, entityId, provider, country, treatment, line.description, line.amount_eur]
      );
      await logAudit({
        entityId,
        declarationId,
        action: 'create',
        targetType: 'precedent',
        targetId: newId,
        newValue: JSON.stringify({ provider, country, treatment }),
      });
      inserted += 1;
    }
  }

  return {
    inserted,
    updated,
    skipped,
    total_lines_considered: lines.length,
  };
}
