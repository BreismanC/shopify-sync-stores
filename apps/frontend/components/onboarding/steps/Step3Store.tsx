"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Form, FormField, FormSubmit } from "@/components/ui/Form";
import { useFormDynamic } from "@/hooks/use-dynamic-form";
import { OnboardingStatus } from "@/lib/auth/onboarding-status";
import { useOnboardingNavigation } from "@/components/onboarding/OnboardingStepper";
import { apiFetch } from "@/lib/auth";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

interface StoreInfo {
  id: string;
  shopifyShopId: string;
  role: "SOURCE" | "VENDOR";
  isActive: boolean;
}

export function Step3Store() {
  const { nextStepAfterSave, goToStep } = useOnboardingNavigation();
  const { data: session, update: updateSession } = useSession();
  const accessToken = session?.accessToken as string | undefined;

  const [existingStore, setExistingStore] = useState<StoreInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { field, getValues, setFetchStatus, fetchStatus, setTouch } =
    useFormDynamic({
      shopifyShopUrl: "text",
      shopifyAccessToken: "text",
    });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ store: StoreInfo | null }>(
          `${BACKEND_URL}/api/onboarding/store/status`,
          { method: "GET" },
          accessToken,
        );
        if (!cancelled && data.store) setExistingStore(data.store);
      } catch (err) {
        console.error("Error fetching store status:", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = getValues() as {
      shopifyShopUrl: string;
      shopifyAccessToken: string;
    };

    if (!values.shopifyShopUrl || !values.shopifyShopUrl.includes(".myshopify.com")) {
      toast.error("Ingresá un dominio válido (ej: mi-tienda.myshopify.com)");
      setTouch({ shopifyShopUrl: true });
      return;
    }
    if (!values.shopifyAccessToken || values.shopifyAccessToken.length < 10) {
      toast.error("El access token parece inválido");
      setTouch({ shopifyAccessToken: true });
      return;
    }

    setFetchStatus("loading");

    try {
      const data = await apiFetch<{
        store: StoreInfo;
        onboardingStatus: OnboardingStatus;
      }>(
        `${BACKEND_URL}/api/onboarding/store/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopifyShopUrl: values.shopifyShopUrl.trim(),
            shopifyAccessToken: values.shopifyAccessToken.trim(),
          }),
        },
        accessToken,
      );

      toast.success("Tienda conectada");
      await updateSession({ onboardingStatus: data.onboardingStatus });
      nextStepAfterSave(3);
    } catch (err: any) {
      toast.error(err.message || "Error al conectar la tienda");
      setFetchStatus("error");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Card className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-on-background">
        Conectá tu tienda Shopify
      </h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        Necesitás una <strong>Custom App</strong> instalada en tu tienda con
        permisos de lectura. Generá el access token desde el admin de Shopify
        (Settings → Apps → Develop apps).
      </p>

      {existingStore ? (
        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
          <p className="font-medium text-on-background">
            Ya tenés una tienda conectada:{" "}
            <span className="text-primary">{existingStore.shopifyShopId}</span>
          </p>
          <p className="mt-1 text-on-surface-variant">
            Si querés cambiar la tienda, completá los datos de abajo. Si está
            bien, podés continuar al paso siguiente.
          </p>
        </div>
      ) : null}

      <Form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <FormField
          name="shopifyShopUrl"
          label="Dominio de la tienda"
          field={field("shopifyShopUrl")}
        >
          <Input
            name="shopifyShopUrl"
            className="h-12 bg-surface-container-low focus:ring-primary"
            placeholder="mi-tienda.myshopify.com"
            defaultValue={existingStore?.shopifyShopId}
          />
        </FormField>

        <FormField
          name="shopifyAccessToken"
          label="Access token (Admin API)"
          field={field("shopifyAccessToken")}
        >
          <Input
            name="shopifyAccessToken"
            type="password"
            className="h-12 bg-surface-container-low focus:ring-primary"
            placeholder="shpat_xxxxxxxxxxxxxxxxxxxxx"
          />
        </FormField>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="link"
            onClick={() => goToStep(2)}
            className="h-12 px-4 text-on-surface-variant"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver al paso 2
          </Button>
          <FormSubmit
            className="h-12 bg-primary px-6 font-semibold text-white"
            fetchStatus={fetchStatus}
            buttonProps={{ label: "Conectar tienda" }}
          />
        </div>
      </Form>
    </Card>
  );
}
