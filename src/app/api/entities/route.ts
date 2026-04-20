import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, generateId, logAudit, initializeSchema } from '@/lib/db';

// GET /api/entities - list all entities
export async function GET() {
  await initializeSchema();
  const entities = await query('SELECT * FROM entities WHERE deleted_at IS NULL ORDER BY name ASC');
  return NextResponse.json(entities);
}

// POST /api/entities - create a new entity
//
// 2026-04-18 (migration 005): entities now belong to a client. The
// client_id is required once migration 005 lands, but we tolerate the
// legacy `client_name`/`csp_name` path too so the form can migrate
// gradually. If neither client_id nor a legacy client_name is provided,
// we return 400 — we never silently create orphan entities.
export async function POST(request: NextRequest) {
  await initializeSchema();
  const body = await request.json();
  const id = generateId();

  const vatStatus = ['registered', 'pending_registration', 'not_applicable'].includes(body.vat_status)
    ? body.vat_status
    : 'registered';

  // Resolve the parent client. Preferred: body.client_id points at an
  // existing client. Fallback: legacy body.client_name creates a new
  // client on the fly. If neither is present, block creation.
  let clientId: string | null = null;
  if (typeof body.client_id === 'string' && body.client_id.trim()) {
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM clients WHERE id = $1',
      [body.client_id.trim()],
    );
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'client_not_found', message: 'client_id does not match an existing client.' } },
        { status: 400 },
      );
    }
    clientId = existing.id;
  } else if (typeof body.client_name === 'string' && body.client_name.trim()) {
    // Legacy path: create a client from the inline name + email so
    // existing form submissions don't 400. We try to reuse an existing
    // client with the same name before creating a duplicate.
    const trimmed = body.client_name.trim();
    try {
      const existing = await queryOne<{ id: string }>(
        'SELECT id FROM clients WHERE lower(name) = lower($1) AND archived_at IS NULL',
        [trimmed],
      );
      if (existing) {
        clientId = existing.id;
      } else {
        clientId = `client-${generateId().slice(0, 10)}`;
        await execute(
          `INSERT INTO clients (id, name, kind, vat_contact_name, vat_contact_email)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            clientId,
            trimmed,
            body.csp_name ? 'csp' : 'end_client',
            trimmed,
            body.client_email || body.csp_email || null,
          ],
        );
      }
    } catch {
      // clients table missing (migration 005 not applied yet). Proceed
      // with the legacy columns only; UI will backfill later.
      clientId = null;
    }
  }

  await execute(
    `INSERT INTO entities (id, client_id, name, vat_number, matricule, rcs_number, legal_form, entity_type,
      regime, frequency, address, bank_iban, bank_bic, tax_office,
      client_name, client_email, csp_name, csp_email,
      has_fx, has_outgoing, has_recharges, notes, vat_status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
    [
      id, clientId, body.name,
      body.vat_number || null, body.matricule || null, body.rcs_number || null,
      body.legal_form || null, body.entity_type || null,
      body.regime || 'simplified', body.frequency || 'annual',
      body.address || null, body.bank_iban || null, body.bank_bic || null, body.tax_office || null,
      body.client_name || null, body.client_email || null,
      body.csp_name || null, body.csp_email || null,
      !!body.has_fx, !!body.has_outgoing, !!body.has_recharges,
      body.notes || null,
      vatStatus,
    ]
  );

  await logAudit({
    entityId: id, action: 'create', targetType: 'entity', targetId: id,
    newValue: JSON.stringify(body),
  });

  // Auto-populate entity approvers from the client's contact roster.
  // When the parent client has client_contacts:
  //   - the is_main=true contact becomes the entity's primary approver
  //   - any other contact with contact_role in ('approver','cc','both')
  //     becomes a secondary approver with the matching role
  // This saves the reviewer from re-typing the same contact on every
  // entity under a client. Diego specifically asked for this on
  // 2026-04-20.
  //
  // Soft-fails: if client_contacts table is missing (migration 012
  // not applied) or the client has no contacts, the entity is created
  // without approvers — the user can add them manually via
  // ApproversCard.
  if (clientId) {
    try {
      const contacts = await queryAll<{
        id: string; name: string; email: string | null; phone: string | null;
        role: string | null; organization: string | null; country: string | null;
        is_main: boolean; contact_role: string;
      }>(
        `SELECT id, name, email, phone, role, organization, country, is_main, contact_role
           FROM client_contacts
          WHERE client_id = $1
          ORDER BY is_main DESC, lower(name) ASC`,
        [clientId],
      );
      let sortOrder = 0;
      for (const c of contacts) {
        const approverId = `appr-${generateId().slice(0, 10)}`;
        const isPrimary = c.is_main && sortOrder === 0;
        await execute(
          `INSERT INTO entity_approvers
             (id, entity_id, name, email, phone, role, organization,
              country, approver_type, is_primary, sort_order, notes,
              client_contact_id, approver_role)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            approverId, id, c.name, c.email, c.phone, c.role,
            c.organization, c.country,
            'client',
            isPrimary,
            sortOrder,
            null,
            c.id,
            c.contact_role || 'approver',
          ],
        );
        sortOrder += 1;
      }
    } catch {
      // client_contacts table missing or other failure — non-fatal.
    }
  }

  const entity = await queryOne('SELECT * FROM entities WHERE id = $1', [id]);
  return NextResponse.json(entity, { status: 201 });
}

// Small helper local to this module — wraps the shared query() but
// typed to return an array explicitly.
async function queryAll<T>(sql: string, params: unknown[]): Promise<T[]> {
  const { query } = await import('@/lib/db');
  return query<T>(sql, params);
}
