"use client";

import { SubscriptionStatus } from '@shopify-sync/database/enums';
import { cn } from '@/utils/class-names';

const statusConfig: Record<
  SubscriptionStatus,
  { label: string; className: string }
> = {
  [SubscriptionStatus.ACTIVE]: {
    label: 'Activo',
    className: 'bg-success text-success-contrast',
  },
  [SubscriptionStatus.EXPIRED]: {
    label: 'Expirado',
    className: 'bg-danger text-danger-contrast',
  },
  [SubscriptionStatus.PENDING_PAYMENT]: {
    label: 'Pendiente de pago',
    className: 'bg-warning text-warning-contrast',
  },
  [SubscriptionStatus.SUSPENDED]: {
    label: 'Suspendido',
    className: 'bg-orange-500 text-white',
  },
  [SubscriptionStatus.CANCELED]: {
    label: 'Cancelado',
    className: 'bg-gray-5 text-gray-12',
  },
};

interface Props {
  status: SubscriptionStatus;
  className?: string;
}

export function SubscriptionStatusBadge({ status, className }: Props) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
