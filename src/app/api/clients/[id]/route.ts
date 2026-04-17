// ════════════════════════════════════════════════════════════════════════
// GET    /api/clients/[id] — client profile + its entities + totals
// PATCH  /api/clients/[id] — update any profile field
// DELETE /api/clients/[id] — soft-archive (entities that belong to it
//                            are NOT archived; you'd need to move them
//                            or explicitly archive each first)
// ════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { query, queryOne, execute, logAudit } from '@/lib/db';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';
import { logger } from '@/lib/logger';

const log = logger.bind('clients/[id]');

const VALID_KINDS = ['end_client', 'csp', 'other'] as const;

function isSchemaMissing(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? '';
  return /relation ["']?clients["']? does not exist/i.test(msg);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const client = await queryOne(
      `SELECT id, name, kind,
              vat_contact_name, vat_contact_email, vat_contact_phone,
              vat_contact_role, vat_contact_country,
              address, website, notes,
              created_at::text AS created_at,
              updated_at::text AS updated_at,
              archived_at
         FROM clients WHERE id = $1`,
      [id],
    );
    if (!client) return apiError('not_found', 'Client not found.', { status: 404 });

    const entities = await query(
      `SELECT id, name, vat_number, matricule, regime, frequency,
              entity_type, legal_form, vat_status
         FROM entities
        WHERE client_id = $1
        ORDER BY lower(name) ASC`,
      [id],
    );

    // Roll up declarations so the client page can show "3 in review, 2
    // approved" without each entity page re-querying.
    const declStats = await query<{
      status: string; n: string;
    }>(
      `SELECT d.status, COUNT(*)::text AS n
         FROM declarations d
         JOIN entities e ON d.entity_id = e.id
        WHERE e.client_id = $1
        GROUP BY d.status`,
      [id],
    );
    const declarationCounts: Record<string, number> = {};
    for (const row of declStats) declarationCounts[row.status] = Number(row.n) || 0;

    return apiOk({
      client,
      entities,
      declaration_counts: declarationCounts,
    });
  } catch (err) {
    if (isSchemaMissing(err)) {
      return apiError('schema_missing', 'Apply migration 005 first.', { status: 501 });
    }
    return apiFail(err, 'clients/get');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const existing = await queryOne<{ id: string }>('SELECT id FROM clients WHERE id = $1', [id]);
    if (!existing) return apiError('not_found', 'Client not found.', { status: 404 });

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    const stringFields = [
      'name', 'vat_contact_name', 'vat_contact_email', 'vat_contact_phone',
      'vat_contact_role', 'vat_contact_country',
      'address', 'website', 'notes',
    ] as const;

    for (const f of stringFields) {
      if (body[f] !== undefined) {
        const raw = body[f];
        if (raw !== null && typeof raw !== 'string') {
          return apiError(`bad_${f}`, `${f} must be a string or null.`, { status: 400 });
        }
        let value: string | null = typeof raw === 'string' ? raw.trim() : null;
        if (value === '') value = null;
        if (f === 'vat_contact_country' && value) {
          value = value.toUpperCase().slice(0, 2);
        }
        if (f === 'name' && (!value || value.length === 0)) {
          return apiError('bad_name', 'name cannot be empty.', { status: 400 });
        }
        if (f === 'vat_contact_email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return apiError('bad_email', 'vat_contact_email is invalid.', { status: 400 });
        }
        sets.push(`${f} = $${i++}`);
        vals.push(value);
      }
    }

    if (typeof body.kind === 'string') {
      if (!(VALID_KINDS as readonly string[]).includes(body.kind)) {
        return apiError('bad_kind', `kind must be one of: ${VALID_KINDS.join(', ')}`, { status: 400 });
      }
      sets.push(`kind = $${i++}`);
      vals.push(body.kind);
    }

    if (sets.length === 0) {
      return apiError('no_changes', 'Nothing to update.', { status: 400 });
    }

    vals.push(id);
    await execute(`UPDATE clients SET ${sets.join(', ')} WHERE id = $${i}`, vals);

    await logAudit({
      action: 'update',
      targetType: 'client',
      targetId: id,
      newValue: JSON.stringify(body),
    });

    log.info('client updated', { client_id: id, fields: Object.keys(body) });
    return apiOk({ ok: true });
  } catch (err) {
    if (isSchemaMissing(err)) {
      return apiError('schema_missing', 'Apply migration 005 first.', { status: 501 });
    }
    return apiFail(err, 'clients/patch');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const existing = await queryOne<{ id: string; archived_at: string | null }>(
      'SELECT id, archived_at FROM clients WHERE id = $1',
      [id],
    );
    if (!existing) return apiError('not_found', 'Client not found.', { status: 404 });
    if (existing.archived_at) return apiOk({ already_archived: true });

    // Safety check: refuse to archive a client with active entities.
    // The user must move or explicitly archive entities first. Avoids
    // orphaning live workflows.
    const activeEntities = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM entities WHERE client_id = $1`,
      [id],
    );
    if (Number(activeEntities?.n) > 0) {
      return apiError(
        'has_entities',
        `This client owns ${activeEntities?.n} entities. Move or archive them first.`,
        { status: 409 },
      );
    }

    await execute(`UPDATE clients SET archived_at = NOW() WHERE id = $1`, [id]);
    await logAudit({
      action: 'archive',
      targetType: 'client',
      targetId: id,
    });

    log.info('client archived', { client_id: id });
    return apiOk({ ok: true });
  } catch (err) {
    if (isSchemaMissing(err)) {
      return apiError('schema_missing', 'Apply migration 005 first.', { status: 501 });
    }
    return apiFail(err, 'clients/delete');
  }
}
