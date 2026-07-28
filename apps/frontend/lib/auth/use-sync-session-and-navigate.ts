"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

import {
  OnboardingStatus,
  isValidStatus,
  statusToStep,
} from "@/lib/auth/onboarding-status";

/**
 * Payload aceptado por `useSession().update(...)`. Lo tipeamos explícitamente
 * para no depender de la API privada de NextAuth.
 */
export interface SessionUpdatePayload {
  onboardingStatus?: OnboardingStatus;
  tenantId?: string;
}

export interface NavigateOptions {
  /**
   * Si es `true`, usa `window.location.href` en lugar de `router.push` para
   * forzar una full navigation. Útil cuando necesitamos garantizar que el
   * server component destino ejecute `auth()` con la cookie recién escrita
   * (caso típico: entrar al dashboard o pasar de un step a otro del
   * onboarding cuando Next.js todavía no invalidó la caché del server).
   */
  forceReload?: boolean;
}

/**
 * Devuelve una función que:
 *   1. Llama a `useSession().update(payload)` para que el JWT de NextAuth
 *      persista el nuevo estado (cookie httpOnly).
 *   2. Hace `router.refresh()` para invalidar la caché del server component
 *      actual y forzar al server a releer la cookie actualizada.
 *   3. Hace `router.push(href)` (o `window.location.href` si
 *      `options.forceReload === true`) para navegar a la página destino. El
 *      server component destino ejecutará `auth()` y leerá la cookie nueva,
 *      evitando el redirect de "no pertenecés al step" / "volver a onboarding".
 *
 * Sin esto, en `PaymentStatusClient` y en los `Step1Company`/`Step3Store`/
 * `Step4Role`/`OnboardingSummary`, el `router.push` se ejecuta antes de que
 * el navegador propague la cookie actualizada de NextAuth, y el server lee el
 * JWT viejo: como el `onboardingStatus` sigue siendo el del paso anterior,
 * redirige al step actual o a `/onboarding`, y el sidebar nunca aparece hasta
 * que el usuario recarga manualmente.
 *
 * Ver:
 *   - app/(protected)/onboarding/page.tsx (valida `isStepUnlocked`)
 *   - app/(protected)/layout.tsx (decide si redirige a /onboarding o monta el sidebar)
 *   - auth.ts (callback `jwt` que persiste `onboardingStatus` en el JWT)
 */
export function useSyncSessionAndNavigate() {
  const router = useRouter();
  const { update } = useSession();

  return useCallback(
    async (
      payload: SessionUpdatePayload,
      href: string,
      options: NavigateOptions = {},
    ) => {
      try {
        await update(payload);
      } catch {
        // Si el refresh de sesión falla, navegamos igual: el guard del server
        // nos mandará al step correcto en el próximo load.
      }

      // `router.refresh()` invalida el cache del server component actual y
      // re-fetchea los datos del layout/página actual con la cookie nueva.
      router.refresh();

      // Damos un tick extra para que el browser termine de aplicar el
      // `Set-Cookie` httpOnly de la response del `/api/auth/session` antes
      // de iniciar la próxima navegación. Sin esto, el request puede salir
      // antes de que la cookie esté disponible para el cliente.
      await new Promise((resolve) => setTimeout(resolve, 50));

      if (options.forceReload && typeof window !== "undefined") {
        // Full navigation: garantiza que el server lea la cookie actualizada
        // sin depender del cache del router ni del RSC payload.
        window.location.href = href;
        return;
      }

      router.push(href);
    },
    [router, update],
  );
}

/**
 * Resuelve el href a navegar según el nuevo `onboardingStatus`. Mantiene la
 * misma lógica que `useOnboardingNavigation.nextStepAfterSave` para que el
 * server no se confunda: si el status indica paso N, vamos a
 * `/onboarding?step=N`. Si el onboarding ya está completo, vamos a
 * `/dashboard`.
 */
export function resolveOnboardingHref(
  status: OnboardingStatus | undefined | null,
): string {
  if (!status || !isValidStatus(status)) {
    return "/onboarding?step=1";
  }
  if (status === OnboardingStatus.COMPLETED) {
    return "/dashboard";
  }
  const step = statusToStep(status);
  return `/onboarding?step=${step}`;
}