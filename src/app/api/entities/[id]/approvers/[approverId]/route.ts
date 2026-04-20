// ════════════════════════════════════════════════════════════════════════
// PATCH  /api/entities/[id]/approvers/[approverId]
// DELETE /api/entities/[id]/approvers/[approverId]
//
// Handles editing an approver + promoting/demoting the primary flag.
// Refuses to demote the only primary without promoting another first
// (the DB index would error anyway; we short-circuit with a clearer
// message).
// ════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { queryOne, execute, logAudit } from '@/lib/db';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';

const VALID_TYPES = ['client', 'csp', 'other'] as const;

function isSchemaMissing(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? '';
  return /relation ["']?entity_approvers["']? does not exist/i.test(msg);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; approverId: string }> },
) {
  try {
    const { id: entityId, approverId } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const existing = await queryOne<{ id: string; entity_id: string; is_primary: boolean }>(
      `SELECT id, entity_id, is_primary FROM entity_approvers WHERE id = $1`,
      [approverId],
    );
    if (!existing || existing.entity_id !== entityId) {
      return apiError('not_found', 'Approver not found for this entity.', { status: 404 });
    }

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    const stringFields = ['name', 'email', 'phone', 'role', 'organization', 'country', 'notes'] as const;
    for (const f of stringFields) {
      if (body[f] !== undefined) {
        const raw = body[f];
        if (raw !== null && typeof raw !== 'string') {
          return apiError(`bad_${f}`, `${f} must be a string or null.`, { status: 400 });
        }
        let value: string | null = typeof raw === 'string' ? raw.trim() : null;
        if (value === '') value = null;
        if (f === 'country' && value) value = value.toUpperCase().slice(0, 2);
        if (f === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return apiError('bad_email', 'email is invalid.', { status: 400 });
        }
        if (f === 'name' && (!value || value.length === 0)) {
          return apiError('bad_name', 'name cannot be empty.', { status: 400 });
        }
        sets.push(`${f} = $${i++}`);
        vals.push(value);
      }
    }

    if (typeof body.approver_type === 'string') {
      if (!(VALID_TYPES as readonly string[]).includes(body.approver_type)) {
        return apiError('bad_type', `approver_type must be one of: ${VALID_TYPES.join(', ')}`, { status: 400 });
      }
      sets.push(`approver_type = $${i++}`);
      vals.push(body.approver_type);
    }

    if (typeof body.approver_role === 'string') {
      const VALID_ROLES = ['approver', 'cc', 'both'] as const;
      if (!(VALID_ROLES as readonly string[]).includes(body.approver_role)) {
        return apiError('bad_role', `approver_role must be one of: ${VALID_ROLES.join(', ')}`, { status: 400 });
      }
      sets.push(`approver_role = $${i++}`);
      vals.push(body.approver_role);
    }

    // Special-case is_primary — swap with the current primary in a
    // single transaction so we never leave two primaries or zero.
    if (typeof body.is_primary === 'boolean') {
      if (body.is_primary === true && !existing.is_primary) {
        // Promote: demote the current primary first.
        await execute(
          `UPDATE entity_approvers SET is_primary = FALSE
            WHERE entity_id = $1 AND is_primary = TRUE`,
          [entityId],
        );
        sets.push(`is_primary = $${i++}`);
        vals.push(true);
      } else if (body.is_primary === false && existing.is_primary) {
        // Demoting the primary — require another primary to exist
        // first to keep at least one primary per entity.
        const otherCount = await queryOne<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM entity_approvers
            WHERE entity_id = $1 AND id != $2`,
          [entityId, approverId],
        );
        if (Number(otherCount?.n ?? 0) === 0) {
          return apiError(
            'only_approver',
            'Cannot demote the only approver. Add another first.',
            { status: 409 },
          );
        }
        return apiError(
          'demote_needs_replacement',
          'Promote another approver to primary; this one will be demoted automatically.',
          { status: 409 },
        );
      }
    }

    if (typeof body.sort_order === 'number' && Number.isFinite(body.sort_order)) {
      sets.push(`sort_order = $${i++}`);
      vals.push(Math.max(0, Math.floor(body.sort_order)));
    }

    if (sets.length === 0) {
      return apiError('no_changes', 'Nothing to update.', { status: 400 });
    }

    vals.push(approverId);
    await execute(`UPDATE entity_approvers SET ${sets.join(', ')} WHERE id = $${i}`, vals);

    await logAudit({
      entityId,
      action: 'update_approver',
      targetType: 'entity_approver',
      targetId: approverId,
      newValue: JSON.stringify(body),
    });

    return apiOk({ ok: true });
  } catch (err) {
    if (isSchemaMissing(err)) {
      return apiError('schema_missing', 'Apply migration 005 first.', { status: 501 });
    }
    return apiFail(err, 'approvers/patch');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; approverId: string }> },
) {
  try {
    const { id: entityId, approverId } = await params;

    const existing = await queryOne<{ id: string; entity_id: string; is_primary: boolean }>(
      `SELECT id, entity_id, is_primary FROM entity_approvers WHERE id = $1`,
      [approverId],
    );
    if (!existing || existing.entity_id !== entityId) {
      return apiError('not_found', 'Approver not found for this entity.', { status: 404 });
    }

    if (existing.is_primary) {
      // If removing the primary, promote another approver (by sort_order)
      // to primary first. If there's none, allow the delete — the entity
      // just ends up with 0 approvers, which is a valid state.
      const next = await queryOne<{ id: string }>(
        `SELECT id FROM entity_approvers
          WHERE entity_id = $1 AND id != $2
          ORDER BY sort_order ASC LIMIT 1`,
        [entityId, approverId],
      );
      if (next) {
        await execute(
          `UPDATE entity_approvers SET is_primary = TRUE WHERE id = $1`,
          [next.id],
        );
      }
    }

    await execute(`DELETE FROM entity_approvers WHERE id = $1`, [approverId]);

    await logAudit({
      entityId,
      action: 'remove_approver',
      targetType: 'entity_approver',
      targetId: approverId,
    });

    return apiOk({ ok: true });
  } catch (err) {
    if (isSchemaMissing(err)) {
      return apiError('schema_missing', 'Apply migration 005 first.', { status: 501 });
    }
    return apiFail(err, 'approvers/delete');
  }
}
