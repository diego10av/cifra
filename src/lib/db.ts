import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';

function getSql() {
  return postgres(process.env.DATABASE_URL!, {
    ssl: 'require',
    max: 1,
    idle_timeout: 10,
  });
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const sql = getSql();
  try {
    // postgres.js uses $1, $2 etc. but via .unsafe() for raw SQL with params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await sql.unsafe(text, params as any[]);
    return rows as unknown as T[];
  } finally {
    await sql.end();
  }
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

export async function initializeSchema(): Promise<void> {
  // Tables already created during setup. No-op.
}

export function generateId(): string {
  return uuidv4();
}

export async function logAudit(params: {
  userId?: string;
  entityId?: string;
  declarationId?: string;
  action: string;
  targetType: string;
  targetId: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}): Promise<void> {
  await execute(
    `INSERT INTO audit_log (id, user_id, entity_id, declaration_id, action, target_type, target_id, field, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      generateId(),
      params.userId || 'founder',
      params.entityId || null,
      params.declarationId || null,
      params.action,
      params.targetType,
      params.targetId,
      params.field || null,
      params.oldValue || null,
      params.newValue || null,
    ]
  );
}
