import { SubscriptionPlan, BillingPeriod } from '@shopify-sync/database/enums';

/**
 * Moneda por defecto del catálogo. Debe coincidir con `MERCADOPAGO_CURRENCY`
 * y con `PLAN_CURRENCY` del backend. MercadoPago rechaza decimales para COP.
 */
export const PLAN_CURRENCY = 'COP' as const;

/**
 * Precios en pesos colombianos (COP). Reflejan el backend
 * `apps/backend/src/domain/enums/subscription-plan.enum.ts`.
 *
 * - Mensual: valor vigente del plan por mes.
 * - Anual:   12 meses con 15% de descuento (se paga el 85%).
 *
 * Mantener estos números sincronizados con el backend es importante
 * porque el frontend muestra el monto antes de iniciar el checkout
 * pro. El monto final que se envía a MercadoPago es el del backend.
 */
export const PLAN_PRICING: Record<SubscriptionPlan, Record<BillingPeriod, number>> = {
  [SubscriptionPlan.TRIAL]: {
    [BillingPeriod.MONTHLY]: 0,
    [BillingPeriod.YEARLY]: 0,
  },
  [SubscriptionPlan.BASIC]: {
    [BillingPeriod.MONTHLY]: 29_000,
    [BillingPeriod.YEARLY]: 295_800,
  },
  [SubscriptionPlan.PRO]: {
    [BillingPeriod.MONTHLY]: 79_000,
    [BillingPeriod.YEARLY]: 805_800,
  },
  [SubscriptionPlan.ENTERPRISE]: {
    [BillingPeriod.MONTHLY]: 199_000,
    [BillingPeriod.YEARLY]: 2_029_800,
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
