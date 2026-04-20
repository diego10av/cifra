// ════════════════════════════════════════════════════════════════════════
// GET  /api/clients — list all active clients with entity counts
// POST /api/clients — create a new client
//
// Tolerant of migration 005 not applied: GET returns schema_missing
// 501, POST returns 501 too. Keeps the app running while Diego staggers
// migrations.
// ════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { query, queryOne, execute, generateId, logAudit } from '@/lib/db';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';
import { logger } from '@/lib/logger';

const log = logger.bind('clients');

const VALID_KINDS = ['end_client', 'csp', 'other'] as const;

function isSchemaMissing(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? '';
  return /relation ["']?clients["']? does not exist/i.test(msg);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.trim().toLowerCase() || null;
    const kind = url.searchParams.get('kind');

    const conditions: string[] = ['c.archived_at IS NULL'];
    const params: unknown[] = [];

    if (q) {
      conditions.push(`lower(c.name) LIKE $${params.length + 1}`);
      params.push(`%${q}%`);
    }
    if (kind && (VALID_KINDS as readonly string[]).includes(kind)) {
      conditions.push(`c.kind = $${params.length + 1}`);
      params.push(kind);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await query(
      `SELECT
         c.id, c.name, c.kind,
         c.vat_contact_name, c.vat_contact_email, c.vat_contact_phone,
         c.vat_contact_role, c.vat_contact_country,
         c.address, c.website, c.notes,
         c.created_at::text AS created_at,
         c.updated_at::text AS updated_at,
         COALESCE(ec.entity_count, 0)::int AS entity_count,
         COALESCE(ec.pending_registration_count, 0)::int AS pending_registration_count
       FROM clients c
       LEFT JOIN (
         SELECT client_id,
                COUNT(*)::int AS entity_count,
                COUNT(*) FILTER (WHERE vat_status = 'pending_registration')::int AS pending_registration_count
           FROM entities
          WHERE client_id IS NOT NULL
          GROUP BY client_id
       ) ec ON ec.client_id = c.id
       ${where}
       ORDER BY lower(c.name) ASC`,
      params,
    );

    return apiOk({ clients: rows });
  } catch (err) {
    if (isSchemaMissing(err)) {
      return apiError(
        'schema_missing',
        'The clients table does not exist yet. Apply migration 005 first.',
        { hint: 'See migrations/005_clients_and_approvers.sql', status: 501 },
      );
    }
    return apiFail(err, 'clients/list');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      kind?: string;
      vat_contact_name?: string | null;
      vat_contact_email?: string | null;
      vat_contact_phone?: string | null;
      vat_contact_role?: string | null;
      vat_contact_country?: string | null;
      address?: string | null;
      website?: string | null;
      notes?: string | null;
      engaged_via_name?: string | null;
      engaged_via_contact_name?: string | null;
      engaged_via_contact_email?: string | null;
      engaged_via_contact_role?: string | null;
      engaged_via_notes?: string | null;
    };

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return apiError('bad_name', 'Client name is required.', { status: 400 });
    if (name.length > 200) return apiError('name_too_long', 'Name max 200 chars.', { status: 400 });

    const kind = (VALID_KINDS as readonly string[]).includes(body.kind ?? '')
      ? (body.kind as typeof VALID_KINDS[number])
      : 'end_client';

    const vatEmail = body.vat_contact_email?.trim() || null;
    if (vatEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vatEmail)) {
      return apiError('bad_email', 'vat_contact_email is not a valid address.', { status: 400 });
    }

    // Detect duplicates — friendly error with the existing id so the UI
    // can offer "open this one" instead of blindly creating another.
    const existing = await queryOne<{ id: string; name: string }>(
      `SELECT id, name FROM clients WHERE lower(name) = lower($1) AND archived_at IS NULL`,
      [name],
    );
    if (existing) {
      return apiError(
        'duplicate_name',
        `A client named "${existing.name}" already exists.`,
        { hint: existing.id, status: 409 },
      );
    }

    const engagedEmail = body.engaged_via_contact_email?.trim() || null;
    if (engagedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(engagedEmail)) {
      return apiError('bad_engaged_via_email', 'engaged_via_contact_email is not a valid address.', { status: 400 });
    }

    const id = `client-${generateId().slice(0, 10)}`;
    await execute(
      `INSERT INTO clients (id, name, kind,
         vat_contact_name, vat_contact_email, vat_contact_phone,
         vat_contact_role, vat_contact_country,
         address, website, notes,
         engaged_via_name, engaged_via_contact_name, engaged_via_contact_email,
         engaged_via_contact_role, engaged_via_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        id, name, kind,
        body.vat_contact_name?.trim() || null,
        vatEmail,
        body.vat_contact_phone?.trim() || null,
        body.vat_contact_role?.trim() || null,
        body.vat_contact_country?.trim()?.toUpperCase().slice(0, 2) || null,
        body.address?.trim() || null,
        body.website?.trim() || null,
        body.notes?.trim() || null,
        body.engaged_via_name?.trim() || null,
        body.engaged_via_contact_name?.trim() || null,
        engagedEmail,
        body.engaged_via_contact_role?.trim() || null,
        body.engaged_via_notes?.trim() || null,
      ],
    );

    await logAudit({
      action: 'create',
      targetType: 'client',
      targetId: id,
      newValue: JSON.stringify({ name, kind }),
    });

    log.info('client created', { client_id: id, kind });
    return apiOk({ id, name, kind });
  } catch (err) {
    if (isSchemaMissing(err)) {
      return apiError('schema_missing', 'Apply migration 005 first.', { status: 501 });
    }
    return apiFail(err, 'clients/create');
  }
}
