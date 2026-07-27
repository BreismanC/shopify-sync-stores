import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IShopifyCustomerPort,
  IShopifyInventoryPort,
  IShopifyOrderPort,
  IShopifyProductPort,
  IShopifyWebhookPort,
  ShopifyCredentials,
  ShopifyPage,
} from '../../application/shopify/ports/shopify.ports';
import { EncryptionUtil } from '../security/encryption.util';

@Injectable()
export class ShopifyAdminAdapter
  implements
    IShopifyProductPort,
    IShopifyOrderPort,
    IShopifyInventoryPort,
    IShopifyWebhookPort,
    IShopifyCustomerPort
{
  constructor(private readonly config: ConfigService) {}

  private decodeAccessToken(raw: string): string {
    if (!raw) return raw;
    // Ya está en claro si no contiene el separador "<ivHex>:<cipher>" de la
    // utilidad de cifrado. Esto cubre tokens antiguos guardados antes de
    // introducir EncryptionUtil.
    return /^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(raw)
      ? EncryptionUtil.decrypt(raw)
      : raw;
  }

  private async graphql<T>(
    credentials: ShopifyCredentials,
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    const version = this.config.getOrThrow<string>('SHOPIFY_API_VERSION');
    const accessToken = this.decodeAccessToken(credentials.accessToken);
    const response = await fetch(
      `https://${credentials.shopDomain}/admin/api/${version}/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
      },
    );
    const body = (await response.json()) as {
      data?: T;
      errors?: unknown;
      extensions?: unknown;
    };
    if (!response.ok || body.errors || !body.data) {
      throw new BadGatewayException({
        code: 'SHOPIFY_API_ERROR',
        message: 'Shopify rechazó la operación.',
        details: body.errors,
        status: response.status,
      });
    }
    return body.data;
  }

  async listProducts(
    credentials: ShopifyCredentials,
    cursor?: string,
    limit = 50,
  ): Promise<ShopifyPage<Record<string, unknown>>> {
    const data = await this.graphql<{
      products: {
        nodes: Record<string, unknown>[];
        pageInfo: { endCursor: string | null; hasNextPage: boolean };
      };
    }>(
      credentials,
      `query Products($first:Int!,$after:String){products(first:$first,after:$after){nodes{id title descriptionHtml vendor productType tags status createdAt updatedAt featuredMedia{preview{image{url}}} variants(first:100){nodes{id title sku barcode price inventoryQuantity inventoryItem{id}}}}pageInfo{endCursor hasNextPage}}}`,
      { first: Math.min(100, limit), after: cursor ?? null },
    );
    return {
      items: data.products.nodes,
      cursor: data.products.pageInfo.endCursor,
      hasNextPage: data.products.pageInfo.hasNextPage,
    };
  }

  async getProduct(credentials: ShopifyCredentials, productId: string) {
    const data = await this.graphql<{
      product: Record<string, unknown> | null;
    }>(
      credentials,
      `query Product($id:ID!){product(id:$id){id title descriptionHtml vendor productType tags status createdAt updatedAt featuredMedia{preview{image{url}}} variants(first:100){nodes{id title sku barcode price inventoryQuantity inventoryItem{id}}}}}`,
      { id: productId },
    );
    return data.product;
  }

  async upsertProduct(
    credentials: ShopifyCredentials,
    product: Record<string, unknown>,
    remoteId?: string,
  ) {
    const input = { ...product, ...(remoteId ? { id: remoteId } : {}) };
    const data = await this.graphql<{
      productSet: {
        product: Record<string, unknown>;
        userErrors: Array<{ message: string }>;
      };
    }>(
      credentials,
      `mutation ProductSet($input:ProductSetInput!){productSet(input:$input,synchronous:true){product{id title status}userErrors{field message}}}`,
      { input },
    );
    if (data.productSet.userErrors.length)
      throw new BadGatewayException(data.productSet.userErrors[0].message);
    return data.productSet.product;
  }

  async deleteProduct(credentials: ShopifyCredentials, productId: string) {
    await this.graphql(
      credentials,
      `mutation DeleteProduct($input:ProductDeleteInput!){productDelete(input:$input){deletedProductId userErrors{message}}}`,
      { input: { id: productId } },
    );
  }

  async getOrder(credentials: ShopifyCredentials, orderId: string) {
    const data = await this.graphql<{ order: Record<string, unknown> | null }>(
      credentials,
      `query Order($id:ID!){order(id:$id){id name createdAt displayFinancialStatus displayFulfillmentStatus totalPriceSet{shopMoney{amount currencyCode}} lineItems(first:100){nodes{id quantity sku variant{id}}}}}`,
      { id: orderId },
    );
    return data.order;
  }

  async createOrder(
    credentials: ShopifyCredentials,
    order: Record<string, unknown>,
  ) {
    const data = await this.graphql<{
      orderCreate: {
        order: Record<string, unknown>;
        userErrors: Array<{ message: string }>;
      };
    }>(
      credentials,
      `mutation CreateOrder($order:OrderCreateOrderInput!){orderCreate(order:$order){order{id name}userErrors{message}}}`,
      { order },
    );
    if (data.orderCreate.userErrors.length)
      throw new BadGatewayException(data.orderCreate.userErrors[0].message);
    return data.orderCreate.order;
  }

  async createFulfillment(
    credentials: ShopifyCredentials,
    fulfillment: Record<string, unknown>,
  ) {
    const data = await this.graphql<{
      fulfillmentCreateV2: {
        fulfillment: Record<string, unknown>;
        userErrors: Array<{ message: string }>;
      };
    }>(
      credentials,
      `mutation Fulfill($fulfillment:FulfillmentV2Input!){fulfillmentCreateV2(fulfillment:$fulfillment){fulfillment{id status}userErrors{message}}}`,
      { fulfillment },
    );
    if (data.fulfillmentCreateV2.userErrors.length)
      throw new BadGatewayException(
        data.fulfillmentCreateV2.userErrors[0].message,
      );
    return data.fulfillmentCreateV2.fulfillment;
  }

  async setInventory(
    credentials: ShopifyCredentials,
    input: { inventoryItemId: string; locationId: string; quantity: number },
  ) {
    await this.graphql(
      credentials,
      `mutation SetInventory($input:InventorySetQuantitiesInput!){inventorySetQuantities(input:$input){inventoryAdjustmentGroup{createdAt}userErrors{message}}}`,
      {
        input: {
          name: 'available',
          reason: 'correction',
          ignoreCompareQuantity: true,
          quantities: [
            {
              inventoryItemId: input.inventoryItemId,
              locationId: input.locationId,
              quantity: Math.max(0, input.quantity),
            },
          ],
        },
      },
    );
  }

  async register(
    credentials: ShopifyCredentials,
    topic: string,
    callbackUrl: string,
  ) {
    const existing = await this.graphql<{
      webhookSubscriptions: {
        edges: Array<{
          node: { id: string; topic: string; uri: string };
        }>;
      };
    }>(
      credentials,
      `query WebhookSubscriptions($first:Int!){webhookSubscriptions(first:$first){edges{node{id topic uri}}}}`,
      { first: 250 },
    );
    const matching = existing.webhookSubscriptions.edges.find(
      ({ node }) => node.topic === topic && node.uri === callbackUrl,
    );
    if (matching) return matching.node.id;

    const data = await this.graphql<{
      webhookSubscriptionCreate: {
        webhookSubscription: { id: string } | null;
        userErrors: Array<{ message: string }>;
      };
    }>(
      credentials,
      `mutation Webhook($topic:WebhookSubscriptionTopic!,$subscription:WebhookSubscriptionInput!){webhookSubscriptionCreate(topic:$topic,webhookSubscription:$subscription){webhookSubscription{id}userErrors{message}}}`,
      { topic, subscription: { uri: callbackUrl, format: 'JSON' } },
    );
    if (data.webhookSubscriptionCreate.userErrors.length)
      throw new BadGatewayException(
        data.webhookSubscriptionCreate.userErrors[0].message,
      );
    if (!data.webhookSubscriptionCreate.webhookSubscription)
      throw new BadGatewayException(
        'Shopify no devolviÃ³ la suscripciÃ³n del webhook.',
      );
    return data.webhookSubscriptionCreate.webhookSubscription.id;
  }

  async getCustomer(credentials: ShopifyCredentials, customerId: string) {
    const data = await this.graphql<{
      customer: Record<string, unknown> | null;
    }>(
      credentials,
      `query Customer($id:ID!){customer(id:$id){id displayName email phone defaultAddress{address1 address2 city province country zip}}}`,
      { id: customerId },
    );
    return data.customer;
  }
}
