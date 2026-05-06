import { NextRequest, NextResponse } from 'next/server';
import { execute, logAudit } from '@/lib/db';

// DELETE /api/tax-ops/tasks/[id]/counterparties/[cpid]  — unlink
//
// We keep the directory entry; only the link is severed. To archive
// the counterparty itself use DELETE /api/tax-ops/counterparties/[id].

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; cpid: string }> },
): Promise<NextResponse> {
  const { id: taskId, cpid } = await params;
  await execute(
    `DELETE FROM tax_ops_task_counterparties WHERE task_id = $1 AND counterparty_id = $2`,
    [taskId, cpid],
  );
  await logAudit({
    userId: 'founder',
    action: 'tax_task_counterparty_unlink',
    targetType: 'tax_ops_task',
    targetId: taskId,
    newValue: JSON.stringify({ counterparty_id: cpid }),
  });
  return NextResponse.json({ ok: true });
}
