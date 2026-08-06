"use client";

import { useState } from "react";
import { SubscriptionPlan, BillingPeriod } from "@shopify-sync/database/enums";
import { PLAN_PRICING, PLAN_LIMITS, PLAN_FEATURES } from "./subscription-plans";
import { PaymentForm } from "./PaymentForm";
import { cn } from "@/utils/class-names";

interface Props {
  onSelect: (plan: SubscriptionPlan, billingPeriod: BillingPeriod) => void;
}

const PLAN_ORDER = [SubscriptionPlan.TRIAL, SubscriptionPlan.BASIC, SubscriptionPlan.PRO, SubscriptionPlan.ENTERPRISE];

export function PlanSelector({ onSelect }: Props) {
  const [billingPeriod, setBillingPeriod] = useState(BillingPeriod.MONTHLY);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showPayment, setShowPayment] = useState(false);

  const choosePlan = (plan: SubscriptionPlan) => {
    if (plan === SubscriptionPlan.TRIAL) {
      onSelect(plan, billingPeriod);
      return;
    }
    setSelectedPlan(plan);
    setShowPayment(true);
  };

  const formatPrice = (plan: SubscriptionPlan) => {
    const price = PLAN_PRICING[plan][billingPeriod];
    return price === 0 ? "Gratis" : `$${new Intl.NumberFormat("es-CO").format(price)}`;
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-lg border border-gray-6 bg-gray-3 p-1">
        {[BillingPeriod.MONTHLY, BillingPeriod.YEARLY].map((period) => (
          <button
            key={period}
            type="button"
            onClick={() => setBillingPeriod(period)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              billingPeriod === period ? "bg-accent-9 text-white shadow-sm" : "text-gray-11 hover:text-gray-12",
            )}
          >
            {period === BillingPeriod.MONTHLY ? "Mensual" : "Anual (2 meses off)"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((plan) => {
          const limits = PLAN_LIMITS[plan];
          const features = PLAN_FEATURES[plan];
          const selected = selectedPlan === plan;
          const description = plan === SubscriptionPlan.TRIAL
            ? "Para probar la sincronización."
            : plan === SubscriptionPlan.BASIC
              ? "Para tiendas que recién empiezan."
              : plan === SubscriptionPlan.PRO
                ? "Para equipos en crecimiento."
                : "Sin límites, soporte prioritario.";

          return (
            <button
              key={plan}
              type="button"
              onClick={() => choosePlan(plan)}
              className={cn(
                "flex min-h-[304px] flex-col rounded-xl border-2 bg-gray-1 p-5 text-left transition-all",
                selected ? "border-accent-9 shadow-sm" : "border-gray-6 hover:border-accent-9/50",
              )}
            >
              <span className="text-base font-semibold text-gray-12">{plan}</span>
              <span className="mt-1 text-xs text-gray-11">{description}</span>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-12">{formatPrice(plan)}</span>
                <span className="text-sm text-gray-11">
                  {plan === SubscriptionPlan.TRIAL ? "7 días" : billingPeriod === BillingPeriod.MONTHLY ? "/mes" : "/año"}
                </span>
              </div>
              <ul className="mt-4 space-y-1.5 text-sm text-gray-11">
                {[limits.connections === -1 ? "Conexiones ilimitadas" : `${limits.connections} conexiones`, limits.stores === -1 ? "Tiendas ilimitadas" : `${limits.stores} tiendas`, limits.users === -1 ? "Miembros ilimitados" : `${limits.users} miembros de equipo`, ...features.slice(0, 2)].map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5">
                    <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent-9" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-auto pt-5 text-sm font-semibold text-accent-9">Elegir plan</span>
            </button>
          );
        })}
      </div>

      {selectedPlan && (
        <PaymentForm
          planType={selectedPlan}
          billingPeriod={billingPeriod}
          open={showPayment}
          onClose={() => { setShowPayment(false); setSelectedPlan(null); }}
          onSuccess={() => { setShowPayment(false); setSelectedPlan(null); onSelect(selectedPlan, billingPeriod); }}
          onError={(error) => console.error("Payment error:", error)}
        />
      )}
    </div>
  );
}
