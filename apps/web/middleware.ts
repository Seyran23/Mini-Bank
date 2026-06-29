import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_TOKEN_COOKIE } from '@/lib/config';

const AUTH_PAGES = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const hasAccessToken = request.cookies.has(ACCESS_TOKEN_COOKIE);
  const { pathname } = request.nextUrl;
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));

  if (!hasAccessToken && !isAuthPage && pathname !== '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (hasAccessToken && isAuthPage) {
    return NextResponse.redirect(new URL('/accounts', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
