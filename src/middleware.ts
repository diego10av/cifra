import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Allow only the login page and login API without auth
  if (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/api/auth/login'
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie
  const authCookie = request.cookies.get('vat_auth')?.value;
  if (authCookie !== process.env.AUTH_SECRET) {
    // Redirect to login
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
