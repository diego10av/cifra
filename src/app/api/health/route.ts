import { NextResponse } from 'next/server';

export async function GET() {
  const checks: Record<string, string> = {};

  checks.DATABASE_URL = process.env.DATABASE_URL ? 'set' : 'MISSING';
  checks.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING';
  checks.SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING';
  checks.ANTHROPIC = process.env.ANTHROPIC_API_KEY ? 'set' : 'MISSING';

  try {
    const postgres = (await import('postgres')).default;
    const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });
    const rows = await sql`SELECT NOW() as now`;
    checks.database = 'connected: ' + String(rows[0]?.now);
    await sql.end();
  } catch (e) {
    checks.database = 'ERROR: ' + (e instanceof Error ? e.message : String(e));
  }

  return NextResponse.json(checks);
}
