import { NextRequest, NextResponse } from 'next/server';
import { verifySessionCookie, AUTH_COOKIE_NAME } from '@/lib/auth';

// Runs on the Edge runtime. Uses Web Crypto via @/lib/auth — the cookie is an
// HMAC-signed session id, not the raw secret.

const PUBLIC_PATHS = new Set<string>([
  '/login',
  '/api/auth/login',
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const ok = await verifySessionCookie(cookie);
  if (!ok) {
    // For API requests, return 401 JSON rather than a redirect so callers
    // see a real error instead of the login HTML.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)'],
};
