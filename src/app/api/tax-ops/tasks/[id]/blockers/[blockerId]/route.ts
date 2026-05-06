import { NextRequest, NextResponse } from 'next/server';
import { execute, logAudit } from '@/lib/db';

// DELETE /api/tax-ops/tasks/[id]/blockers/[blockerId]  — unlink

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; blockerId: string }> },
): Promise<NextResponse> {
  const { id: taskId, blockerId } = await params;
  await execute(
    `DELETE FROM tax_ops_task_blockers WHERE task_id = $1 AND blocker_id = $2`,
    [taskId, blockerId],
  );
  await logAudit({
    userId: 'founder',
    action: 'tax_task_blocker_unlink',
    targetType: 'tax_ops_task',
    targetId: taskId,
    newValue: JSON.stringify({ blocker_id: blockerId }),
  });
  return NextResponse.json({ ok: true });
}
