export const QUEUE_NAMES = {
  PRODUCT_SYNC: 'product-sync',
  PRODUCT_WEBHOOK: 'product-webhook',
  INVENTORY_SYNC: 'inventory-sync',
  ORDER_SYNC: 'order-sync',
  NOTIFICATION_DISPATCH: 'notification-dispatch',
  RECONCILIATION: 'reconciliation',
} as const;

export const ALL_QUEUE_NAMES = Object.values(QUEUE_NAMES);
export const BULL_QUEUES = Symbol('BULL_QUEUES');
