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
  abstract setInventory(
    credentials: ShopifyCredentials,
    input: { inventoryItemId: string; locationId: string; quantity: number },
  ): Promise<void>;
}

export abstract class IShopifyWebhookPort {
  abstract register(
    credentials: ShopifyCredentials,
    topic: string,
    callbackUrl: string,
  ): Promise<string>;
}

export abstract class IShopifyCustomerPort {
  abstract getCustomer(
    credentials: ShopifyCredentials,
    customerId: string,
  ): Promise<Record<string, unknown> | null>;
}
