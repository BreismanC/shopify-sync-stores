export enum SubscriptionPlan {
  TRIAL = 'TRIAL',
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

/**
 * Moneda por defecto del catálogo. Refleja la expectativa del producto
 * (mercado colombiano), pero sigue siendo override-able vía
 * `MERCADOPAGO_CURRENCY` en runtime.
 *
 * MercadoPago exige valores enteros (sin fracciones) para monedas como
 * COP, ARS, CLP, PEN, etc. Por eso los precios en `PLAN_PRICING` se
 * redondean a entero en cada tier.
 */
export const PLAN_CURRENCY = 'COP' as const;

/**
 * Precios en pesos colombianos (COP).
 *
 * - Mensual: valor vigente del plan por mes.
 * - Anual:   12 meses con 15% de descuento (es decir, se paga el 85% del total).
 *
 * Cálculo (mensual × 12 × 0.85):
 * - BASIC     : 29.000 × 12 = 348.000 × 0.85 = 295.800
 * - PRO       : 79.000 × 12 = 948.000 × 0.85 = 805.800
 * - ENTERPRISE: 199.000 × 12 = 2.388.000 × 0.85 = 2.029.800
 *
 * Estos valores se envían a MercadoPago como `transaction_amount` /
 * `unit_price` en `createPreapproval` y `createPreference` del
 * `MercadoPagoService`.
 *
 * Nota: `TRIAL` no tiene precio (es gratis). Los consumidores deben
 * usar `PLAN_PRICING[TRIAL]?.monthly ?? 0` o, idealmente, nunca
 * indexar este mapa con `TRIAL` (filtrar antes en domain code).
 */
export const PLAN_PRICING = {
  [SubscriptionPlan.TRIAL]: { monthly: 0, yearly: 0 },
  [SubscriptionPlan.BASIC]: { monthly: 29_000, yearly: 295_800 },
  [SubscriptionPlan.PRO]: { monthly: 79_000, yearly: 805_800 },
  [SubscriptionPlan.ENTERPRISE]: { monthly: 199_000, yearly: 2_029_800 },
} as const satisfies Record<SubscriptionPlan, { monthly: number; yearly: number }>;
