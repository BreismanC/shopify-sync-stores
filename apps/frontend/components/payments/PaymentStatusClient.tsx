"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle, XCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { OnboardingStatus } from "@/lib/auth/onboarding-status";
import { BACKEND_URL } from "@/lib/env";

const STATUS_TOKEN_STORAGE_KEY = "mp:statusToken";

const SUBSCRIPTION_PENDING = "PENDING_PAYMENT";
const SUBSCRIPTION_ACTIVE = "ACTIVE";

interface PollResponse {
  mpStatus: string;
  subscriptionStatus: string | null;
  onboardingStatus: OnboardingStatus | null;
  pollingRequired?: boolean;
  paymentApproved?: boolean;
}

interface PollingState {
  mpStatus: string | null;
  subscriptionStatus: string | null;
  onboardingStatus: OnboardingStatus | null;
  resolved: boolean;
}

/** Usuario aún en paso 2 del onboarding (o sin status). */
function isOnOnboardingStep2(status: OnboardingStatus | null): boolean {
  return (
    status === null || status === OnboardingStatus.PENDING_PLAN_SELECTION
  );
}

/** Usuario ya pasó el paso 2 (paso 3 o superior). */
function isPastOnboardingStep2(status: OnboardingStatus | null): boolean {
  if (!status) return false;
  return (
    status !== OnboardingStatus.PENDING_TENANT_CONFIG &&
    status !== OnboardingStatus.PENDING_PLAN_SELECTION
  );
}

/**
 * Solo seguir polling si el usuario está en paso 2 Y la suscripción
 * sigue pendiente de pago. Usa flags del backend si vienen; si no,
 * deriva la misma regla en el cliente.
 */
function shouldContinuePolling(data: PollResponse): boolean {
  if (typeof data.pollingRequired === "boolean") {
    return data.pollingRequired;
  }
  return (
    isOnOnboardingStep2(data.onboardingStatus) &&
    data.subscriptionStatus === SUBSCRIPTION_PENDING
  );
}

/**
 * Pago aprobado: suscripción ACTIVE o usuario ya en paso 3+.
 * En ese caso no hace falta seguir esperando webhooks.
 */
function isPaymentApproved(data: PollResponse): boolean {
  if (typeof data.paymentApproved === "boolean") {
    return data.paymentApproved;
  }
  return (
    data.subscriptionStatus === SUBSCRIPTION_ACTIVE ||
    isPastOnboardingStep2(data.onboardingStatus)
  );
}

function isPaymentFailed(data: PollResponse): boolean {
  const failedMp = ["cancelled", "paused", "expired"].includes(
    data.mpStatus ?? "",
  );
  const failedSub = ["CANCELED", "SUSPENDED", "EXPIRED"].includes(
    data.subscriptionStatus ?? "",
  );
  return failedMp || failedSub;
}

function getRedirectTarget(
  onboardingStatus: OnboardingStatus | null,
): { href: string } {
  if (onboardingStatus === OnboardingStatus.COMPLETED) {
    return { href: "/dashboard" };
  }
  return { href: "/onboarding?step=3" };
}

function readStatusToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(STATUS_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearStatusToken(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STATUS_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function PaymentStatusClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { update: updateSession } = useSession();
  const preapprovalId = searchParams.get("preapproval_id");
  const redirectedRef = useRef(false);

  const [state, setState] = useState<PollingState>({
    mpStatus: null,
    subscriptionStatus: null,
    onboardingStatus: null,
    resolved: false,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!preapprovalId) return;

    const preapprovalIdNonNull: string = preapprovalId;
    const queryToken = searchParams.get("token");
    const tokenRaw: string | null = queryToken ?? readStatusToken();

    if (!tokenRaw) {
      setErrorMsg(
        "No se encontró el token de verificación. Volvé a elegir un plan.",
      );
      return;
    }

    const token: string = tokenRaw;
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval>;
    let consecutiveErrors = 0;
    const MAX_ERRORS_BEFORE_BANNER = 6;

    async function poll() {
      try {
        const url = new URL(
          `${BACKEND_URL}/api/onboarding/public/preapproval-status`,
        );
        url.searchParams.set("preapproval_id", preapprovalIdNonNull);
        url.searchParams.set("token", token);

        const res = await fetch(url.toString(), { method: "GET" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as PollResponse;

        consecutiveErrors = 0;
        setErrorMsg(null);

        if (cancelled) return;

        setState({
          mpStatus: data.mpStatus,
          subscriptionStatus: data.subscriptionStatus,
          onboardingStatus: data.onboardingStatus,
          resolved: !shouldContinuePolling(data),
        });

        // Caso 1: pago fallido / cancelado
        if (isPaymentFailed(data)) {
          clearInterval(intervalId);
          setState((prev) => ({ ...prev, resolved: true }));
          return;
        }

        // Caso 2: seguir polling — paso 2 + suscripción pendiente
        if (shouldContinuePolling(data)) {
          return;
        }

        // Caso 3: pago aprobado → detener polling y mostrar pantalla
        // de éxito con botón "Continuar" (la navegación la dispara el
        // usuario para evitar el spinner intermedio).
        if (isPaymentApproved(data)) {
          clearInterval(intervalId);
          return;
        }
      } catch {
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_ERRORS_BEFORE_BANNER) {
          setErrorMsg(
            "No se pudo verificar el estado del pago tras varios intentos.",
          );
        }
      }
    }

    poll();
    intervalId = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [preapprovalId, searchParams, router, updateSession]);

  if (!preapprovalId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
          <XCircle className="mx-auto h-12 w-12 text-error" />
          <h1 className="mt-4 text-xl font-semibold text-on-background">
            Pago no encontrado
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            No se recibió un identificador de pago.
          </p>
          <Button
            onClick={() => router.push("/onboarding")}
            className="mt-6"
          >
            Volver al onboarding
          </Button>
        </Card>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
          <XCircle className="mx-auto h-12 w-12 text-error" />
          <h1 className="mt-4 text-xl font-semibold text-on-background">
            No se pudo verificar el pago
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">{errorMsg}</p>
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => router.push("/onboarding?step=2")}
              variant="pill"
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (
    state.resolved &&
    (state.mpStatus === "authorized" || state.mpStatus === "active")
  ) {
    const target = getRedirectTarget(state.onboardingStatus);

    const handleContinue = async () => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;

      const sessionStatus =
        state.onboardingStatus === OnboardingStatus.PENDING_PLAN_SELECTION ||
        state.onboardingStatus === null
          ? OnboardingStatus.PENDING_STORE_CONFIG
          : state.onboardingStatus;

      try {
        await updateSession({ onboardingStatus: sessionStatus });
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch {
        // Sesión no se pudo refrescar: el guard mandará al step correcto
        // en el próximo load.
      }

      clearStatusToken();
      router.push(target.href);
    };

    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-success" />
          <h1 className="mt-4 text-2xl font-bold text-on-background">
            ¡Pago aprobado!
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Tu suscripción está activa. Continuá con la configuración de tu
            tienda.
          </p>
          <div className="mt-6 flex justify-center">
            <Button onClick={handleContinue} variant="pill">
              <ArrowRight className="mr-2 h-4 w-4" />
              Continuar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (
    state.resolved &&
    ["cancelled", "paused", "expired"].includes(state.mpStatus ?? "")
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
          <XCircle className="mx-auto h-16 w-16 text-error" />
          <h1 className="mt-4 text-2xl font-bold text-on-background">
            Pago {state.mpStatus === "cancelled" ? "cancelado" : "fallido"}
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            {state.mpStatus === "cancelled"
              ? "La suscripción fue cancelada."
              : "No se pudo procesar el pago. Intentá nuevamente."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              onClick={() => router.push("/onboarding?step=2")}
              variant="pill"
            >
              Volver a elegir plan
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center">
        <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary" />
        <h1 className="mt-4 text-xl font-semibold text-on-background">
          Procesando pago
        </h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Estamos verificando el estado de tu pago. Esto puede tardar unos
          segundos mientras Mercado Pago confirma la transacción.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span>
            Esperando confirmación #{preapprovalId?.slice(0, 8)}…
          </span>
        </div>
        <Button
          variant="pill"
          onClick={() => router.push("/onboarding?step=2")}
          className="mt-6"
        >
          Cancelar y volver
        </Button>
      </Card>
    </div>
  );
}
