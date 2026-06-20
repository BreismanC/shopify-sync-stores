import { auth } from './auth';
import { NextResponse } from 'next/server';
import {
  OnboardingStatus,
  isValidStatus,
  statusToStep,
  isStepUnlocked,
  isValidStep,
} from '@/lib/auth/onboarding-status';

const publicRoutes = ['/', '/auth/login', '/auth/register', '/auth/error', '/api/auth', '/_next', '/favicon.ico'];
const protectedRoutes = ['/dashboard', '/onboarding', '/settings', '/stores', '/products', '/orders', '/tenant-selector'];

// Note: `middleware.ts` is deprecated in Next.js 16 and renamed to `proxy.ts`.
// NextAuth v5 still works with this proxy via the `auth(...)` wrapper.
export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authData = (req as any).auth;
  const isLoggedIn = !!authData;

  const isPublicRoute = publicRoutes.some((route) => {
    if (route === '/') return pathname === '/';
    return pathname.startsWith(route);
  });

  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  if (!isLoggedIn) {
    if (isProtectedRoute) {
      const loginUrl = new URL('/auth/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const onboardingStatus: OnboardingStatus | undefined = isValidStatus(
    authData?.user?.onboardingStatus,
  )
    ? authData.user.onboardingStatus
    : undefined;

  // COMPLETED → acceso total
  if (onboardingStatus === OnboardingStatus.COMPLETED) {
    if (pathname.startsWith('/auth/')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // Sin onboardingStatus (caso raro) o PENDING_*
  // Forzamos al usuario a /onboarding (excepto si ya está ahí).
  if (!onboardingStatus) {
    if (pathname !== '/onboarding' && !pathname.startsWith('/onboarding')) {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
    return NextResponse.next();
  }

  // Está en onboarding: si intenta acceder a una ruta protegida, redirigir.
  const isOnboardingPath = pathname === '/onboarding' || pathname.startsWith('/onboarding/');
  const isAuthPath = pathname.startsWith('/auth/');
  const isApiPath = pathname.startsWith('/api/');

  if (isAuthPath) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  if (!isOnboardingPath && !isApiPath) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  // Está en /onboarding. Si tiene ?step=N y N no está desbloqueado, redirigir
  // al step actual derivado del onboardingStatus.
  if (pathname === '/onboarding') {
    const requestedStep = Number(req.nextUrl.searchParams.get('step'));
    if (Number.isFinite(requestedStep) && isValidStep(requestedStep)) {
      if (!isStepUnlocked(requestedStep, onboardingStatus)) {
        const currentStep = statusToStep(onboardingStatus);
        const url = new URL(`/onboarding?step=${currentStep}`, req.url);
        return NextResponse.redirect(url);
      }
    } else {
      // Sin ?step válido → redirigir al paso actual
      const currentStep = statusToStep(onboardingStatus);
      const url = new URL(`/onboarding?step=${currentStep}`, req.url);
      return NextResponse.redirect(url);
    }
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
