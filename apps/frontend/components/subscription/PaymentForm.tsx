"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { SubscriptionPlan, BillingPeriod } from "@shopify-sync/database/enums";
import { PLAN_PRICING } from "./subscription-plans";
import { Button } from "@/components/ui/Button";
import DialogModal from "@/components/DialogModal";

interface Props {
  planType: SubscriptionPlan;
  billingPeriod: BillingPeriod;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export function PaymentForm({ planType, billingPeriod, open, onClose, onSuccess, onError }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { data: session } = useSession();
  const price = PLAN_PRICING[planType][billingPeriod];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsProcessing(true);
    try {
      const response = await fetch("/api/subscriptions/create-preapproval", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
        },
        body: JSON.stringify({ planType, billingPeriod }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "No se pudo iniciar el pago");
      if (!data.initPoint) throw new Error("Mercado Pago no devolvió el enlace de pago");
      window.location.href = data.initPoint;
      onSuccess();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <DialogModal
      container="smash"
      className="sm:max-w-[480px]"
      open={open}
      onOpenChange={(value) => !isProcessing && !value && onClose()}
      title="Cambiar de plan"
      description="Confirma el plan que deseas contratar para continuar con Mercado Pago."
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" mode="link" onClick={onClose} disabled={isProcessing}>Volver</Button>
          <Button type="submit" form="change-plan-form" mode="fill" isLoading={isProcessing} isLoadingText="Redirigiendo..." disabled={isProcessing}>Ir a Mercado Pago</Button>
        </div>
      }
    >
      <form id="change-plan-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-gray-6 bg-gray-2 p-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-11">Plan {planType}</span>
            <span className="font-semibold text-gray-12">COP ${new Intl.NumberFormat("es-CO").format(price)}</span>
          </div>
          <p className="mt-1 text-xs text-gray-11">Facturación {billingPeriod === BillingPeriod.MONTHLY ? "mensual" : "anual"}</p>
        </div>
        <div className="space-y-2 text-sm text-gray-11">
          <p>Serás redirigido a un checkout seguro de Mercado Pago para completar el pago y autorizar la suscripción recurrente.</p>
          <p>El cambio quedará pendiente hasta que Mercado Pago confirme el primer pago mediante el webhook.</p>
        </div>
      </form>
    </DialogModal>
  );
}
