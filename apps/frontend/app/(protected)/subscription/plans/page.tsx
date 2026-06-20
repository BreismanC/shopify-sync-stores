"use client";

import { useRouter } from 'next/navigation';
import { SubscriptionPlan, BillingPeriod } from '@shopify-sync/database/enums';
import { PlanSelector } from '@/components/subscription/PlanSelector';

export default function PlansPage() {
  const router = useRouter();

  const handleSelect = async (plan: SubscriptionPlan, billingPeriod: BillingPeriod) => {
    // For TRIAL, directly start the trial
    if (plan === SubscriptionPlan.TRIAL) {
      try {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        await fetch(`${backendUrl}/api/subscriptions/start-trial`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planType: plan }),
        });
        router.push('/subscription');
      } catch (error) {
        console.error('Error starting trial:', error);
      }
      return;
    }

    // For paid plans, proceed to payment via PlanSelector which handles PaymentForm
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          Elige tu plan
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Compara nuestros planes y elige el que mejor se adapte a tu negocio
        </p>
      </div>

      <PlanSelector onSelect={handleSelect} />
    </div>
  );
}
