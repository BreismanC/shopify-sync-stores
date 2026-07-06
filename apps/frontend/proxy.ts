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

/**
 * Helper: devuelve `true` si la ruta actual empieza con alguna de
 * las rutas explícitamente protegidas.
 */
const isProtectedRoute = (pathname: string): boolean =>
  protectedRoutes.some((route) => pathname.startsWith(route));

// Note: `middleware.ts` is deprecated in Next.js 16 and renamed to `proxy.ts`.
// NextAuth v5 still works with this proxy via el wrapper `auth(...)`.
export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authData = (req as any).auth;
  const isLoggedIn = !!authData;

  // 1) Sin sesión → solo dejamos pasar rutas NO protegidas.
  //    Todo lo demás va a /auth/login con callbackUrl.
  if (!isLoggedIn) {
    if (isProtectedRoute(pathname)) {
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

  // 2) Onboarding COMPLETED → acceso total (excepto /auth/* que va al dashboard).
  if (onboardingStatus === OnboardingStatus.COMPLETED) {
    if (pathname.startsWith('/auth/')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // 2.1) Usuarios con un step avanzado del onboarding (ya pasaron step 2
  //      y eligieron su plan, o ya están configurando la tienda). Los
  //      dejamos acceder al dashboard igual; no tiene sentido devolverlos
  //      a /onboarding porque están en pleno flujo.
  const isDashboard =
    pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  if (
    isDashboard &&
    (onboardingStatus === OnboardingStatus.PENDING_STORE_CONFIG ||
      onboardingStatus === OnboardingStatus.PENDING_PLAN_SELECTION)
  ) {
    return NextResponse.next();
  }

  const isOnboardingPath =
    pathname === '/onboarding' || pathname.startsWith('/onboarding/');
  const isAuthPath = pathname.startsWith('/auth/');

  // 3) Sin onboardingStatus válido (caso raro): lo mandamos a /onboarding.
  if (!onboardingStatus) {
    if (!isOnboardingPath) {
      return NextResponse.redirect(new URL('/onboarding', req.url));
    }
    return NextResponse.next();
  }

  // 4) Está en onboarding. Si intenta acceder a /auth/* → a /onboarding.
  if (isAuthPath) {
    return NextResponse.redirect(new URL('/onboarding', req.url));
  }

  // 5) Está en /onboarding. Validamos que el step solicitado (si lo hay)
  //    esté desbloqueado; si no, redirigimos al step que sí está
  //    desbloqueado según el `onboardingStatus` actual.
  if (isOnboardingPath && pathname === '/onboarding') {
    const requestedStep = Number(req.nextUrl.searchParams.get('step'));
    if (Number.isFinite(requestedStep) && isValidStep(requestedStep)) {
      if (!isStepUnlocked(requestedStep, onboardingStatus)) {
        const currentStep = statusToStep(onboardingStatus);
        const url = new URL(`/onboarding?step=${currentStep}`, req.url);
        return NextResponse.redirect(url);
      }
    } else {
      // Sin ?step válido → redirigir al step actual
      const currentStep = statusToStep(onboardingStatus);
      const url = new URL(`/onboarding?step=${currentStep}`, req.url);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // 6) Está en onboarding pero en una ruta NO protegida (ej:
  //    /payments/status, /api/auth/callback/*, futuras rutas neutras
  //    como /billing). Las dejamos pasar — la página pública hace su
  //    propia autorización por token firmado (ver MercadoPagoTokenService)
  //    y luego redirige al step correcto.
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
  }

  // 7) Ruta protegida + onboarding incompleto → forzar /onboarding.
  return NextResponse.redirect(new URL('/onboarding', req.url));
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