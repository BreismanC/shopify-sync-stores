export const QUEUE_NAMES = {
  PRODUCT_SYNC: 'product-sync',
  VENDOR_SYNC: 'vendor-sync',
  PRODUCT_WEBHOOK: 'product-webhook',
  INVENTORY_SYNC: 'inventory-sync',
  VENDOR_INVENTORY_SYNC: 'vendor-inventory-sync',
  ORDER_SYNC: 'order-sync',
  NOTIFICATION_DISPATCH: 'notification-dispatch',
  RECONCILIATION: 'reconciliation',
  RETRY: 'retry',
  DEAD_LETTER: 'dead-letter',
} as const;

export const ALL_QUEUE_NAMES = Object.values(QUEUE_NAMES);
export const BULL_QUEUES = Symbol('BULL_QUEUES');
