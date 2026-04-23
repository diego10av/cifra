import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute, logAudit } from '@/lib/db';
import { apiError } from '@/lib/api-errors';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await queryOne<{ id: string; matter_id: string; filename: string }>(
    `SELECT id, matter_id, filename FROM crm_matter_documents WHERE id = $1`,
    [id],
  );
  if (!existing) return apiError('not_found', 'Document not found.', { status: 404 });

  await execute(`DELETE FROM crm_matter_documents WHERE id = $1`, [id]);
  await logAudit({
    action: 'document_removed',
    targetType: 'crm_matter',
    targetId: existing.matter_id,
    oldValue: existing.filename,
    reason: 'Matter document removed',
  });
  return NextResponse.json({ id, deleted: true });
}
