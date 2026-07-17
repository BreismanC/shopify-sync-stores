"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OnboardingStatus } from "@/lib/auth/onboarding-status";
import { useOnboardingNavigation } from "@/components/onboarding/OnboardingStepper";
import { apiFetch } from "@/lib/auth";
import { cn } from "@/utils/class-names";
import { BACKEND_URL } from "@/lib/env";

interface PlanInfo {
  planType: "BASIC" | "PRO" | "ENTERPRISE";
  billingPeriods: ("MONTHLY" | "YEARLY")[];
}

interface PlanPricing {
  monthly: number;
  yearly: number;
}

const PLAN_DETAILS: Record<
  PlanInfo["planType"],
  { name: string; description: string; pricing: PlanPricing; features: string[] }
> = {
  BASIC: {
    name: "Basic",
    description: "Para tiendas que recién empiezan.",
    pricing: { monthly: 29_000, yearly: 295_800 },
    features: ["3 tiendas fuente", "2 tiendas destino", "3 miembros de equipo"],
  },
  PRO: {
    name: "Pro",
    description: "Para equipos en crecimiento.",
    pricing: { monthly: 79_000, yearly: 805_800 },
    features: ["10 tiendas fuente", "5 tiendas destino", "10 miembros de equipo"],
  },
  ENTERPRISE: {
    name: "Enterprise",
    description: "Sin límites, soporte prioritario.",
    pricing: { monthly: 199_000, yearly: 2_029_800 },
    features: ["Tiendas ilimitadas", "Miembros ilimitados", "SLA dedicado"],
  },
};

const formatCopPrice = (value: number) =>
  new Intl.NumberFormat("es-CO").format(value);

type BillingPeriod = "MONTHLY" | "YEARLY";

export function Step2Plan() {
  const { nextStepAfterSave, goToStep } = useOnboardingNavigation();
  const { data: session, status, update: updateSession } = useSession();
  const accessToken = session?.accessToken as string | undefined;

  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("MONTHLY");
  const [selectedPlan, setSelectedPlan] = useState<PlanInfo["planType"] | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ plans: PlanInfo[] }>(
          `${BACKEND_URL}/api/onboarding/plans`,
          { method: "GET" },
          accessToken,
        );
        if (!cancelled) setPlans(data.plans);
      } catch (err) {
        console.error("Error fetching plans:", err);
        toast.error("No se pudieron cargar los planes");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, status]);

  async function handleSelectAndPay() {
    if (!selectedPlan) {
      toast.error("Elegí un plan para continuar");
      return;
    }
    setIsSubmitting(true);
    try {
      const data = await apiFetch<{
        preapprovalId: string;
        initPoint: string;
        /**
         * Token firmado corto, emitido por el backend. Se guarda en
         * sessionStorage para que la página pública `/payments/status`
         * pueda consultar el endpoint público
         * `/api/onboarding/public/preapproval-status` cuando MP
         * redirija cross-site (donde las cookies de NextAuth pueden no
         * reenviarse).
         */
        statusToken?: string;
      }>(
        `${BACKEND_URL}/api/onboarding/preference`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planType: selectedPlan, billingPeriod }),
        },
        accessToken,
      );

      if (!data.initPoint) {
        throw new Error("MercadoPago no devolvió un enlace de pago");
      }

      // Guardar el token ANTES de redirigir, así la página pública
      // `/payments/status` puede leerlo cuando MP vuelva a nosotros
      // via back_url. Lo borramos al usarlo en
      // `PaymentStatusClient.consumeStatusToken()`.
      if (typeof window !== "undefined" && data.statusToken) {
        try {
          window.sessionStorage.setItem(
            "mp:statusToken",
            data.statusToken,
          );
        } catch {
          // sessionStorage puede no estar disponible (modo privado,
          // almacenamiento lleno). Sin token, la página pública
          // mostrará un error de "no se encontró el token", así que
          // el usuario puede volver al onboarding.
        }
      }

      // Redirigir al checkout de MercadoPago. El user paga en MP y
      // luego es llevado (back_url) a /payments/status, donde se hace
      // polling del estado y se redirige al paso 3 del onboarding o
      // al dashboard según corresponda. NO actualizamos la sesión
      // acá: el `onboardingStatus` no cambia hasta que el webhook
      // confirme el pago.
      window.location.href = data.initPoint;
    } catch (err: any) {
      toast.error(err.message || "Error al iniciar el pago");
      setIsSubmitting(false);
    }
  }

  async function handleSkip() {
    setIsSkipping(true);
    try {
      const data = await apiFetch<{ onboardingStatus: OnboardingStatus }>(
        `${BACKEND_URL}/api/onboarding/subscription/skip`,
        { method: "POST" },
        accessToken,
      );
      await updateSession({ onboardingStatus: data.onboardingStatus });
      toast.success("Probá gratis por 7 días");
      nextStepAfterSave(2, data.onboardingStatus);
    } catch (err: any) {
      toast.error(err.message || "Error al activar trial");
      setIsSkipping(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-xl border border-gray-6 bg-gray-1 p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-12 tracking-tight">
          Elegí tu plan
        </h2>
        <p className="mt-1 text-sm text-gray-11">
          Todos los planes incluyen 7 días de prueba gratis. Podés cambiar o
          cancelar cuando quieras.
        </p>

        <div className="mt-4 inline-flex rounded-lg border border-gray-6 bg-gray-3 p-1">
          {(["MONTHLY", "YEARLY"] as BillingPeriod[]).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setBillingPeriod(period)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                billingPeriod === period
                  ? "bg-accent-9 text-white shadow-sm"
                  : "text-gray-11 hover:text-gray-12",
              )}
            >
              {period === "MONTHLY" ? "Mensual" : "Anual (2 meses off)"}
            </button>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const details = PLAN_DETAILS[plan.planType];
            const price = details.pricing[billingPeriod === "MONTHLY" ? "monthly" : "yearly"];
            const isSelected = selectedPlan === plan.planType;
            return (
              <button
                key={plan.planType}
                type="button"
                onClick={() => setSelectedPlan(plan.planType)}
                className={cn(
                  "flex flex-col rounded-xl border-2 bg-gray-1 p-5 text-left transition-all",
                  isSelected
                    ? "border-accent-9 shadow-sm"
                    : "border-gray-6 hover:border-accent-9/50",
                )}
              >
                <span className="text-base font-semibold text-gray-12">
                  {details.name}
                </span>
                <span className="mt-1 text-xs text-gray-11">
                  {details.description}
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-gray-12">
                    ${formatCopPrice(price)}
                  </span>
                  <span className="text-sm text-gray-11">
                    /{billingPeriod === "MONTHLY" ? "mes" : "año"}
                  </span>
                </div>
                <ul className="mt-4 space-y-1.5 text-sm text-gray-11">
                  {details.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-accent-9" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="link"
            onClick={() => goToStep(1)}
            className="h-12 px-4 text-gray-11 hover:bg-gray-3 hover:text-gray-12"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver al paso 1
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="link"
              onClick={handleSkip}
              isLoading={isSkipping}
              isDisabled={isSubmitting}
              className="h-12 px-4 text-gray-11 hover:bg-gray-3 hover:text-gray-12"
            >
              Saltar y probar gratis
            </Button>
            <Button
              type="button"
              onClick={handleSelectAndPay}
              isLoading={isSubmitting}
              isDisabled={!selectedPlan || isSkipping}
              className="h-12 px-6 font-semibold bg-accent-9 hover:bg-accent-10 text-white rounded-lg shadow-sm hover:!transform-none active:!transform-none"
            >
              {selectedPlan
                ? `Pagar con MercadoPago`
                : "Elegí un plan para pagar"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
