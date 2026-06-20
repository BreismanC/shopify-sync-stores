export enum SubscriptionPlan {
  TRIAL = 'TRIAL',
  BASIC = 'BASIC',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export const PLAN_PRICING = {
  [SubscriptionPlan.BASIC]: { monthly: 29, yearly: 290 },
  [SubscriptionPlan.PRO]: { monthly: 79, yearly: 790 },
  [SubscriptionPlan.ENTERPRISE]: { monthly: 199, yearly: 1990 },
};
