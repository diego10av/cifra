import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, string> = {};

  // Check env vars
  checks.DATABASE_URL = process.env.DATABASE_URL ? 'set (' + process.env.DATABASE_URL.substring(0, 30) + '...)' : 'MISSING';
  checks.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING';
  checks.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING';
  checks.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ? 'set' : 'MISSING';

  // Test database connection
  try {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(process.env.DATABASE_URL!);
    const fn = sql as unknown as (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
    const rows = await fn('SELECT NOW() as now');
    checks.database = 'connected: ' + String(rows[0]?.now);
  } catch (e) {
    checks.database = 'ERROR: ' + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json(checks);
}
