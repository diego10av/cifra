import { NextRequest, NextResponse } from 'next/server';
import { verifySession, AUTH_COOKIE_NAME } from '@/lib/auth';

// Single-user gate: valid session cookie or redirect to /login.
// Edge runtime; uses Web Crypto via @/lib/auth.

const PUBLIC_PATHS = new Set<string>(['/login', '/api/auth/login']);

// Tag the response so the server-component AppShell can render without
// the operator chrome on the public surface (currently only /login).
function withNoShellHeader(request: NextRequest): { request: { headers: Headers } } {
  const headers = new Headers(request.headers);
  headers.set('x-cifra-no-shell', '1');
  return { request: { headers } };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next(withNoShellHeader(request));

  const cookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySession(cookie);
  if (!session.valid) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    if (pathname && pathname !== '/login' && pathname !== '/') {
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)'],
};
