import { NextRequest } from 'next/server';
import { queryOne } from '@/lib/db';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';
import { resolveFinding } from '@/lib/validator';

const LOCKED_STATUSES = new Set(['approved', 'filed', 'paid']);

// PATCH /api/validator-findings/:id
// Body: { status: 'accepted' | 'rejected' | 'deferred', status_reason?, resolved_by? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const status = body.status;
    if (!['accepted', 'rejected', 'deferred'].includes(status)) {
      return apiError('status_invalid',
        'status must be "accepted", "rejected" or "deferred".',
        { status: 400 });
    }

    const finding = await queryOne<{ declaration_id: string; decl_status: string }>(
      `SELECT vf.declaration_id, d.status AS decl_status
         FROM validator_findings vf
         JOIN declarations d ON vf.declaration_id = d.id
        WHERE vf.id = $1`,
      [id],
    );
    if (!finding) return apiError('finding_not_found', 'Validator finding not found.', { status: 404 });
    if (LOCKED_STATUSES.has(finding.decl_status)) {
      return apiError('declaration_locked',
        `Declaration is ${finding.decl_status}; reopen before resolving findings.`,
        { status: 409 });
    }

    await resolveFinding(id, {
      status,
      status_reason: typeof body.status_reason === 'string' ? body.status_reason : undefined,
      resolved_by: typeof body.resolved_by === 'string' ? body.resolved_by : undefined,
    });

    return apiOk({ id, status });
  } catch (e) {
    return apiFail(e, 'validator-findings:PATCH');
  }
}
