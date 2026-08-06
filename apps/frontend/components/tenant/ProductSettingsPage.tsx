"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardTitle } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { fetchWithAuth, useAuthFetch } from "@/lib/auth/fetch-with-auth";

type Rules = Record<string, any>;
type Settings = { productRules: Rules; orderRules: Rules; inventoryRules: Rules };

const productFields = [
  ["title", "Título"],
  ["description", "Descripción"],
  ["images", "Imágenes"],
  ["vendor", "Vendor"],
  ["productType", "Tipo de producto"],
  ["tags", "Tags"],
  ["price", "Precio"],
  ["variants", "Variantes"],
] as const;

const defaults: Settings = {
  productRules: {
    title: true,
    description: true,
    images: true,
    vendor: true,
    productType: true,
    tags: true,
    price: true,
    variants: true,
    options: true,
    skuStrategy: "SOURCE_SKU",
    publicationStatus: "DRAFT",
    commissionPercentage: 0,
    commissionFixed: 0,
  },
  orderRules: { autoCreateOrders: true, vendorBillingAddress: {} },
  inventoryRules: { sourceOfTruth: "SOURCE", preventNegative: true },
};

export default function ProductSettingsPage({ tenantId }: { tenantId: string }) {
  const { data: session } = useSession();
  const { data, isLoading, mutate } = useAuthFetch<Settings>(
    `/api/tenant/${tenantId}/sync-settings`,
  );
  const [settings, setSettings] = useState<Settings>(defaults);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setSettings({
      productRules: { ...defaults.productRules, ...data.productRules },
      orderRules: { ...defaults.orderRules, ...data.orderRules },
      inventoryRules: { ...defaults.inventoryRules, ...data.inventoryRules },
    });
  }, [data]);

  const update = (section: keyof Settings, key: string, value: unknown) => {
    setSettings((current) => ({
      ...current,
      [section]: { ...current[section], [key]: value },
    }));
  };

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await fetchWithAuth(
        `/api/tenant/${tenantId}/sync-settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        },
        session?.accessToken,
      );
      setMessage("Configuración guardada correctamente.");
      void mutate();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible guardar la configuración.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <main className="mx-auto w-full max-w-[1440px] px-4 py-5 text-sm text-gray-11 sm:px-6 lg:px-8">Cargando configuración...</main>;
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="border-b border-gray-6 pb-5">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-gray-12">Configuración de productos</h1>
        <p className="mt-1 text-base text-gray-11">Define qué información se sincroniza entre tus tiendas y cómo se procesan los pedidos.</p>
      </header>

      {message && <div className="mt-6 rounded-lg border border-accent-6 bg-accent-2 px-4 py-3 text-sm text-accent-12">{message}</div>}

      <div className="mt-6 grid gap-6">
        <Card className="rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
          <CardTitle className="text-xl font-semibold tracking-tight text-gray-12">Atributos sincronizables</CardTitle>
          <CardContent className="p-0">
            <p className="mt-2 text-sm text-gray-11">Selecciona la información de producto que debe viajar entre las tiendas.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {productFields.map(([key, label]) => (
                <label key={key} className="flex min-h-12 items-center gap-3 rounded-lg border border-gray-6 bg-gray-1 px-3 py-2.5 text-sm text-gray-12 transition-colors hover:border-accent-7 hover:bg-accent-2">
                  <Checkbox
                    checked={Boolean(settings.productRules[key])}
                    disabled={key === "variants"}
                    onCheckedChange={(checked) => update("productRules", key, checked)}
                    className="size-3 shrink-0 border-gray-a7 data-[state=checked]:border-accent-9 data-[state=checked]:bg-accent-3"
                  />
                  <span className="leading-5">{label}{key === "variants" && <small className="ml-1 text-xs text-gray-10">(obligatorio)</small>}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
            <CardTitle className="text-xl font-semibold tracking-tight text-gray-12">Reglas del catálogo</CardTitle>
            <CardContent className="grid gap-4 p-0 pt-5">
              <SelectField label="Estrategia de SKU" value={settings.productRules.skuStrategy} onChange={(value) => update("productRules", "skuStrategy", value)} options={[["SOURCE_SKU", "SKU de la tienda source"], ["GENERATED", "Generar SKU"]]} />
              <SelectField label="Estado de publicación" value={settings.productRules.publicationStatus} onChange={(value) => update("productRules", "publicationStatus", value)} options={[["DRAFT", "Borrador"], ["ACTIVE", "Activo"]]} />
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField label="Comisión porcentual" value={settings.productRules.commissionPercentage} onChange={(value) => update("productRules", "commissionPercentage", value)} />
                <NumberField label="Comisión fija" value={settings.productRules.commissionFixed} onChange={(value) => update("productRules", "commissionFixed", value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
            <CardTitle className="text-xl font-semibold tracking-tight text-gray-12">Inventario y pedidos</CardTitle>
            <CardContent className="grid gap-4 p-0 pt-5">
              <SelectField label="Fuente de verdad del inventario" value={settings.inventoryRules.sourceOfTruth} onChange={(value) => update("inventoryRules", "sourceOfTruth", value)} options={[["SOURCE", "Tienda source"], ["VENDOR", "Tienda vendor"]]} />
              <SettingCheckbox label="Prevenir inventario negativo" checked={settings.inventoryRules.preventNegative !== false} onChange={(checked) => update("inventoryRules", "preventNegative", checked)} />
              <SettingCheckbox label="Crear automáticamente pedidos asociados en la tienda source" checked={settings.orderRules.autoCreateOrders !== false} onChange={(checked) => update("orderRules", "autoCreateOrders", checked)} />
              <div className="rounded-lg border border-gray-6 bg-gray-2 px-3 py-2.5 text-xs leading-5 text-gray-11">La dirección de envío se toma siempre del cliente del pedido vendor. No se configura manualmente en esta pantalla.</div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
          <CardTitle className="text-xl font-semibold tracking-tight text-gray-12">Datos de facturación vendor</CardTitle>
          <CardContent className="p-0">
            <p className="mt-2 text-sm text-gray-11">Estos datos se utilizan al crear pedidos en la tienda source.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[["name", "Nombre"], ["company", "Empresa"], ["address1", "Dirección"], ["city", "Ciudad"], ["state", "Estado"], ["zip", "Código postal"], ["country", "País"], ["phone", "Teléfono"]].map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-gray-11">
                  {label}
                  <Input className="h-12 bg-accent-2 text-sm font-normal normal-case tracking-normal focus:ring-accent-7" placeholder={label} value={settings.orderRules.vendorBillingAddress?.[key] ?? ""} onChange={(event) => setSettings((current) => ({ ...current, orderRules: { ...current.orderRules, vendorBillingAddress: { ...(current.orderRules.vendorBillingAddress ?? {}), [key]: event.target.value } } }))} />
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button className="px-6" onClick={save} isLoading={saving}>Guardar configuración</Button>
        </div>
      </div>
    </main>
  );
}

function SettingCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-10 items-center gap-3 text-sm text-gray-12"><Checkbox checked={checked} onCheckedChange={onChange} className="size-3 shrink-0 border-gray-a7 data-[state=checked]:border-accent-9 data-[state=checked]:bg-accent-3" /><span className="leading-5">{label}</span></label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[] }) {
  return <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-gray-11">{label}<select className="h-12 rounded-md border border-gray-6 bg-accent-2 px-3 text-sm font-normal normal-case tracking-normal text-gray-12 outline-none transition-colors focus:border-accent-7 focus:ring-2 focus:ring-accent-7/50" value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider text-gray-11">{label}<Input type="number" min="0" className="h-12 bg-accent-2 text-sm font-normal normal-case tracking-normal focus:ring-accent-7" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
