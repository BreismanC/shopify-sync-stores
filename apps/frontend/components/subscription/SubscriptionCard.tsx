"use client";

import { SubscriptionPlan, SubscriptionStatus } from '@shopify-sync/database/enums';
import { PLAN_LIMITS } from './subscription-plans';
import { SubscriptionStatusBadge } from './SubscriptionStatusBadge';
import { Progress } from '@/components/ui/Progress';
import { Button } from '@/components/ui/Button';
import { PLAN_FEATURES } from './subscription-plans';

interface SubscriptionUsage {
  connections: number;
  stores: number;
  users: number;
}

interface Props {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  billingPeriod: 'MONTHLY' | 'YEARLY';
  trialEndDate?: Date | null;
  nextBillingDate?: Date | null;
  usage: SubscriptionUsage;
  onUpgrade: () => void;
  onCancel: () => void;
  onManage: () => void;
}

export function SubscriptionCard({
  plan,
  status,
  billingPeriod,
  trialEndDate,
  nextBillingDate,
  usage,
  onUpgrade,
  onCancel,
  onManage,
}: Props) {
  const limits = PLAN_LIMITS[plan];
  const features = PLAN_FEATURES[plan];

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const usagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0;
    return Math.min(Math.round((used / limit) * 100), 100);
  };

  const renderProgress = (label: string, used: number, limit: number) => {
    if (limit === -1) {
      return (
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-12">{label}</span>
            <span className="text-gray-11 font-medium">
              {used} / ∞
            </span>
          </div>
          <Progress value={0} className="w-full" />
        </div>
      );
    }
    return (
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-12">{label}</span>
          <span className="text-gray-11 font-medium">
            {used} / {limit}
          </span>
        </div>
        <Progress value={usagePercentage(used, limit)} className="w-full" />
      </div>
    );
  };

  const isTrial = plan === SubscriptionPlan.TRIAL;
  const isEnterprise = plan === SubscriptionPlan.ENTERPRISE;
  const canCancel = !isTrial && status !== SubscriptionStatus.CANCELED;
  const canUpgrade = !isEnterprise;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-6 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-gray-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-bold text-gray-12">
                Plan {plan}
              </h3>
              <SubscriptionStatusBadge status={status} />
            </div>
            <p className="text-sm text-gray-11 mt-1">
              Facturación{' '}
              {billingPeriod === 'MONTHLY' ? 'mensual' : 'anual'}
              {isTrial && trialEndDate && (
                <span> — Trial hasta {formatDate(trialEndDate)}</span>
              )}
              {!isTrial && nextBillingDate && (
                <span> — Próximo cobro: {formatDate(nextBillingDate)}</span>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            {canUpgrade && (
              <Button
                mode="fill"
                size="sm"
                onClick={onUpgrade}
                label="Hacer upgrade"
              />
            )}
            {canCancel && (
              <Button
                mode="pill"
                size="sm"
                onClick={onCancel}
                label="Cancelar"
              />
            )}
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="p-4 sm:p-6 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-12 mb-3">
            Uso actual
          </h4>
          <div className="space-y-3">
            {renderProgress(
              'Conexiones',
              usage.connections,
              limits.connections
            )}
            {renderProgress('Tiendas', usage.stores, limits.stores)}
            {renderProgress('Usuarios', usage.users, limits.users)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-12">
              {limits.connections === -1 ? '∞' : limits.connections}
            </div>
            <div className="text-xs text-gray-11">Conexiones máx.</div>
          </div>
          <div className="text-center border-l border-gray-6">
            <div className="text-2xl font-bold text-gray-12">
              {limits.stores === -1 ? '∞' : limits.stores}
            </div>
            <div className="text-xs text-gray-11">Tiendas máx.</div>
          </div>
          <div className="text-center border-l border-gray-6">
            <div className="text-2xl font-bold text-gray-12">
              {limits.users === -1 ? '∞' : limits.users}
            </div>
            <div className="text-xs text-gray-11">Usuarios máx.</div>
          </div>
        </div>

        {features.length > 0 && (
          <div className="pt-4 border-t border-gray-6">
            <h4 className="text-sm font-semibold text-gray-12 mb-2">
              Características incluidas
            </h4>
            <ul className="grid grid-cols-2 gap-1 text-sm text-gray-11">
              {features.map((feat) => (
                <li key={feat} className="flex items-center gap-1">
                  <span className="text-success">✓</span>
                  {feat}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Footer actions */}
      {status === SubscriptionStatus.ACTIVE && (
        <div className="px-4 sm:px-6 py-3 bg-gray-2 border-t border-gray-6 flex justify-end">
          <Button
            mode="link"
            size="sm"
            onClick={onManage}
            label="Gestionar suscripción"
          />
        </div>
      )}
    </div>
  );
}
