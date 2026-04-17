// ════════════════════════════════════════════════════════════════════════
// POST /api/portal/[token]/approve
//
// Public endpoint — the client clicks "Approve". We:
// 1. Verify token signature + expiry.
// 2. Look up the declaration; it must still be in 'review'.
// 3. Transition it to 'approved' (via the existing canTransition gate).
// 4. Write an audit row capturing IP + user agent + token nonce so the
//    eventual tax audit has a cryptographic trail of who approved what
//    and from where.
//
// Same approval effect as the internal reviewer clicking Approve:
// precedents get upserted, lines frozen, etc. Those side-effects are
// handled by PATCH /api/declarations/[id] when status → approved, so we
// just issue that (no duplication).
// ════════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { queryOne, execute, logAudit } from '@/lib/db';
import { apiError, apiOk, apiFail } from '@/lib/api-errors';
import { verifyApprovalToken } from '@/lib/approval-tokens';
import { canTransition } from '@/lib/lifecycle';
import { upsertPrecedentsFromDeclaration } from '@/lib/precedents';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

const log = logger.bind('portal/approve');

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return (xff?.split(',')[0]?.trim()) || realIp || 'unknown';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    // Rate limit: public, tighter. 10/min per IP on the approve action —
    // legitimate clients hit it once, bots would hit it more.
    const rl = checkRateLimit(request, { max: 10, windowMs: 60_000, scope: '/api/portal/approve' });
    if (!rl.ok) return rl.response;

    const { token } = await params;

    const verified = await verifyApprovalToken(token);
    if (!verified.ok) {
      log.warn('approve rejected at token stage', { reason: verified.reason });
      return apiError(
        `token_${verified.reason}`,
        'Approval link is not valid or has expired.',
        { status: 401 },
      );
    }

    const declId = verified.payload.decl_id;

    const decl = await queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM declarations WHERE id = $1',
      [declId],
    );
    if (!decl) {
      return apiError('declaration_not_found', 'Declaration not found.', { status: 404 });
    }

    // Prevent double-approval: if someone else (internal reviewer or
    // an earlier portal click) already approved, say so plainly.
    if (decl.status === 'approved' || decl.status === 'filed' || decl.status === 'paid') {
      return apiError(
        'already_approved',
        `This declaration was already approved (status: ${decl.status}). Thanks — no further action needed.`,
        { status: 409 },
      );
    }

    if (!canTransition(decl.status as 'review', 'approved')) {
      return apiError(
        'wrong_status',
        `Cannot approve a declaration in '${decl.status}' status. Please contact the sender.`,
        { status: 409 },
      );
    }

    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Transition + audit, inside a small logical block (no tx to keep
    // compatibility with the existing declaration PATCH flow — if this
    // becomes a concurrency hazard we'll wrap in tx).
    await execute(
      `UPDATE declarations SET status = 'approved', updated_at = NOW() WHERE id = $1`,
      [declId],
    );

    // Same precedent upsert that PATCH /api/declarations/[id] runs on
    // review → approved. Keeps the two approval paths consistent.
    try {
      await upsertPrecedentsFromDeclaration(declId);
    } catch (e) {
      log.error('precedent upsert failed (portal approval)', e, { declaration_id: declId });
    }

    await logAudit({
      action: 'portal_approve',
      targetType: 'declaration',
      targetId: declId,
      declarationId: declId,
      newValue: JSON.stringify({
        ip,
        user_agent: userAgent.slice(0, 200),
        token_nonce: verified.payload.nonce,
        token_exp: verified.payload.exp,
        token_issued_by: verified.payload.issued_by,
      }),
    });

    log.info('portal approval recorded', {
      declaration_id: declId,
      ip,
      token_nonce: verified.payload.nonce,
    });

    return apiOk({
      ok: true,
      approved_at: new Date().toISOString(),
    });
  } catch (e) {
    return apiFail(e, 'portal/approve');
  }
}
