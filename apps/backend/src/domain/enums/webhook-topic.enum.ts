/**
 * Tópicos de webhooks de Shopify que la plataforma sincroniza.
 *
 * Los strings son los valores oficiales de la API GraphQL Admin
 * (`WebhookSubscriptionTopic`) y deben matchear 1:1 con Shopify.
 *
 * Si en el futuro se agrega un nuevo topic soportado por Shopify,
 * agregarlo acá, registrar la migración correspondiente en
 * `store_webhooks.topic` y sumarlo al array
 * `ShopifyModule.SUPPORTED_WEBHOOK_TOPICS` (si aplica).
 */
export enum WebhookTopic {
  PRODUCTS_CREATE = 'PRODUCTS_CREATE',
  PRODUCTS_UPDATE = 'PRODUCTS_UPDATE',
  PRODUCTS_DELETE = 'PRODUCTS_DELETE',
  INVENTORY_LEVELS_UPDATE = 'INVENTORY_LEVELS_UPDATE',
  ORDERS_CREATE = 'ORDERS_CREATE',
  ORDERS_UPDATED = 'ORDERS_UPDATED',
  ORDERS_CANCELLED = 'ORDERS_CANCELLED',
  APP_UNINSTALLED = 'APP_UNINSTALLED',
}

export const ALL_WEBHOOK_TOPICS: WebhookTopic[] = Object.values(WebhookTopic);

/**
 * Topics obligatorios. Si alguno de estos falla, el onboarding del paso 3
 * debe quedar bloqueado: sin ellos la plataforma deja de recibir los eventos
 * críticos (productos y órdenes).
 */
export const REQUIRED_WEBHOOK_TOPICS: ReadonlySet<WebhookTopic> = new Set([
  WebhookTopic.PRODUCTS_CREATE,
  WebhookTopic.PRODUCTS_UPDATE,
  WebhookTopic.PRODUCTS_DELETE,
  WebhookTopic.INVENTORY_LEVELS_UPDATE,
  WebhookTopic.ORDERS_CREATE,
  WebhookTopic.ORDERS_UPDATED,
  WebhookTopic.ORDERS_CANCELLED,
  WebhookTopic.APP_UNINSTALLED,
]);

export function isRequiredWebhookTopic(topic: WebhookTopic): boolean {
  return REQUIRED_WEBHOOK_TOPICS.has(topic);
}

export function isWebhookTopic(value: unknown): value is WebhookTopic {
  return (
    typeof value === 'string' &&
    Object.values(WebhookTopic).includes(value as WebhookTopic)
  );
}

/**
 * Estado del webhook en nuestra DB local. Refleja el ciclo de vida de la
 * suscripción contra Shopify.
 */
export enum WebhookStatus {
  /** Aún no se intentó registrar contra Shopify. */
  PENDING = 'PENDING',
  /** Shopify devolvió `webhookSubscriptionCreate.webhookSubscription.id`. */
  CONNECTED = 'CONNECTED',
  /** Shopify devolvió el webhook pero sin ID (caso raro). */
  REGISTERED_WITHOUT_ID = 'REGISTERED_WITHOUT_ID',
  /** La API devolvió `userErrors` o el endpoint no responde. */
  FAILED = 'FAILED',
}

export function isWebhookStatus(value: unknown): value is WebhookStatus {
  return (
    typeof value === 'string' &&
    Object.values(WebhookStatus).includes(value as WebhookStatus)
  );
}
