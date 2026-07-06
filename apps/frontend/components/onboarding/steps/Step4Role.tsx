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

interface StoreInfo {
  id: string;
  shopifyShopId: string;
  role: "SOURCE" | "VENDOR";
}

type StoreRole = StoreInfo["role"];

const ROLE_DESCRIPTIONS: Record<StoreRole, { title: string; description: string }> = {
  SOURCE: {
    title: "Tienda fuente (SOURCE)",
    description:
      "Proveés productos. Las tiendas destino pueden sincronizar tu inventario.",
  },
  VENDOR: {
    title: "Tienda destino (VENDOR)",
    description:
      "Recibís productos y pedidos desde tiendas fuente.",
  },
};

export function Step4Role() {
  const { nextStepAfterSave, goToStep } = useOnboardingNavigation();
  const { data: session, status, update: updateSession } = useSession();
  const accessToken = session?.accessToken as string | undefined;

  const [store, setStore] = useState<StoreInfo | null>(null);
  const [selectedRole, setSelectedRole] = useState<StoreRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ store: StoreInfo | null }>(
          `${BACKEND_URL}/api/onboarding/store/status`,
          { method: "GET" },
          accessToken,
        );
        if (!cancelled && data.store) {
          setStore(data.store);
          setSelectedRole(data.store.role);
        }
      } catch (err) {
        console.error("Error fetching store:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, status]);

  async function handleSave() {
    if (!store || !selectedRole) {
      toast.error("Elegí un rol para continuar");
      return;
    }
    setIsSaving(true);
    try {
      const data = await apiFetch<{ onboardingStatus: OnboardingStatus }>(
        `${BACKEND_URL}/api/onboarding/store/role`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId: store.id, role: selectedRole }),
        },
        accessToken,
      );
      toast.success("Rol guardado");
      await updateSession({ onboardingStatus: data.onboardingStatus });
      nextStepAfterSave(4, data.onboardingStatus);
    } catch (err: any) {
      toast.error(err.message || "Error al guardar el rol");
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!store) {
    return (
      <Card className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8">
        <p className="text-sm text-on-surface-variant">
          No tenés una tienda conectada. Volvé al paso 3 para conectar una.
        </p>
        <Button
          type="button"
          onClick={() => goToStep(3)}
          className="mt-4 h-12 bg-primary px-6 font-semibold text-white"
        >
          Ir al paso 3
        </Button>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-on-background">
        ¿Qué rol tiene tu tienda?
      </h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Tienda conectada:{" "}
        <strong className="text-on-background">{store.shopifyShopId}</strong>
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {(Object.keys(ROLE_DESCRIPTIONS) as StoreRole[]).map((role) => {
          const isSelected = selectedRole === role;
          return (
            <button
              key={role}
              type="button"
              onClick={() => setSelectedRole(role)}
              className={cn(
                "flex flex-col rounded-xl border-2 bg-surface-container-lowest p-5 text-left transition-all",
                isSelected
                  ? "border-primary shadow-sm"
                  : "border-outline-variant hover:border-primary/50",
              )}
            >
              <span className="text-base font-semibold text-on-background">
                {ROLE_DESCRIPTIONS[role].title}
              </span>
              <span className="mt-1 text-sm text-on-surface-variant">
                {ROLE_DESCRIPTIONS[role].description}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="link"
          onClick={() => goToStep(3)}
          className="h-12 px-4 text-on-surface-variant"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Volver al paso 3
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          isLoading={isSaving}
          isDisabled={!selectedRole}
          className="h-12 bg-primary px-6 font-semibold text-white"
        >
          Continuar
        </Button>
      </div>
    </Card>
  );
}
