import { NextRequest, NextResponse } from 'next/server';
import { verifySession, AUTH_COOKIE_NAME } from '@/lib/auth';

// ────────── Host-based domain split (re-introduced 2026-05-05 Fase 9) ──
// cifracompliance.com (root + www)  → public landing at /marketing
// app.cifracompliance.com           → authenticated workspace
//
// The same Vercel deployment serves both. The middleware inspects Host
// and rewrites or redirects accordingly. The landing was deleted in the
// reset (Fase 4) and rebuilt as an intermediate version (Fase 9) when
// Diego decided he wanted the domain alive even in dogfood mode.
const ROOT_DOMAIN_HOSTS = new Set<string>([
  'cifracompliance.com',
  'www.cifracompliance.com',
]);

const PUBLIC_PATHS = new Set<string>(['/login', '/api/auth/login']);
const PUBLIC_PREFIXES = ['/marketing/', '/_landing/'];

// Tag the response so the server-component AppShell can render without
// the operator chrome on public surfaces (login + marketing).
function withNoShellHeader(request: NextRequest): { request: { headers: Headers } } {
  const headers = new Headers(request.headers);
  headers.set('x-cifra-no-shell', '1');
  return { request: { headers } };
}

function handleRootDomain(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Static assets pass through.
  if (pathname.startsWith('/_next/') || pathname.startsWith('/_landing/')
      || pathname === '/favicon.ico' || pathname === '/favicon.svg'
      || pathname === '/robots.txt') {
    return NextResponse.next();
  }

  // Root '/' → rewrite to /marketing keeping the URL bar clean.
  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone();
    url.pathname = '/marketing';
    return NextResponse.rewrite(url, withNoShellHeader(request));
  }

  // /marketing (or nested) serves directly without operator chrome.
  if (pathname === '/marketing' || pathname.startsWith('/marketing/')) {
    return NextResponse.next(withNoShellHeader(request));
  }

  // Anything else on the root domain redirects to the app subdomain.
  const target = new URL('https://app.cifracompliance.com');
  target.pathname = pathname;
  target.search = request.nextUrl.search;
  return NextResponse.redirect(target, 307);
}

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') || '').toLowerCase().split(':')[0];

  if (ROOT_DOMAIN_HOSTS.has(host)) {
    return handleRootDomain(request);
  }

  // ───── Default path: app.* or local dev ─────
  const { pathname } = request.nextUrl;

  // Public paths (login + marketing for visiting app.*/marketing directly)
  // render bare (no operator chrome).
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next(withNoShellHeader(request));
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next(withNoShellHeader(request));
  }
  if (pathname === '/marketing') return NextResponse.next(withNoShellHeader(request));

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
