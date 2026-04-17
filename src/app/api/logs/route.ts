// ════════════════════════════════════════════════════════════════════════
// GET /api/logs — list recent error/warn entries.
//
// Filters: ?level=error | warn  |  ?module=agents/extract  |  ?limit=N
//          ?since=<ISO>   (only entries after this timestamp)
//
// Tolerant of migration 003 not applied: returns empty list +
// schema_missing flag.
// ════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { query } from '@/lib/db';
import { apiOk, apiFail } from '@/lib/api-errors';

function isSchemaMissing(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? '';
  return /relation ["']?app_logs["']? does not exist/i.test(msg);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const levelParam = url.searchParams.get('level');
    const moduleParam = url.searchParams.get('module');
    const sinceParam = url.searchParams.get('since');
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 200)));

    const levels = new Set(['debug', 'info', 'warn', 'error']);
    const level = levelParam && levels.has(levelParam) ? levelParam : null;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (level) {
      conditions.push(`level = $${params.length + 1}`);
      params.push(level);
    }
    if (moduleParam) {
      conditions.push(`module = $${params.length + 1}`);
      params.push(moduleParam);
    }
    if (sinceParam) {
      // Guard against invalid date — Postgres will throw on bad input.
      const d = new Date(sinceParam);
      if (!isNaN(d.getTime())) {
        conditions.push(`created_at >= $${params.length + 1}`);
        params.push(d.toISOString());
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const rows = await query(
      `SELECT id, level, module, msg, fields,
              err_name, err_message, err_stack,
              created_at::text AS created_at
         FROM app_logs
         ${where}
         ORDER BY created_at DESC
         LIMIT $${params.length}`,
      params,
    );

    // Also return a small aggregation for the UI counters.
    const countsRows = await query<{ level: string; n: string }>(
      `SELECT level, COUNT(*)::text AS n
         FROM app_logs
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY level`,
    );
    const counts24h: Record<string, number> = {};
    for (const c of countsRows) counts24h[c.level] = Number(c.n) || 0;

    return apiOk({ logs: rows, counts_24h: counts24h });
  } catch (err) {
    if (isSchemaMissing(err)) {
      return apiOk({ logs: [], counts_24h: {}, schema_missing: true });
    }
    return apiFail(err, 'logs/list');
  }
}
