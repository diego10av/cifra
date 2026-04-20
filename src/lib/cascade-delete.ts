// ════════════════════════════════════════════════════════════════════════
// Cascade-delete helpers — clients + entities + declarations.
//
// Schema note (verified 2026-04-20):
//   clients → entities (RESTRICT, client_contacts CASCADE)
//   entities → declarations (NO ACTION), entity_approvers CASCADE,
//              entity_prorata CASCADE, aed_communications NO ACTION,
//              precedents NO ACTION, registrations NO ACTION,
//              chat_threads SET NULL, feedback SET NULL
//   declarations → invoices NO ACTION, invoice_lines NO ACTION,
//                  documents NO ACTION, validator_findings CASCADE,
//                  chat_threads SET NULL, feedback SET NULL
//   invoices → invoice_lines NO ACTION, invoice_attachments CASCADE,
//              validator_findings CASCADE
//
// Because several FKs are NO ACTION, a naïve DELETE on any parent
// raises 23503. This module does the explicit ordered delete inside
// a single SQL CTE so the whole thing is atomic.
//
// Stint 13 (2026-04-20): Diego asked for cascade delete to clear
// test data — the Gassner-audit gap that the soft-archive didn't fill.
// ════════════════════════════════════════════════════════════════════════

import { query, queryOne, execute } from './db';

export interface DeletionPreview {
  client_id?: string;
  entity_id?: string;
  declaration_id?: string;
  name?: string;
  counts: {
    clients?: number;        // always 0 or 1
    entities: number;
    declarations: number;
    invoices: number;
    invoice_lines: number;
    documents: number;
    aed_communications: number;
    precedents: number;
    registrations: number;
    entity_approvers: number;
    entity_prorata: number;
    client_contacts: number;
    validator_findings: number;
    invoice_attachments: number;
  };
}

/**
 * Compute a preview of what a client cascade-delete would remove.
 * Used by the confirm-modal to show the reviewer the blast radius.
 */
export async function previewClientDelete(clientId: string): Promise<DeletionPreview | null> {
  const client = await queryOne<{ id: string; name: string }>(
    `SELECT id, name FROM clients WHERE id = $1`,
    [clientId],
  );
  if (!client) return null;

  const row = await queryOne<Record<string, string>>(
    `SELECT
       (SELECT COUNT(*)::text FROM entities WHERE client_id = $1) AS entities,
       (SELECT COUNT(*)::text FROM declarations d
         JOIN entities e ON d.entity_id = e.id WHERE e.client_id = $1) AS declarations,
       (SELECT COUNT(*)::text FROM invoices i
         JOIN declarations d ON i.declaration_id = d.id
         JOIN entities e ON d.entity_id = e.id WHERE e.client_id = $1) AS invoices,
       (SELECT COUNT(*)::text FROM invoice_lines il
         JOIN declarations d ON il.declaration_id = d.id
         JOIN entities e ON d.entity_id = e.id WHERE e.client_id = $1) AS invoice_lines,
       (SELECT COUNT(*)::text FROM documents dc
         JOIN declarations d ON dc.declaration_id = d.id
         JOIN entities e ON d.entity_id = e.id WHERE e.client_id = $1) AS documents,
       (SELECT COUNT(*)::text FROM aed_communications a
         JOIN entities e ON a.entity_id = e.id WHERE e.client_id = $1) AS aed,
       (SELECT COUNT(*)::text FROM precedents p
         JOIN entities e ON p.entity_id = e.id WHERE e.client_id = $1) AS precedents,
       (SELECT COUNT(*)::text FROM registrations r
         JOIN entities e ON r.entity_id = e.id WHERE e.client_id = $1) AS registrations,
       (SELECT COUNT(*)::text FROM entity_approvers ea
         JOIN entities e ON ea.entity_id = e.id WHERE e.client_id = $1) AS approvers,
       (SELECT COUNT(*)::text FROM entity_prorata ep
         JOIN entities e ON ep.entity_id = e.id WHERE e.client_id = $1) AS prorata,
       (SELECT COUNT(*)::text FROM client_contacts WHERE client_id = $1) AS contacts,
       (SELECT COUNT(*)::text FROM validator_findings vf
         JOIN declarations d ON vf.declaration_id = d.id
         JOIN entities e ON d.entity_id = e.id WHERE e.client_id = $1) AS findings,
       (SELECT COUNT(*)::text FROM invoice_attachments ia
         JOIN invoices i ON ia.invoice_id = i.id
         JOIN declarations d ON i.declaration_id = d.id
         JOIN entities e ON d.entity_id = e.id WHERE e.client_id = $1) AS attachments`,
    [clientId],
  );

  return {
    client_id: client.id,
    name: client.name,
    counts: {
      clients: 1,
      entities: Number(row?.entities ?? 0),
      declarations: Number(row?.declarations ?? 0),
      invoices: Number(row?.invoices ?? 0),
      invoice_lines: Number(row?.invoice_lines ?? 0),
      documents: Number(row?.documents ?? 0),
      aed_communications: Number(row?.aed ?? 0),
      precedents: Number(row?.precedents ?? 0),
      registrations: Number(row?.registrations ?? 0),
      entity_approvers: Number(row?.approvers ?? 0),
      entity_prorata: Number(row?.prorata ?? 0),
      client_contacts: Number(row?.contacts ?? 0),
      validator_findings: Number(row?.findings ?? 0),
      invoice_attachments: Number(row?.attachments ?? 0),
    },
  };
}

/**
 * Hard delete a client + everything underneath it. Ordered explicitly
 * because several FKs are NO ACTION (see schema note at top).
 *
 * Runs inside a single SQL statement via a chained WITH; any failure
 * rolls back the whole thing.
 */
export async function cascadeDeleteClient(clientId: string): Promise<void> {
  await execute(
    `WITH
       ents AS (SELECT id FROM entities WHERE client_id = $1),
       decls AS (SELECT d.id FROM declarations d JOIN ents ON d.entity_id = ents.id),
       invs AS (SELECT i.id FROM invoices i JOIN decls ON i.declaration_id = decls.id),
       del_lines AS (DELETE FROM invoice_lines WHERE declaration_id IN (SELECT id FROM decls) RETURNING 1),
       del_docs AS (DELETE FROM documents WHERE declaration_id IN (SELECT id FROM decls) RETURNING 1),
       del_findings AS (DELETE FROM validator_findings WHERE declaration_id IN (SELECT id FROM decls) RETURNING 1),
       del_invs AS (DELETE FROM invoices WHERE declaration_id IN (SELECT id FROM decls) RETURNING 1),
       del_decls AS (DELETE FROM declarations WHERE id IN (SELECT id FROM decls) RETURNING 1),
       del_aed AS (DELETE FROM aed_communications WHERE entity_id IN (SELECT id FROM ents) RETURNING 1),
       del_prec AS (DELETE FROM precedents WHERE entity_id IN (SELECT id FROM ents) RETURNING 1),
       del_reg AS (DELETE FROM registrations WHERE entity_id IN (SELECT id FROM ents) RETURNING 1),
       del_ents AS (DELETE FROM entities WHERE id IN (SELECT id FROM ents) RETURNING 1)
     DELETE FROM clients WHERE id = $1`,
    [clientId],
  );
}

/**
 * Entity-level preview.
 */
export async function previewEntityDelete(entityId: string): Promise<DeletionPreview | null> {
  const e = await queryOne<{ id: string; name: string }>(
    `SELECT id, name FROM entities WHERE id = $1`,
    [entityId],
  );
  if (!e) return null;

  const row = await queryOne<Record<string, string>>(
    `SELECT
       (SELECT COUNT(*)::text FROM declarations WHERE entity_id = $1) AS declarations,
       (SELECT COUNT(*)::text FROM invoices i JOIN declarations d ON i.declaration_id = d.id WHERE d.entity_id = $1) AS invoices,
       (SELECT COUNT(*)::text FROM invoice_lines WHERE declaration_id IN
          (SELECT id FROM declarations WHERE entity_id = $1)) AS invoice_lines,
       (SELECT COUNT(*)::text FROM documents WHERE declaration_id IN
          (SELECT id FROM declarations WHERE entity_id = $1)) AS documents,
       (SELECT COUNT(*)::text FROM aed_communications WHERE entity_id = $1) AS aed,
       (SELECT COUNT(*)::text FROM precedents WHERE entity_id = $1) AS precedents,
       (SELECT COUNT(*)::text FROM registrations WHERE entity_id = $1) AS registrations,
       (SELECT COUNT(*)::text FROM entity_approvers WHERE entity_id = $1) AS approvers,
       (SELECT COUNT(*)::text FROM entity_prorata WHERE entity_id = $1) AS prorata,
       (SELECT COUNT(*)::text FROM validator_findings vf
         JOIN declarations d ON vf.declaration_id = d.id WHERE d.entity_id = $1) AS findings,
       (SELECT COUNT(*)::text FROM invoice_attachments ia
         JOIN invoices i ON ia.invoice_id = i.id
         JOIN declarations d ON i.declaration_id = d.id WHERE d.entity_id = $1) AS attachments`,
    [entityId],
  );

  return {
    entity_id: e.id,
    name: e.name,
    counts: {
      entities: 1,
      declarations: Number(row?.declarations ?? 0),
      invoices: Number(row?.invoices ?? 0),
      invoice_lines: Number(row?.invoice_lines ?? 0),
      documents: Number(row?.documents ?? 0),
      aed_communications: Number(row?.aed ?? 0),
      precedents: Number(row?.precedents ?? 0),
      registrations: Number(row?.registrations ?? 0),
      entity_approvers: Number(row?.approvers ?? 0),
      entity_prorata: Number(row?.prorata ?? 0),
      client_contacts: 0,
      validator_findings: Number(row?.findings ?? 0),
      invoice_attachments: Number(row?.attachments ?? 0),
    },
  };
}

export async function cascadeDeleteEntity(entityId: string): Promise<void> {
  await execute(
    `WITH
       decls AS (SELECT id FROM declarations WHERE entity_id = $1),
       del_lines AS (DELETE FROM invoice_lines WHERE declaration_id IN (SELECT id FROM decls) RETURNING 1),
       del_docs AS (DELETE FROM documents WHERE declaration_id IN (SELECT id FROM decls) RETURNING 1),
       del_findings AS (DELETE FROM validator_findings WHERE declaration_id IN (SELECT id FROM decls) RETURNING 1),
       del_invs AS (DELETE FROM invoices WHERE declaration_id IN (SELECT id FROM decls) RETURNING 1),
       del_decls AS (DELETE FROM declarations WHERE id IN (SELECT id FROM decls) RETURNING 1),
       del_aed AS (DELETE FROM aed_communications WHERE entity_id = $1 RETURNING 1),
       del_prec AS (DELETE FROM precedents WHERE entity_id = $1 RETURNING 1),
       del_reg AS (DELETE FROM registrations WHERE entity_id = $1 RETURNING 1)
     DELETE FROM entities WHERE id = $1`,
    [entityId],
  );
}

/**
 * Declaration-level preview (just the lines/invoices/documents under it).
 */
export async function previewDeclarationDelete(declarationId: string): Promise<DeletionPreview | null> {
  const d = await queryOne<{ id: string; year: number; period: string }>(
    `SELECT id, year, period FROM declarations WHERE id = $1`,
    [declarationId],
  );
  if (!d) return null;

  const row = await queryOne<Record<string, string>>(
    `SELECT
       (SELECT COUNT(*)::text FROM invoices WHERE declaration_id = $1) AS invoices,
       (SELECT COUNT(*)::text FROM invoice_lines WHERE declaration_id = $1) AS invoice_lines,
       (SELECT COUNT(*)::text FROM documents WHERE declaration_id = $1) AS documents,
       (SELECT COUNT(*)::text FROM validator_findings WHERE declaration_id = $1) AS findings,
       (SELECT COUNT(*)::text FROM invoice_attachments ia
         JOIN invoices i ON ia.invoice_id = i.id WHERE i.declaration_id = $1) AS attachments`,
    [declarationId],
  );

  return {
    declaration_id: d.id,
    name: `${d.year} ${d.period}`,
    counts: {
      entities: 0,
      declarations: 1,
      invoices: Number(row?.invoices ?? 0),
      invoice_lines: Number(row?.invoice_lines ?? 0),
      documents: Number(row?.documents ?? 0),
      aed_communications: 0,
      precedents: 0,
      registrations: 0,
      entity_approvers: 0,
      entity_prorata: 0,
      client_contacts: 0,
      validator_findings: Number(row?.findings ?? 0),
      invoice_attachments: Number(row?.attachments ?? 0),
    },
  };
}

/**
 * Human-readable summary of a preview, suitable for a confirm-modal.
 * Returns [line, line, …] — caller decides how to render.
 */
export function summarisePreview(preview: DeletionPreview): string[] {
  const c = preview.counts;
  const items: string[] = [];
  if (c.clients) items.push(`1 client (${preview.name})`);
  if (c.entities) items.push(`${c.entities} ${c.entities === 1 ? 'entity' : 'entities'}`);
  if (c.declarations) items.push(`${c.declarations} declaration${c.declarations === 1 ? '' : 's'}`);
  if (c.invoices) items.push(`${c.invoices} invoice${c.invoices === 1 ? '' : 's'}`);
  if (c.invoice_lines) items.push(`${c.invoice_lines} classified line${c.invoice_lines === 1 ? '' : 's'}`);
  if (c.documents) items.push(`${c.documents} uploaded document${c.documents === 1 ? '' : 's'}`);
  if (c.aed_communications) items.push(`${c.aed_communications} AED letter${c.aed_communications === 1 ? '' : 's'}`);
  if (c.precedents) items.push(`${c.precedents} precedent${c.precedents === 1 ? '' : 's'}`);
  if (c.registrations) items.push(`${c.registrations} registration event${c.registrations === 1 ? '' : 's'}`);
  if (c.entity_approvers) items.push(`${c.entity_approvers} approver${c.entity_approvers === 1 ? '' : 's'}`);
  if (c.entity_prorata) items.push(`${c.entity_prorata} pro-rata configuration${c.entity_prorata === 1 ? '' : 's'}`);
  if (c.client_contacts) items.push(`${c.client_contacts} client contact${c.client_contacts === 1 ? '' : 's'}`);
  if (c.invoice_attachments) items.push(`${c.invoice_attachments} attachment${c.invoice_attachments === 1 ? '' : 's'}`);
  if (c.validator_findings) items.push(`${c.validator_findings} validator finding${c.validator_findings === 1 ? '' : 's'}`);

  // Debugging / unused-var suppression — query() used by caller even if not here.
  void query;
  return items;
}
