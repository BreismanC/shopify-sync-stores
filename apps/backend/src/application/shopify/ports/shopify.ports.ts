import { WebhookTopic } from '../../../domain/enums/webhook-topic.enum';

export interface ShopifyCredentials {
  shopDomain: string;
  accessToken: string;
}

export interface ShopifyPage<T> {
  items: T[];
  cursor: string | null;
  hasNextPage: boolean;
}

export abstract class IShopifyProductPort {
  abstract countProducts(credentials: ShopifyCredentials): Promise<number>;
  abstract listProducts(
    credentials: ShopifyCredentials,
    cursor?: string,
    limit?: number,
  ): Promise<ShopifyPage<Record<string, unknown>>>;
  abstract getProduct(
    credentials: ShopifyCredentials,
    productId: string,
  ): Promise<Record<string, unknown> | null>;
  abstract upsertProduct(
    credentials: ShopifyCredentials,
    product: Record<string, unknown>,
    remoteId?: string,
  ): Promise<Record<string, unknown>>;
  abstract publishProduct(
    credentials: ShopifyCredentials,
    productId: string,
  ): Promise<{ publicationIds: string[] }>;
  abstract deleteProduct(
    credentials: ShopifyCredentials,
    productId: string,
  ): Promise<void>;
}

export abstract class IShopifyOrderPort {
  abstract getOrder(
    credentials: ShopifyCredentials,
    orderId: string,
  ): Promise<Record<string, unknown> | null>;
  abstract createOrder(
    credentials: ShopifyCredentials,
    order: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  abstract createFulfillment(
    credentials: ShopifyCredentials,
    fulfillment: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

export abstract class IShopifyInventoryPort {
  abstract getInventoryLevels(
    credentials: ShopifyCredentials,
    inventoryItemId: string,
  ): Promise<
    Array<{
      inventoryItemId: string;
      locationId: string;
      availableQuantity: number;
      updatedAt: string | null;
    }>
  >;
  abstract getDefaultInventoryLocationId(
    credentials: ShopifyCredentials,
  ): Promise<string>;
  abstract setInventory(
    credentials: ShopifyCredentials,
    input: { inventoryItemId: string; locationId: string; quantity: number },
  ): Promise<void>;
}

export abstract class IShopifyWebhookPort {
  /**
   * Registra un webhook contra Shopify y devuelve el id interno del
   * GID (`gid://shopify/WebhookSubscription/...`) si la API lo devolvió.
   * Si ya existe una suscripción con el mismo `topic` y `callbackUrl`,
   * devuelve el id existente (idempotente).
   */
  abstract register(
    credentials: ShopifyCredentials,
    topic: WebhookTopic,
    callbackUrl: string,
  ): Promise<string | null>;
}

export abstract class IShopifyCustomerPort {
  abstract getCustomer(
    credentials: ShopifyCredentials,
    customerId: string,
  ): Promise<Record<string, unknown> | null>;
}
