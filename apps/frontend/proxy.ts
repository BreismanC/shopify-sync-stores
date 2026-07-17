import { auth } from './auth';
import { NextResponse } from 'next/server';
import {
  OnboardingStatus,
  isValidStatus,
  statusToStep,
  isStepUnlocked,
  isValidStep,
} from '@/lib/auth/onboarding-status';

/**
 * Rutas que SIEMPRE requieren sesión iniciada (sin importar el
 * onboardingStatus). Si el usuario no está autenticado, lo mandamos
 * al login con `callbackUrl` para volver después.
 */
const protectedRoutes = [
  '/dashboard',
  '/onboarding',
  '/settings',
  '/stores',
  '/products',
  '/orders',
  '/tenant-selector',
];

const isProtectedRoute = (pathname: string): boolean =>
  protectedRoutes.some((route) => pathname.startsWith(route));

function memberCanAccessApp(status: OnboardingStatus): boolean {
  return (
    status === OnboardingStatus.COMPLETED ||
    status === OnboardingStatus.PENDING_TEAM_CONFIG
  );
}

// Note: `middleware.ts` is deprecated in Next.js 16 and renamed to `proxy.ts`.
export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authData = (req as any).auth;
  const isLoggedIn = !!authData;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);

  const next = () =>
    NextResponse.next({
      request: { headers: requestHeaders },
    });

  // Nunca redirigir rutas de API (incluye /api/auth de NextAuth).
  // Si no, SessionProvider recibe HTML de /unauthorized → ClientFetchError.
  if (pathname.startsWith('/api/')) {
    return next();
  }

  if (!isLoggedIn) {
    if (isProtectedRoute(pathname)) {
      const loginUrl = new URL('/auth/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return next();
  }

  const onboardingStatus: OnboardingStatus | undefined = isValidStatus(
    authData?.user?.onboardingStatus,
  )
    ? authData.user.onboardingStatus
    : undefined;

  const isOwner =
    authData?.user?.isOwner === true || authData?.user?.role === 'OWNER';

  const isOnboardingPath =
    pathname === '/onboarding' || pathname.startsWith('/onboarding/');
  const isAuthPath = pathname.startsWith('/auth/');
  const isUnauthorizedPath = pathname.startsWith('/unauthorized');
  const isDashboard =
    pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  if (onboardingStatus === OnboardingStatus.COMPLETED) {
    if (isAuthPath) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return next();
  }

  // Miembro: solo PENDING_TEAM_CONFIG o COMPLETED → app; si no → unauthorized
  if (!isOwner) {
    if (!onboardingStatus || !memberCanAccessApp(onboardingStatus)) {
      if (!isUnauthorizedPath && !isAuthPath) {
        return NextResponse.redirect(
          new URL('/unauthorized?reason=team-member-not-invited', req.url),
        );
      }
      return next();
    }

    if (isOnboardingPath || isAuthPath) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return next();
  }

  // Owner con onboarding incompleto
  if (!onboardingStatus) {
    if (!isOnboardingPath) {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
    return next();
  }

  if (isAuthPath) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  if (isOnboardingPath && pathname === '/onboarding') {
    const requestedStep = Number(req.nextUrl.searchParams.get('step'));
    if (Number.isFinite(requestedStep) && isValidStep(requestedStep)) {
      if (!isStepUnlocked(requestedStep, onboardingStatus)) {
        const currentStep = statusToStep(onboardingStatus);
        return NextResponse.redirect(
          new URL(`/onboarding?step=${currentStep}`, req.url),
        );
      }
    } else {
      const currentStep = statusToStep(onboardingStatus);
      return NextResponse.redirect(
        new URL(`/onboarding?step=${currentStep}`, req.url),
      );
    }
    return next();
  }

  if (isOnboardingPath) {
    return next();
  }

  if (!isProtectedRoute(pathname)) {
    return next();
  }

  if (isDashboard) {
    const currentStep = statusToStep(onboardingStatus);
    return NextResponse.redirect(
      new URL(`/onboarding?step=${currentStep}`, req.url),
    );
  }

  return NextResponse.redirect(new URL('/onboarding', req.url));
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
