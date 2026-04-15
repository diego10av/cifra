import { NextResponse } from 'next/server';

function maskKey(key: string | undefined): string {
  if (!key) return 'MISSING';
  const trimmed = key.trim();
  if (trimmed.length < 16) return 'TOO_SHORT (' + trimmed.length + ' chars)';
  return trimmed.substring(0, 8) + '...' + trimmed.substring(trimmed.length - 4) + ' (' + trimmed.length + ' chars)';
}

export async function GET() {
  const checks: Record<string, unknown> = {};

  const rawKey = process.env.ANTHROPIC_API_KEY;
  checks.ANTHROPIC_key_masked = maskKey(rawKey);
  checks.ANTHROPIC_has_whitespace = rawKey ? (rawKey !== rawKey.trim()) : false;
  checks.DATABASE_URL = process.env.DATABASE_URL ? 'set' : 'MISSING';
  checks.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'MISSING';
  checks.SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'MISSING';

  // DB connectivity
  try {
    const postgres = (await import('postgres')).default;
    const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });
    const rows = await sql`SELECT NOW() as now`;
    checks.database = 'connected: ' + String(rows[0]?.now);
    await sql.end();
  } catch (e) {
    checks.database = 'ERROR: ' + (e instanceof Error ? e.message : String(e));
  }

  // Anthropic connectivity — smallest possible call
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: rawKey?.trim() });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Hi' }],
    });
    const textBlock = response.content.find(b => b.type === 'text');
    checks.anthropic = 'OK: ' + (textBlock?.type === 'text' ? textBlock.text.substring(0, 30) : 'no text');
  } catch (e) {
    const err = e as { status?: number; message?: string };
    checks.anthropic = `ERROR ${err.status ?? ''}: ${err.message ?? String(e)}`;
  }

  return NextResponse.json(checks);
}
