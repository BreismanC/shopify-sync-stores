"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriptionPlan, SubscriptionStatus } from '@shopify-sync/database/enums';
import { SubscriptionCard } from '@/components/subscription/SubscriptionCard';
import { Button } from '@/components/ui/Button';

interface SubscriptionData {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingPeriod: 'MONTHLY' | 'YEARLY';
  trialEndDate: Date | null;
  nextBillingDate: Date | null;
  usage: {
    connections: number;
    stores: number;
    users: number;
  };
}

// Mock data - in production this would come from an API call via SWR
const MOCK_SUBSCRIPTION: SubscriptionData = {
  plan: SubscriptionPlan.TRIAL,
  status: SubscriptionStatus.ACTIVE,
  billingPeriod: 'MONTHLY',
  trialEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
  nextBillingDate: null,
  usage: {
    connections: 1,
    stores: 1,
    users: 1,
  },
};

interface Props {
  subscription?: SubscriptionData;
}

export default function SubscriptionPage({ subscription }: Props) {
  const router = useRouter();
  const [subscriptionData] = useState<SubscriptionData>(
    subscription ?? MOCK_SUBSCRIPTION
  );

  const isTrial = subscriptionData.plan === SubscriptionPlan.TRIAL;
  const isEnterprise = subscriptionData.plan === SubscriptionPlan.ENTERPRISE;

  const handleUpgrade = () => {
    router.push('/subscription/plans');
  };

  const handleCancel = async () => {
    if (
      window.confirm(
        '¿Estás seguro de que quieres cancelar tu suscripción? Perderás acceso a las funcionalidades premium.'
      )
    ) {
      try {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
        const response = await fetch(
          `${backendUrl}/api/subscriptions/cancel`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (response.ok) {
          window.location.reload();
        } else {
          alert('Error al cancelar la suscripción');
        }
      } catch {
        alert('Error al cancelar la suscripción');
      }
    }
  };

  const handleManage = () => {
    router.push('/subscription/plans');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Suscripción</h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestiona tu plan y revisa tu uso
          </p>
        </div>

        {!isEnterprise && (
          <Button
            mode="fill"
            size="md"
            onClick={handleUpgrade}
            label={
              isTrial ? 'Mejoras tu plan' : 'Cambiar de plan'
            }
          />
        )}
      </div>

      <SubscriptionCard
        plan={subscriptionData.plan}
        status={subscriptionData.status}
        billingPeriod={subscriptionData.billingPeriod}
        trialEndDate={subscriptionData.trialEndDate}
        nextBillingDate={subscriptionData.nextBillingDate}
        usage={subscriptionData.usage}
        onUpgrade={handleUpgrade}
        onCancel={handleCancel}
        onManage={handleManage}
      />
    </div>
  );
}
