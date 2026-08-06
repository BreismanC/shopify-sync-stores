"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { SubscriptionPlan, SubscriptionStatus } from "@shopify-sync/database/enums";
import { useAuthFetch, apiFetch } from "@/lib/auth/fetch-with-auth";
import { Button } from "@/components/ui/Button";
import DialogModal from "@/components/DialogModal";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { SubscriptionStatusBadge } from "@/components/subscription/SubscriptionStatusBadge";
import { PlanSelector } from "@/components/subscription/PlanSelector";

type SubscriptionResponse = {
  subscription: {
    planType: SubscriptionPlan;
    status: SubscriptionStatus;
    billingPeriod: "MONTHLY" | "YEARLY";
    nextBillingDate?: string;
    amountPaid: number;
  };
  maxConnections: number;
  maxStores: number;
  maxTeamMembers: number;
};

const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  TRIAL: "Prueba",
  BASIC: "Basic",
  PRO: "Pro",
  ENTERPRISE: "Enterprise",
};

const formatDate = (value?: string) => value
  ? new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date(value))
  : "—";

export default function BillingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { data, error, isLoading, mutate } = useAuthFetch<SubscriptionResponse>("/api/subscriptions/me");
  const [showPlans, setShowPlans] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const cancelSubscription = async () => {
    setCanceling(true);
    try {
      await apiFetch("/api/subscriptions/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancelación desde facturación" }),
      }, session?.accessToken);
      setCancelOpen(false);
      await mutate();
    } catch (cancelError) {
      window.alert(cancelError instanceof Error ? cancelError.message : "No se pudo cancelar");
    } finally {
      setCanceling(false);
    }
  };

  if (isLoading) return <div className="mx-auto flex w-full max-w-[1280px] justify-center p-6 text-sm text-gray-11">Cargando información de facturación...</div>;
  if (error || !data) return <Alert variant="danger" className="m-6"><AlertDescription>No pudimos cargar tu suscripción. Intenta nuevamente.</AlertDescription></Alert>;

  const subscription = data.subscription;
  const isPaid = subscription.planType !== SubscriptionPlan.TRIAL;

  return (
    <main className="mx-auto w-full max-w-[1280px] space-y-6 px-5 py-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-11">Cuenta</p>
          <h1 className="mt-1 text-[28px] font-semibold leading-[34px] tracking-tight text-gray-12">Plan y facturación</h1>
          <p className="mt-1 text-sm leading-5 text-gray-11">Administra tu suscripción y revisa los límites de tu espacio de trabajo.</p>
        </div>
        <Button mode="pill" size="sm" onClick={() => router.push("/dashboard")}>Volver al dashboard</Button>
      </header>

      {subscription.status === SubscriptionStatus.PENDING_PAYMENT && (
        <Alert variant="warning"><AlertDescription>Tu cambio de plan está pendiente de confirmación de Mercado Pago.</AlertDescription></Alert>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-sm text-gray-11">Plan actual</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-12">{PLAN_LABELS[subscription.planType]}</h2><p className="mt-2 text-sm text-gray-11">Facturación {subscription.billingPeriod === "MONTHLY" ? "mensual" : "anual"}</p></div>
            <SubscriptionStatusBadge status={subscription.status} />
          </div>
          <div className="mt-6 grid gap-4 border-t border-gray-6 pt-5 sm:grid-cols-2">
            <div><p className="text-xs font-bold uppercase tracking-wider text-gray-11">Próximo cobro</p><p className="mt-1 text-sm font-medium text-gray-12">{formatDate(subscription.nextBillingDate)}</p></div>
            <div><p className="text-xs font-bold uppercase tracking-wider text-gray-11">Total pagado</p><p className="mt-1 text-sm font-medium text-gray-12">COP ${new Intl.NumberFormat("es-CO").format(subscription.amountPaid)}</p></div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button mode="fill" size="sm" onClick={() => setShowPlans(true)}>{isPaid ? "Cambiar de plan" : "Elegir un plan"}</Button>
            {isPaid && subscription.status !== SubscriptionStatus.CANCELED && <Button mode="pill" size="sm" onClick={() => setCancelOpen(true)}>Cancelar suscripción</Button>}
          </div>
        </div>

        <div className="rounded-lg border border-gray-6 bg-gray-1 p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-12">Límites incluidos</p>
          <div className="mt-4 space-y-4">{[["Conexiones", data.maxConnections], ["Tiendas", data.maxStores], ["Miembros del equipo", data.maxTeamMembers]].map(([name, value]) => <div key={name as string} className="flex items-center justify-between border-b border-gray-6 pb-3 text-sm last:border-b-0 last:pb-0"><span className="text-gray-11">{name}</span><span className="font-semibold text-gray-12">{value === -1 ? "Ilimitados" : value}</span></div>)}</div>
          <p className="mt-6 text-xs leading-5 text-gray-11">Los límites se actualizan cuando Mercado Pago confirma el plan.</p>
        </div>
      </section>

      {showPlans && <section className="rounded-xl border border-gray-6 bg-gray-1 p-6 shadow-sm sm:p-8"><div className="mb-6 flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold tracking-tight text-gray-12">Compara y cambia de plan</h2><p className="mt-1 text-sm text-gray-11">Selecciona un plan para iniciar un checkout pendiente.</p></div><Button mode="link" size="sm" onClick={() => setShowPlans(false)}>Cerrar</Button></div><PlanSelector onSelect={() => { setShowPlans(false); void mutate(); }} /></section>}

      <DialogModal
        container="smash"
        open={cancelOpen}
        onOpenChange={(open) => !canceling && setCancelOpen(open)}
        title="Cancelar suscripción"
        description="Confirma que deseas cancelar la renovación de tu plan."
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" mode="link" onClick={() => setCancelOpen(false)} disabled={canceling}>Volver</Button>
            <Button type="button" mode="fill" onClick={cancelSubscription} isLoading={canceling} isLoadingText="Cancelando..." className="bg-danger text-danger-contrast hover:bg-danger/80">Confirmar cancelación</Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-gray-11">
          <p>La suscripción se cancelará también en Mercado Pago y no se generarán nuevos cobros recurrentes.</p>
          <p>Tu estado se actualizará cuando Mercado Pago confirme la cancelación mediante su webhook.</p>
        </div>
      </DialogModal>
    </main>
  );
}
