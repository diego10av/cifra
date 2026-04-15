// Job tracker for long-running operations (extract, classify, fill-fx).
// Writes progress to the `jobs` table so the UI can poll.

import { execute, queryOne, generateId } from '@/lib/db';

export type JobKind = 'extract' | 'classify' | 'fill_fx';
export type JobStatus = 'running' | 'done' | 'error' | 'cancelled';

export interface Job {
  id: string;
  declaration_id: string | null;
  kind: JobKind;
  status: JobStatus;
  total: number;
  processed: number;
  current_item: string | null;
  message: string | null;
  error_message: string | null;
  cancel_requested: boolean;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
}

export async function createJob(params: {
  kind: JobKind;
  declaration_id?: string | null;
  total?: number;
}): Promise<string> {
  const id = generateId();
  await execute(
    `INSERT INTO jobs (id, declaration_id, kind, status, total, processed)
     VALUES ($1, $2, $3, 'running', $4, 0)`,
    [id, params.declaration_id || null, params.kind, params.total || 0]
  );
  return id;
}

export async function updateJob(id: string, patch: Partial<{
  processed: number;
  total: number;
  current_item: string | null;
  message: string | null;
  status: JobStatus;
  error_message: string | null;
  finished_at: Date | null;
}>): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (k === 'finished_at') {
      sets.push(`${k} = $${i++}::timestamptz`);
      vals.push(v ? (v as Date).toISOString() : null);
    } else {
      sets.push(`${k} = $${i++}`);
      vals.push(v);
    }
  }
  sets.push('updated_at = NOW()');
  vals.push(id);
  await execute(`UPDATE jobs SET ${sets.join(', ')} WHERE id = $${i}`, vals);
}

export async function finishJob(id: string, status: JobStatus, message?: string | null, error?: string | null) {
  await execute(
    `UPDATE jobs SET status = $1, message = $2, error_message = $3, finished_at = NOW(), updated_at = NOW()
     WHERE id = $4`,
    [status, message || null, error || null, id]
  );
}

export async function getJob(id: string): Promise<Job | null> {
  const r = await queryOne<Job>('SELECT * FROM jobs WHERE id = $1', [id]);
  return r || null;
}

// Poll: is this job flagged for cancellation? Called from inside the loop.
export async function isCancelRequested(id: string): Promise<boolean> {
  const r = await queryOne<{ cancel_requested: boolean }>(
    'SELECT cancel_requested FROM jobs WHERE id = $1',
    [id]
  );
  return Boolean(r?.cancel_requested);
}

export async function requestCancel(id: string): Promise<void> {
  await execute('UPDATE jobs SET cancel_requested = TRUE, updated_at = NOW() WHERE id = $1', [id]);
}
