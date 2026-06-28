"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Form, FormField, FormSubmit } from "@/components/ui/Form";
import { useFormDynamic } from "@/hooks/use-dynamic-form";
import { OnboardingStatus } from "@/lib/auth/onboarding-status";
import { useOnboardingNavigation } from "@/components/onboarding/OnboardingStepper";
import { apiFetch } from "@/lib/auth";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface TenantInfo {
  id: string;
  name: string;
}

export function Step1Company({ onCompleted }: { onCompleted?: () => void }) {
  const { nextStepAfterSave } = useOnboardingNavigation();
  const { data: session, status, update: updateSession } = useSession();
  const accessToken = session?.accessToken as string | undefined;
  const [existingTenant, setExistingTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { field, getValues, setFetchStatus, fetchStatus, setTouch } =
    useFormDynamic({
      tenantName: "text",
    });

  useEffect(() => {
    if (status === "loading") return;

    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ tenant: TenantInfo | null }>(
          `${BACKEND_URL}/api/onboarding/tenant`,
          { method: "GET" },
          accessToken,
        );
        if (!cancelled && data.tenant) {
          setExistingTenant(data.tenant);
        }
      } catch (err) {
        console.error("Error fetching tenant info:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = getValues() as { tenantName: string };

    if (!values.tenantName || values.tenantName.trim().length < 3) {
      toast.error("El nombre debe tener al menos 3 caracteres");
      setTouch({ tenantName: true });
      return;
    }

    setFetchStatus("loading");

    try {
      const data = await apiFetch<{
        tenant: TenantInfo;
        onboardingStatus: OnboardingStatus;
      }>(
        `${BACKEND_URL}/api/onboarding/tenant`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: values.tenantName.trim() }),
        },
        accessToken,
      );

      toast.success(
        existingTenant ? "Empresa actualizada" : "Empresa creada",
      );

      await updateSession({
        onboardingStatus: data.onboardingStatus,
        tenantId: data.tenant.id,
      });

      setFetchStatus("success");
      onCompleted?.();
      nextStepAfterSave(1, data.onboardingStatus);
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
      setFetchStatus("error");
    }
  };

  if (isLoading || status === "loading") {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-on-background">
        {existingTenant
          ? "Información de la empresa"
          : "¿Cómo se llama tu empresa?"}
      </h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Este nombre se usará en facturas, reportes y para identificar tu
        espacio de trabajo.
      </p>

      <Form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <FormField
          name="tenantName"
          label="Nombre de la empresa"
          field={field("tenantName")}
        >
          <Input
            name="tenantName"
            className="h-12 bg-surface-container-low focus:ring-primary"
            placeholder="Ej: Mi Empresa S.A."
            defaultValue={existingTenant?.name}
          />
        </FormField>

        <div className="flex justify-end pt-2">
          <FormSubmit
            className="h-12 bg-primary px-6 font-semibold text-white"
            fetchStatus={fetchStatus}
            buttonProps={{
              label: existingTenant ? "Actualizar y continuar" : "Continuar",
            }}
          />
        </div>
      </Form>
    </Card>
  );
}
