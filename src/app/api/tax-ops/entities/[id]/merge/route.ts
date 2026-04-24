import { NextRequest, NextResponse } from 'next/server';
import { tx, qTx, execTx, logAuditTx } from '@/lib/db';

// POST /api/tax-ops/entities/[id]/merge
//   Body: { source_entity_ids: string[] }
//
// Stint 40.A entity merge. Runs in a single transaction:
//   1. For each source, reassign every tax_obligation to the target
//      entity (filings hang off obligation_id, so they come with it).
//   2. If two obligations collide on (tax_type, period_pattern,
//      service_kind) for the target, the source's obligation is marked
//      is_active=FALSE (kept for audit, not surfaced in matrices).
//   3. Source entities are marked is_active=FALSE with a note appended
//      ("[Merged into <target_id> on <date>]").
//   4. An audit_log entry ties the merge together.
//
// Notes:
// - Never cascade-deletes a source entity. Keep history intact.
// - Target must be active + exist. Sources must exist.
// - Can't merge an entity into itself (returns 400).

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: targetId } = await params;
  const body = await request.json() as { source_entity_ids?: unknown };
  const sourceIdsRaw = body?.source_entity_ids;
  if (!Array.isArray(sourceIdsRaw) || sourceIdsRaw.length === 0) {
    return NextResponse.json(
      { error: 'source_entity_ids must be a non-empty array' },
      { status: 400 },
    );
  }
  const sourceIds = sourceIdsRaw.filter((x): x is string => typeof x === 'string');
  if (sourceIds.includes(targetId)) {
    return NextResponse.json(
      { error: 'cannot merge an entity into itself' },
      { status: 400 },
    );
  }

  try {
    const result = await tx(async (client) => {
      // Verify target exists + active
      const targetRows = await qTx<{ legal_name: string; is_active: boolean }>(
        client,
        `SELECT legal_name, is_active FROM tax_entities WHERE id = $1`,
        [targetId],
      );
      if (targetRows.length === 0) {
        throw new Error('target_not_found');
      }
      if (!targetRows[0]!.is_active) {
        throw new Error('target_not_active');
      }
      const targetName = targetRows[0]!.legal_name;

      // Verify sources exist
      const sourceRows = await qTx<{ id: string; legal_name: string }>(
        client,
        `SELECT id, legal_name FROM tax_entities WHERE id = ANY($1::text[])`,
        [sourceIds],
      );
      if (sourceRows.length !== sourceIds.length) {
        throw new Error('source_not_found');
      }

      // Existing obligations on the target — we need to know which
      // (tax_type, period_pattern, service_kind) tuples are taken.
      const targetObligations = await qTx<{
        id: string; tax_type: string; period_pattern: string; service_kind: string;
      }>(
        client,
        `SELECT id, tax_type, period_pattern, service_kind
           FROM tax_obligations
          WHERE entity_id = $1 AND is_active = TRUE`,
        [targetId],
      );
      const takenKey = new Set(
        targetObligations.map(o => `${o.tax_type}|${o.period_pattern}|${o.service_kind}`),
      );

      let movedObligations = 0;
      let deactivatedObligations = 0;

      for (const sourceId of sourceIds) {
        const sourceObligations = await qTx<{
          id: string; tax_type: string; period_pattern: string; service_kind: string;
        }>(
          client,
          `SELECT id, tax_type, period_pattern, service_kind
             FROM tax_obligations
            WHERE entity_id = $1`,
          [sourceId],
        );
        for (const o of sourceObligations) {
          const key = `${o.tax_type}|${o.period_pattern}|${o.service_kind}`;
          if (takenKey.has(key)) {
            // Collision — deactivate the source's obligation (keep row
            // for audit; filings remain visible as historical via
            // obligation_id FK).
            await execTx(
              client,
              `UPDATE tax_obligations SET is_active = FALSE, updated_at = NOW() WHERE id = $1`,
              [o.id],
            );
            deactivatedObligations += 1;
          } else {
            // Reassign obligation (and, transitively, all its filings)
            // to the target entity.
            await execTx(
              client,
              `UPDATE tax_obligations SET entity_id = $1, updated_at = NOW() WHERE id = $2`,
              [targetId, o.id],
            );
            takenKey.add(key);
            movedObligations += 1;
          }
        }

        // Mark source entity inactive + annotate notes for audit trail.
        await execTx(
          client,
          `UPDATE tax_entities
             SET is_active = FALSE,
                 notes = COALESCE(notes, '') ||
                         CASE WHEN notes IS NULL OR notes = '' THEN '' ELSE E'\n' END ||
                         '[Merged into ' || $1 || ' on ' || TO_CHAR(NOW(), 'YYYY-MM-DD') || ']',
                 updated_at = NOW()
           WHERE id = $2`,
          [targetId, sourceId],
        );
      }

      // Audit entry — enough detail to manually revert if needed.
      await logAuditTx(client, {
        userId: 'founder',
        action: 'tax_entity_merge',
        targetType: 'tax_entity',
        targetId,
        newValue: JSON.stringify({
          target_entity_id: targetId,
          target_entity_name: targetName,
          source_entity_ids: sourceIds,
          source_entity_names: sourceRows.map(r => r.legal_name),
          moved_obligations: movedObligations,
          deactivated_obligations: deactivatedObligations,
        }),
      });

      return {
        target_entity_id: targetId,
        source_entity_ids: sourceIds,
        moved_obligations: movedObligations,
        deactivated_obligations: deactivatedObligations,
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    const status = msg === 'target_not_found' || msg === 'target_not_active'
      ? 404
      : msg === 'source_not_found'
        ? 400
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
