import postgres, { type Sql, type TransactionSql } from 'postgres';
import { v4 as uuidv4 } from 'uuid';

// ═══════════════════════════════════════════════════════════════
// Module-level connection pool.
//
// Previously we spun up a brand-new postgres client per query, which on any
// serverless instance doing a loop of N queries opened N TCP + TLS sessions
// and paid the handshake for each. That was expensive and, worse, meant
// every atomic operation (create invoice + insert lines, approve + update
// precedents) had to span multiple pooled sessions with no rollback on
// failure. The audit identified this as a critical data-integrity defect.
//
// We now expose:
//   - query / queryOne / execute — individual statements on a shared pool
//   - tx(fn)                      — all statements inside fn run in a
//                                   single transaction that rolls back on
//                                   any thrown error
// ═══════════════════════════════════════════════════════════════

let pool: Sql | null = null;

function getPool(): Sql {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set');
    }
    pool = postgres(process.env.DATABASE_URL, {
      ssl: 'require',
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return pool;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ParamVal = any;

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const sql = getPool();
  const rows = await sql.unsafe(text, params as ParamVal[]);
  return rows as unknown as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function execute(text: string, params?: unknown[]): Promise<void> {
  await query(text, params);
}

// Transaction wrapper — all statements run atomically. Pass through to
// postgres.js `sql.begin(fn)`. The callback receives a TransactionSql that
// can be used directly or passed to `qTx`/`oneTx`/`execTx` helpers.
export async function tx<T>(fn: (txSql: TransactionSql) => Promise<T>): Promise<T> {
  const sql = getPool();
  return (await sql.begin(fn)) as T;
}

// Statement helpers that work inside a transaction callback.
export async function qTx<T = Record<string, unknown>>(
  txSql: TransactionSql,
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const rows = await txSql.unsafe(text, params as ParamVal[]);
  return rows as unknown as T[];
}

export async function oneTx<T = Record<string, unknown>>(
  txSql: TransactionSql,
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await qTx<T>(txSql, text, params);
  return rows[0] || null;
}

export async function execTx(
  txSql: TransactionSql,
  text: string,
  params?: unknown[]
): Promise<void> {
  await qTx(txSql, text, params);
}

// ═══════════════════════════════════════════════════════════════
// buildUpdate — safe dynamic UPDATE helper.
//
// Replaces the hand-rolled `sets: string[]; vals: unknown[]; idx = 1;` pattern
// that was duplicated across many endpoints. Hand-tracked placeholder indices
// are a known source of silent SQL bugs; this helper makes the pattern
// foolproof by building both arrays in lock-step.
// ═══════════════════════════════════════════════════════════════

export function buildUpdate(
  table: string,
  allowedFields: readonly string[],
  body: Record<string, unknown>,
  idColumn: string,
  id: string,
  extraSets: string[] = [],
): { sql: string; values: unknown[]; changes: Record<string, unknown> } {
  const sets: string[] = [];
  const values: unknown[] = [];
  const changes: Record<string, unknown> = {};
  let i = 1;
  for (const field of allowedFields) {
    if (field in body) {
      sets.push(`${field} = $${i}`);
      values.push(body[field]);
      changes[field] = body[field];
      i += 1;
    }
  }
  if (sets.length === 0) {
    return { sql: '', values: [], changes };
  }
  for (const extra of extraSets) sets.push(extra);
  values.push(id);
  return {
    sql: `UPDATE ${table} SET ${sets.join(', ')} WHERE ${idColumn} = $${i}`,
    values,
    changes,
  };
}

// ═══════════════════════════════════════════════════════════════
// Schema init — kept as no-op for backwards compatibility.
// All tables are managed via Supabase migrations now.
// ═══════════════════════════════════════════════════════════════

export async function initializeSchema(): Promise<void> {
  /* no-op: managed via Supabase migrations */
}

export function generateId(): string {
  return uuidv4();
}

// ═══════════════════════════════════════════════════════════════
// Audit log helpers. logAudit uses the shared pool; logAuditTx accepts a
// transaction handle so audit rows commit atomically with the change they
// describe (preventing orphaned audit entries).
// ═══════════════════════════════════════════════════════════════

interface AuditParams {
  userId?: string;
  entityId?: string;
  declarationId?: string;
  action: string;
  targetType: string;
  targetId: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  /** Optional free-text reason provided by the user — the "why" behind
   *  an override. Shown in the audit trail timeline and the compliance
   *  export PDF. Added in migration 008. */
  reason?: string;
}

export async function logAudit(p: AuditParams): Promise<void> {
  await execute(
    `INSERT INTO audit_log (id, user_id, entity_id, declaration_id, action,
                            target_type, target_id, field, old_value, new_value, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      generateId(), p.userId || 'founder',
      p.entityId || null, p.declarationId || null,
      p.action, p.targetType, p.targetId,
      p.field || null, p.oldValue || null, p.newValue || null,
      p.reason || null,
    ]
  );
}

export async function logAuditTx(txSql: TransactionSql, p: AuditParams): Promise<void> {
  await execTx(
    txSql,
    `INSERT INTO audit_log (id, user_id, entity_id, declaration_id, action,
                            target_type, target_id, field, old_value, new_value, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      generateId(), p.userId || 'founder',
      p.entityId || null, p.declarationId || null,
      p.action, p.targetType, p.targetId,
      p.field || null, p.oldValue || null, p.newValue || null,
      p.reason || null,
    ]
  );
}
