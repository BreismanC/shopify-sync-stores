import { SubscriptionPlan, BillingPeriod } from '@shopify-sync/database/enums';

export const PLAN_PRICING: Record<SubscriptionPlan, Record<BillingPeriod, number>> = {
  [SubscriptionPlan.TRIAL]: {
    [BillingPeriod.MONTHLY]: 0,
    [BillingPeriod.YEARLY]: 0,
  },
  [SubscriptionPlan.BASIC]: {
    [BillingPeriod.MONTHLY]: 29,
    [BillingPeriod.YEARLY]: 290,
  },
  [SubscriptionPlan.PRO]: {
    [BillingPeriod.MONTHLY]: 79,
    [BillingPeriod.YEARLY]: 790,
  },
  [SubscriptionPlan.ENTERPRISE]: {
    [BillingPeriod.MONTHLY]: 199,
    [BillingPeriod.YEARLY]: 1990,
  },
};

export const PLAN_LIMITS: Record<
  SubscriptionPlan,
  { connections: number; stores: number; users: number }
> = {
  [SubscriptionPlan.TRIAL]: { connections: 2, stores: 1, users: 2 },
  [SubscriptionPlan.BASIC]: { connections: 10, stores: 3, users: 5 },
  [SubscriptionPlan.PRO]: { connections: 50, stores: 10, users: 20 },
  [SubscriptionPlan.ENTERPRISE]: { connections: -1, stores: -1, users: -1 },
};

export const PLAN_FEATURES: Record<SubscriptionPlan, string[]> = {
  [SubscriptionPlan.TRIAL]: [
    'Prueba gratis por 7 días',
    'Sincronización básica',
    'Soporte por email',
    'Hasta 2 conexiones',
  ],
  [SubscriptionPlan.BASIC]: [
    'Sincronización avanzada',
    'Reportes básicos',
    'Soporte por email',
    'API de integrations',
    'Hasta 10 conexiones',
  ],
  [SubscriptionPlan.PRO]: [
    'Sincronización premium',
    'Reportes avanzados',
    'Soporte prioritario',
    'API completa',
    'Webhooks',
    'Hasta 50 conexiones',
  ],
  [SubscriptionPlan.ENTERPRISE]: [
    'Todo lo de PRO',
    'Sincronización ilimitada',
    'Soporte dedicado',
    ' SLA 99.9%',
    'Personalización avanzada',
    'Cuenta dedicada',
  ],
};
