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
import { BACKEND_URL } from "@/lib/env";

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

  const { field, getValues, setValue, setFetchStatus, fetchStatus, setTouch } =
    useFormDynamic({
      tenantName: "text",
    });

  const tenantNameField = field("tenantName");

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
          // defaultValue solo pinta el DOM; hay que hidratar useFormDynamic
          // para que getValues() no mande "" al continuar sin editar.
          setValue((prev) => ({
            ...prev,
            tenantName: data.tenant!.name,
          }));
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
  }, [accessToken, status, setValue]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = getValues() as { tenantName: string };
    const fromDom = new FormData(e.currentTarget).get("tenantName");
    const tenantName = String(values.tenantName || fromDom || "").trim();

    if (tenantName.length < 3) {
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
          body: JSON.stringify({ name: tenantName }),
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
    <Card className="rounded-xl border border-gray-6 bg-gray-1 p-6 sm:p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-12 tracking-tight">
        {existingTenant
          ? "Información de la empresa"
          : "¿Cómo se llama tu empresa?"}
      </h2>
      <p className="mt-1 text-sm text-gray-11">
        Este nombre se usará en facturas, reportes y para identificar tu
        espacio de trabajo.
      </p>

      <Form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 [&_label]:block [&_label]:text-xs [&_label]:font-bold [&_label]:uppercase [&_label]:tracking-wider [&_label]:pb-2 [&_label]:text-gray-11 [&_[data-slot=input]]:h-12 [&_[data-slot=input]]:bg-gray-1 [&_[data-slot=input]]:border [&_[data-slot=input]]:border-gray-6 [&_[data-slot=input]]:rounded-lg [&_[data-slot=input]]:text-gray-12 [&_[data-slot=input]]:placeholder:text-gray-11 [&_[data-slot=input]]:focus:outline-none [&_[data-slot=input]]:focus:border-accent-9 [&_[data-slot=input]]:focus:ring-2 [&_[data-slot=input]]:focus:ring-accent-9/50"
      >
        <FormField
          name="tenantName"
          label="Nombre de la empresa"
          field={tenantNameField}
        >
          <Input
            name="tenantName"
            placeholder="Ej: Mi Empresa S.A."
            value={String(tenantNameField.value ?? "")}
            onChange={tenantNameField.onChange}
          />
        </FormField>

        <div className="flex justify-end pt-2">
          <FormSubmit
            className="h-12 px-6 font-semibold bg-accent-9 hover:bg-accent-10 text-white rounded-lg shadow-sm hover:!transform-none active:!transform-none"
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
