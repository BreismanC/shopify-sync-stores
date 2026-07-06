"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Check, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { OnboardingStatus } from "@/lib/auth/onboarding-status";
import { ONBOARDING_STEPS } from "@/lib/auth/onboarding-status";
import { useOnboardingNavigation } from "@/components/onboarding/OnboardingStepper";
import { apiFetch } from "@/lib/auth";
import { BACKEND_URL } from "@/lib/env";

interface SummaryData {
  tenant: { id: string; name: string } | null;
  subscription: {
    planType: string;
    status: string;
    trialEndDate?: string;
  } | null;
  store: { id: string; shopifyShopId: string; role: string } | null;
  team: { id: string; role: string }[];
}

export function OnboardingSummary() {
  const router = useRouter();
  const { goToStep } = useOnboardingNavigation();
  const { data: session, status, update: updateSession } = useSession();
  const accessToken = session?.accessToken as string | undefined;

  const [data, setData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;
    (async () => {
      try {
        const [tenant, sub, store, team] = await Promise.all([
          apiFetch<{ tenant: SummaryData["tenant"] }>(
            `${BACKEND_URL}/api/onboarding/tenant`,
            { method: "GET" },
            accessToken,
          ).catch(() => ({ tenant: null })),
          apiFetch<{ subscription: SummaryData["subscription"] }>(
            `${BACKEND_URL}/api/onboarding/subscription/status`,
            { method: "GET" },
            accessToken,
          ).catch(() => ({ subscription: null })),
          apiFetch<{ store: SummaryData["store"] }>(
            `${BACKEND_URL}/api/onboarding/store/status`,
            { method: "GET" },
            accessToken,
          ).catch(() => ({ store: null })),
          apiFetch<{ team: SummaryData["team"] }>(
            `${BACKEND_URL}/api/onboarding/team`,
            { method: "GET" },
            accessToken,
          ).catch(() => ({ team: [] })),
        ]);

        if (!cancelled) {
          setData({
            tenant: tenant.tenant,
            subscription: sub.subscription,
            store: store.store,
            team: team.team,
          });
        }
      } catch (err) {
        console.error("Error loading summary:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, status]);

  async function handleConfirm() {
    setIsConfirming(true);
    try {
      const result = await apiFetch<{ onboardingStatus: OnboardingStatus }>(
        `${BACKEND_URL}/api/onboarding/complete`,
        { method: "POST" },
        accessToken,
      );
      await updateSession({ onboardingStatus: result.onboardingStatus });
      toast.success("¡Onboarding completado!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Error al confirmar");
      setIsConfirming(false);
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
          Resumen de configuración
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Revisá los datos antes de confirmar. Podés volver a cualquier paso
          para editar.
        </p>

        <dl className="mt-6 space-y-4">
          {ONBOARDING_STEPS.map((step) => (
            <div
              key={step.number}
              className="flex items-start justify-between gap-4 rounded-lg border border-outline-variant p-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-on-background">
                    Paso {step.number}: {step.title}
                  </span>
                </div>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {renderStepSummary(step.slug, data)}
                </p>
              </div>
              <Button
                type="button"
                variant="link"
                onClick={() => goToStep(step.number)}
                className="h-8 px-2 text-primary"
              >
                Editar
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>
          ))}
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="link"
            onClick={() => goToStep(5)}
            className="h-12 px-6 text-on-surface-variant"
          >
            Volver
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            isLoading={isConfirming}
            className="h-12 bg-primary px-6 font-semibold text-white"
          >
            Confirmar configuración
          </Button>
        </div>
      </Card>
    </div>
  );
}

function renderStepSummary(
  slug: string,
  data: SummaryData | null,
): React.ReactNode {
  if (!data) return "—";
  switch (slug) {
    case "company":
      return data.tenant
        ? `Empresa: ${data.tenant.name}`
        : "Sin empresa configurada";
    case "plan":
      return data.subscription
        ? `Plan: ${data.subscription.planType} (${data.subscription.status})`
        : "Plan: TRIAL (7 días)";
    case "store":
      return data.store
        ? `Tienda: ${data.store.shopifyShopId} (${data.store.role})`
        : "Sin tienda conectada";
    case "role":
      return data.store ? `Rol: ${data.store.role}` : "—";
    case "team":
      return `${data.team.length} ${data.team.length === 1 ? "invitación" : "invitaciones"}`;
    default:
      return "—";
  }
}
