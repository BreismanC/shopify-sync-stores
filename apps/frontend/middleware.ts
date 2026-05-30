import { auth } from './auth';
import { NextResponse } from 'next/server';
import type { NextAuthRequest } from 'next-auth';

const publicRoutes = ['/', '/auth/login', '/auth/register', '/auth/error', '/api/auth', '/_next', '/favicon.ico'];
const protectedRoutes = ['/dashboard', '/onboarding', '/settings', '/stores', '/products', '/orders'];

export default auth((req: NextAuthRequest) => {
  const pathname = req.nextUrl.pathname;
  const isLoggedIn = !!req.auth;

  // Check if the route is public
  const isPublicRoute = publicRoutes.some((route) => {
    if (route === '/') return pathname === '/';
    return pathname.startsWith(route);
  });

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  // Redirect to login if accessing a protected route without authentication
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL('/auth/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if accessing auth routes while logged in
  if (isLoggedIn && pathname.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
