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
import {
  apiFetch,
  resolveOnboardingHref,
  useSyncSessionAndNavigate,
} from "@/lib/auth";
import { BACKEND_URL } from "@/lib/env";
import {
  StoreWebhooksDetails,
  type WebhooksSummary,
} from "./StoreWebhooksDetails";

interface StoreInfo {
  id: string;
  shopifyShopId: string;
  role: "SOURCE" | "VENDOR";
  isActive: boolean;
}

export function Step3Store() {
  const { goToStep } = useOnboardingNavigation();
  const { data: session, status } = useSession();
  const syncAndNavigate = useSyncSessionAndNavigate();
  const accessToken = session?.accessToken as string | undefined;

  const [existingStore, setExistingStore] = useState<StoreInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [webhooksSummary, setWebhooksSummary] = useState<WebhooksSummary>({
    total: 0,
    connected: 0,
    pending: 0,
    failed: 0,
    allConnected: false,
  });

  const { field, getValues, setValue, setFetchStatus, fetchStatus, setTouch } =
    useFormDynamic({
      shopifyShopUrl: "text",
      shopifyAccessToken: "text",
    });

  const shopUrlField = field("shopifyShopUrl");
  const accessTokenField = field("shopifyAccessToken");

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
          setExistingStore(data.store);
          setValue((prev) => ({
            ...prev,
            shopifyShopUrl: data.store!.shopifyShopId,
          }));
        }
      } catch (err) {
        console.error("Error fetching store status:", err);
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
    const values = getValues() as {
      shopifyShopUrl: string;
      shopifyAccessToken: string;
    };
    const formData = new FormData(e.currentTarget);
    const shopifyShopUrl = String(
      values.shopifyShopUrl || formData.get("shopifyShopUrl") || "",
    ).trim();
    const shopifyAccessToken = String(
      values.shopifyAccessToken || formData.get("shopifyAccessToken") || "",
    ).trim();

    // Tienda ya conectada y sin token nuevo → confirmar y avanzar status.
    if (existingStore && shopifyAccessToken.length < 10) {
      // Bloqueamos el avance si los webhooks todavía no están todos
      // conectados. El backend igual valida y devuelve 409 si esto se
      // cuela; acá evitamos el round-trip y le damos feedback inmediato.
      if (!webhooksSummary.allConnected) {
        toast.error(
          "Esperá a que todos los webhooks estén conectados antes de continuar.",
        );
        return;
      }
      setFetchStatus("loading");
      try {
        const data = await apiFetch<{
          store: StoreInfo;
          onboardingStatus: OnboardingStatus;
        }>(
          `${BACKEND_URL}/api/onboarding/store/confirm`,
          { method: "POST" },
          accessToken,
        );
        toast.success("Tienda conectada");
        setFetchStatus("success");
        // `forceReload: true` fuerza una full navigation con
        // `window.location.href`, garantizando que el server component destino
        // ejecute `auth()` con la cookie recién escrita. Sin esto, el server
        // puede leer el JWT viejo y mandarnos al step anterior.
        await syncAndNavigate(
          { onboardingStatus: data.onboardingStatus },
          resolveOnboardingHref(data.onboardingStatus),
          { forceReload: true },
        );
      } catch (err: any) {
        const message =
          err?.body?.code === "WEBHOOKS_NOT_READY"
            ? "Hay webhooks obligatorios sin conectar. Esperá a que finalicen o reintentá."
            : err?.message || "Error al continuar";
        toast.error(message);
        setFetchStatus("error");
      }
      return;
    }

    if (!shopifyShopUrl.includes(".myshopify.com")) {
      toast.error("Ingresá un dominio válido (ej: mi-tienda.myshopify.com)");
      setTouch({ shopifyShopUrl: true });
      return;
    }
    if (shopifyAccessToken.length < 10) {
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
            shopifyShopUrl,
            shopifyAccessToken,
          }),
        },
        accessToken,
      );

      toast.success("Tienda conectada");
      setFetchStatus("success");
      const href = resolveOnboardingHref(data.onboardingStatus);
      await syncAndNavigate({ onboardingStatus: data.onboardingStatus }, href, {
        forceReload: true,
      });
    } catch (err: any) {
      const message =
        err?.body?.code === "WEBHOOKS_REGISTRATION_FAILED"
          ? "Algunos webhooks obligatorios no pudieron registrarse. Revisa los detalles y reintentá."
          : err?.message || "Error al conectar la tienda";
      toast.error(message);
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
    <Card className="rounded-xl border border-gray-6 bg-gray-1 p-6 sm:p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-12 tracking-tight">
        Conectá tu tienda Shopify
      </h2>
      <p className="mt-1 text-sm text-gray-11">
        Necesitás una <strong>Custom App</strong> instalada en tu tienda con
        permisos de lectura. Generá el access token desde el admin de Shopify
        (Settings → Apps → Develop apps).
      </p>

      {existingStore ? (
        <div className="mt-6 rounded-lg border border-accent-9/20 bg-accent-9/5 p-4 text-sm">
          <p className="font-medium text-gray-12">
            Ya tenés una tienda conectada:{" "}
            <span className="text-accent-9">{existingStore.shopifyShopId}</span>
          </p>
          <p className="mt-1 text-gray-11">
            Si querés cambiar la tienda, completá los datos de abajo. Si está
            bien, podés continuar al paso siguiente.
          </p>
        </div>
      ) : null}

      <Form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 [&_label]:block [&_label]:text-xs [&_label]:font-bold [&_label]:uppercase [&_label]:tracking-wider [&_label]:pb-2 [&_label]:text-gray-11 [&_[data-slot=input]]:h-12 [&_[data-slot=input]]:bg-gray-1 [&_[data-slot=input]]:border [&_[data-slot=input]]:border-gray-6 [&_[data-slot=input]]:rounded-lg [&_[data-slot=input]]:text-gray-12 [&_[data-slot=input]]:placeholder:text-gray-11 [&_[data-slot=input]]:focus:outline-none [&_[data-slot=input]]:focus:border-accent-9 [&_[data-slot=input]]:focus:ring-2 [&_[data-slot=input]]:focus:ring-accent-9/50"
      >
        <FormField
          name="shopifyShopUrl"
          label="Dominio de la tienda"
          field={shopUrlField}
        >
          <Input
            name="shopifyShopUrl"
            placeholder="mi-tienda.myshopify.com"
            value={String(shopUrlField.value ?? "")}
            onChange={shopUrlField.onChange}
          />
        </FormField>

        <FormField
          name="shopifyAccessToken"
          label="Access token (Admin API)"
          field={accessTokenField}
        >
          <Input
            name="shopifyAccessToken"
            type="password"
            placeholder="shpat_xxxxxxxxxxxxxxxxxxxxx"
            value={String(accessTokenField.value ?? "")}
            onChange={accessTokenField.onChange}
          />
        </FormField>

        <StoreWebhooksDetails
          accessToken={accessToken}
          initiallyOpen={Boolean(existingStore)}
          onChange={setWebhooksSummary}
        />

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="link"
            onClick={() => goToStep(2)}
            className="h-12 px-4 text-gray-11 hover:bg-gray-3 hover:text-gray-12"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver al paso 2
          </Button>
          <FormSubmit
            className="h-12 px-6 font-semibold bg-accent-9 hover:bg-accent-10 text-white rounded-lg shadow-sm hover:!transform-none active:!transform-none disabled:cursor-not-allowed disabled:opacity-50"
            fetchStatus={fetchStatus}
            disabled={Boolean(
              existingStore &&
              !webhooksSummary.allConnected &&
              webhooksSummary.total > 0,
            )}
            buttonProps={{
              label: existingStore
                ? webhooksSummary.total === 0
                  ? "Cargando webhooks…"
                  : webhooksSummary.allConnected
                    ? "Continuar"
                    : "Esperando webhooks…"
                : "Conectar tienda",
            }}
          />
        </div>
      </Form>
    </Card>
  );
}
