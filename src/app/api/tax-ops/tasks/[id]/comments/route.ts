import { NextRequest, NextResponse } from 'next/server';
import { query, execute, generateId, logAudit } from '@/lib/db';

// GET  /api/tax-ops/tasks/[id]/comments  — linear thread, oldest first
// POST /api/tax-ops/tasks/[id]/comments  — body: { body }

interface Comment {
  id: string;
  body: string;
  created_by: string | null;
  created_at: string;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const rows = await query<Comment>(
    `SELECT id, body, created_by, created_at::text
       FROM tax_ops_task_comments
      WHERE task_id = $1
      ORDER BY created_at ASC`,
    [id],
  );
  return NextResponse.json({ comments: rows });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: taskId } = await params;
  const body = await request.json() as { body?: string };
  const text = body.body?.trim();
  if (!text) return NextResponse.json({ error: 'body_required' }, { status: 400 });

  const id = generateId();
  await execute(
    `INSERT INTO tax_ops_task_comments (id, task_id, body, created_by)
     VALUES ($1, $2, $3, 'founder')`,
    [id, taskId, text],
  );
  await logAudit({
    userId: 'founder',
    action: 'tax_task_comment_add',
    targetType: 'tax_ops_task',
    targetId: taskId,
  });
  return NextResponse.json({ id });
}
