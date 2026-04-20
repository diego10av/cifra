// ════════════════════════════════════════════════════════════════════════
// Role gate for API routes that sit OUTSIDE the middleware's blanket
// deny-list (cascade delete, destructive admin actions).
//
// The middleware already stops a junior reading admin pages, but a
// reviewer (who legitimately needs READ access to clients / entities)
// could in theory hit `DELETE …?cascade=true` directly via curl.
// This helper is called inside those endpoints to enforce that only
// an admin can perform the truly destructive path.
// ════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, AUTH_COOKIE_NAME, type Role } from './auth';

export type RoleRequirement = Role | readonly Role[];

/**
 * Verify the session and confirm the role. Returns a ready-to-return
 * NextResponse on failure, or null on success (caller proceeds).
 *
 * Usage:
 *   const fail = await requireRole(request, 'admin');
 *   if (fail) return fail;
 *   // … proceed with destructive action
 */
export async function requireRole(
  request: NextRequest,
  required: RoleRequirement,
): Promise<NextResponse | null> {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySession(cookie);
  if (!session.valid) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const allowed = Array.isArray(required) ? required : [required];
  if (!allowed.includes(session.role as Role)) {
    return NextResponse.json({
      error: {
        code: 'role_restricted',
        message: `This action requires the ${allowed.join(' / ')} role.`,
        hint: 'Ask an administrator to perform it, or sign in with an admin account.',
      },
    }, { status: 403 });
  }
  return null;
}

/**
 * Non-throwing version — returns the role even if it's below the
 * required floor. Used when the caller wants to branch on role.
 */
export async function getSessionRole(request: NextRequest): Promise<Role | null> {
  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySession(cookie);
  return session.valid ? session.role as Role : null;
}
