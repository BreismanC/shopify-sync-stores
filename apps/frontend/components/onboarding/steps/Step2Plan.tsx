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

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

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
    pricing: { monthly: 29, yearly: 290 },
    features: ["3 tiendas fuente", "2 tiendas destino", "3 miembros de equipo"],
  },
  PRO: {
    name: "Pro",
    description: "Para equipos en crecimiento.",
    pricing: { monthly: 79, yearly: 790 },
    features: ["10 tiendas fuente", "5 tiendas destino", "10 miembros de equipo"],
  },
  ENTERPRISE: {
    name: "Enterprise",
    description: "Sin límites, soporte prioritario.",
    pricing: { monthly: 199, yearly: 1990 },
    features: ["Tiendas ilimitadas", "Miembros ilimitados", "SLA dedicado"],
  },
};

type BillingPeriod = "MONTHLY" | "YEARLY";

export function Step2Plan() {
  const { nextStepAfterSave, goToStep } = useOnboardingNavigation();
  const { data: session, update: updateSession } = useSession();
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
  }, [accessToken]);

  async function handleSelectAndPay() {
    if (!selectedPlan) {
      toast.error("Elegí un plan para continuar");
      return;
    }
    setIsSubmitting(true);
    try {
      const data = await apiFetch<{
        preferenceId: string;
        initPoint: string;
        onboardingStatus: OnboardingStatus;
      }>(
        `${BACKEND_URL}/api/onboarding/preference`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planType: selectedPlan, billingPeriod }),
        },
        accessToken,
      );

      await updateSession({ onboardingStatus: data.onboardingStatus });
      // Redirige a MercadoPago (initPoint). El webhook nos actualizará.
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
      nextStepAfterSave(2);
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
      <Card className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-on-background">
          Elegí tu plan
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Todos los planes incluyen 7 días de prueba gratis. Podés cambiar o
          cancelar cuando quieras.
        </p>

        <div className="mt-4 inline-flex rounded-lg border border-outline-variant bg-surface-container-low p-1">
          {(["MONTHLY", "YEARLY"] as BillingPeriod[]).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setBillingPeriod(period)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                billingPeriod === period
                  ? "bg-primary text-white"
                  : "text-on-surface-variant hover:text-on-background",
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
                  "flex flex-col rounded-xl border-2 bg-surface-container-lowest p-5 text-left transition-all",
                  isSelected
                    ? "border-primary shadow-sm"
                    : "border-outline-variant hover:border-primary/50",
                )}
              >
                <span className="text-base font-semibold text-on-background">
                  {details.name}
                </span>
                <span className="mt-1 text-xs text-on-surface-variant">
                  {details.description}
                </span>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-on-background">
                    ${price}
                  </span>
                  <span className="text-sm text-on-surface-variant">
                    /{billingPeriod === "MONTHLY" ? "mes" : "año"}
                  </span>
                </div>
                <ul className="mt-4 space-y-1.5 text-sm text-on-surface-variant">
                  {details.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
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
            className="h-12 px-4 text-on-surface-variant"
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
              className="h-12 px-4 text-on-surface-variant"
            >
              Saltar y probar gratis
            </Button>
            <Button
              type="button"
              onClick={handleSelectAndPay}
              isLoading={isSubmitting}
              isDisabled={!selectedPlan || isSkipping}
              className="h-12 bg-primary px-6 font-semibold text-white"
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
