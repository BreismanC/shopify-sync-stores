"use client";

import { useState } from 'react';
import { SubscriptionPlan, BillingPeriod } from '@shopify-sync/database/enums';
import { PLAN_PRICING, PLAN_LIMITS, PLAN_FEATURES } from './subscription-plans';
import { Button } from '@/components/ui/Button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { PaymentForm } from './PaymentForm';

interface Props {
  onSelect: (plan: SubscriptionPlan, billingPeriod: BillingPeriod) => void;
}

const PLAN_ORDER: SubscriptionPlan[] = [
  SubscriptionPlan.TRIAL,
  SubscriptionPlan.BASIC,
  SubscriptionPlan.PRO,
  SubscriptionPlan.ENTERPRISE,
];

const BILLING_LABELS: Record<BillingPeriod, string> = {
  [BillingPeriod.MONTHLY]: 'Mensual',
  [BillingPeriod.YEARLY]: 'Anual (-17%)',
};

export function PlanSelector({ onSelect }: Props) {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>(
    BillingPeriod.MONTHLY
  );
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    null
  );
  const [showPayment, setShowPayment] = useState(false);

  const handleChoosePlan = (plan: SubscriptionPlan) => {
    if (plan === SubscriptionPlan.TRIAL) {
      onSelect(plan, billingPeriod);
      return;
    }
    setSelectedPlan(plan);
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    setSelectedPlan(null);
    onSelect(selectedPlan!, billingPeriod);
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment error:', error);
  };

  const formatPrice = (plan: SubscriptionPlan) => {
    const price = PLAN_PRICING[plan][billingPeriod];
    if (price === 0) return 'Gratis';
    return `$${price}`;
  };

  const formatPeriod = (plan: SubscriptionPlan) => {
    if (plan === SubscriptionPlan.TRIAL) return '7 días';
    return billingPeriod === BillingPeriod.MONTHLY ? '/mes' : '/año';
  };

  return (
    <div className="space-y-6">
      {/* Billing period toggle */}
      <div className="flex justify-center gap-4">
        <Button
          mode={billingPeriod === BillingPeriod.MONTHLY ? 'fill' : 'pill'}
          size="md"
          onClick={() => setBillingPeriod(BillingPeriod.MONTHLY)}
        >
          Mensual
        </Button>
        <Button
          mode={billingPeriod === BillingPeriod.YEARLY ? 'fill' : 'pill'}
          size="md"
          onClick={() => setBillingPeriod(BillingPeriod.YEARLY)}
        >
          Anual (ahorra 17%)
        </Button>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLAN_ORDER.map((plan) => {
          const limits = PLAN_LIMITS[plan];
          const features = PLAN_FEATURES[plan];
          const isEnterprise = plan === SubscriptionPlan.ENTERPRISE;

          return (
            <Card
              key={plan}
              className={
                isEnterprise
                  ? 'border-accent-9 bg-accent-1'
                  : undefined
              }
            >
              <CardHeader>
                <CardTitle className="text-lg">{plan}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold">{formatPrice(plan)}</span>
                  <span className="text-sm text-gray-11">{formatPeriod(plan)}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Limits */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-11 uppercase tracking-wide">
                    Límites
                  </div>
                  <ul className="space-y-1 text-sm text-gray-12">
                    <li>
                      •{' '}
                      {limits.connections === -1
                        ? 'Ilimitadas'
                        : `${limits.connections}`}{' '}
                      conexiones
                    </li>
                    <li>
                      •{' '}
                      {limits.stores === -1
                        ? 'Ilimitadas'
                        : `${limits.stores}`}{' '}
                      tiendas
                    </li>
                    <li>
                      •{' '}
                      {limits.users === -1
                        ? 'Ilimitados'
                        : `${limits.users}`}{' '}
                      usuarios
                    </li>
                  </ul>
                </div>

                {/* Features */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-11 uppercase tracking-wide">
                    Características
                  </div>
                  <ul className="space-y-1 text-sm text-gray-12">
                    {features.map((feat) => (
                      <li key={feat}>✓ {feat}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  mode="fill"
                  size="md"
                  className="w-full"
                  onClick={() => handleChoosePlan(plan)}
                >
                  Elegir plan
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Payment Modal */}
      {selectedPlan && (
        <PaymentForm
          planType={selectedPlan}
          billingPeriod={billingPeriod}
          open={showPayment}
          onClose={() => {
            setShowPayment(false);
            setSelectedPlan(null);
          }}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
        />
      )}
    </div>
  );
}
