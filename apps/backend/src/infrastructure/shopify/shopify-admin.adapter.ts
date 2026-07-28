import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
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
import { WebhookTopic } from '../../domain/enums/webhook-topic.enum';

@Injectable()
export class ShopifyAdminAdapter
  implements
    IShopifyProductPort,
    IShopifyOrderPort,
    IShopifyInventoryPort,
    IShopifyWebhookPort,
    IShopifyCustomerPort
{
  private readonly logger = new Logger(ShopifyAdminAdapter.name);

  constructor(private readonly config: ConfigService) {}

  private decodeAccessToken(raw: string): string {
    if (!raw) return raw;
    // Ya está en claro si no contiene el separador "<ivHex>:<cipher>" de la
    // utilidad de cifrado. Esto cubre tokens antiguos guardados antes de
    // introducir EncryptionUtil.
    if (!/^[0-9a-fA-F]{32}:[0-9a-fA-F]+$/.test(raw)) {
      return raw;
    }
    try {
      return EncryptionUtil.decrypt(raw);
    } catch (error) {
      // Si el valor guardado se corrompió o fue cifrado con una clave
      // distinta (p. ej. entornos donde rotó ENCRYPTION_KEY), evitamos que el
      // worker reviente con un error críptico de crypto y dejamos que el
      // adaptador de Shopify reporte 401/403 con un mensaje accionable.
      const message = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException({
        code: 'SHOPIFY_TOKEN_DECRYPT_FAILED',
        message:
          'No se pudo descifrar el access token de Shopify. Verifica ENCRYPTION_KEY.',
        details: message,
      });
    }
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
      `query Products($first:Int!,$after:String){products(first:$first,after:$after){nodes{id}pageInfo{endCursor hasNextPage}}}`,
      { first: Math.min(100, limit), after: cursor ?? null },
    );
    return {
      items: data.products.nodes,
      cursor: data.products.pageInfo.endCursor,
      hasNextPage: data.products.pageInfo.hasNextPage,
    };
  }

  async countProducts(credentials: ShopifyCredentials): Promise<number> {
    const data = await this.graphql<{ productsCount: { count: number } }>(
      credentials,
      `query ProductsCount { productsCount(limit: null) { count } }`,
    );
    return Number(data.productsCount.count ?? 0);
  }

  async getProduct(credentials: ShopifyCredentials, productId: string) {
    const data = await this.graphql<{
      product: Record<string, unknown> | null;
    }>(
      credentials,
      `query Product($id:ID!){product(id:$id){id title descriptionHtml vendor productType tags status createdAt updatedAt images(first:100){nodes{url}pageInfo{endCursor hasNextPage}} featuredMedia{preview{image{url}}} variants(first:100){nodes{id title sku barcode price inventoryItem{id}}pageInfo{endCursor hasNextPage}}}}`,
      { id: productId },
    );
    if (!data.product) return null;
    const product = data.product;
    await Promise.all([
      this.loadRemainingProductConnection(
        credentials,
        productId,
        product,
        'images',
        'nodes{url}',
      ),
      this.loadRemainingProductConnection(
        credentials,
        productId,
        product,
        'variants',
        'nodes{id title sku barcode price inventoryItem{id}}',
      ),
    ]);
    return product;
  }

  private async loadRemainingProductConnection(
    credentials: ShopifyCredentials,
    productId: string,
    product: Record<string, unknown>,
    field: 'images' | 'variants',
    selection: string,
  ) {
    const connection = product[field] as
      | {
          nodes?: Record<string, unknown>[];
          pageInfo?: { endCursor?: string | null; hasNextPage?: boolean };
        }
      | undefined;
    if (!connection?.pageInfo?.hasNextPage) return;
    const nodes = connection.nodes ?? [];
    let cursor = connection.pageInfo.endCursor ?? undefined;
    while (cursor) {
      const data = await this.graphql<{
        product: Record<string, unknown> | null;
      }>(
        credentials,
        `query ProductConnection($id:ID!,$after:String){product(id:$id){${field}(first:100,after:$after){${selection} pageInfo{endCursor hasNextPage}}}}`,
        { id: productId, after: cursor },
      );
      const page = data.product?.[field] as
        | {
            nodes?: Record<string, unknown>[];
            pageInfo?: { endCursor?: string | null; hasNextPage?: boolean };
          }
        | undefined;
      nodes.push(...(page?.nodes ?? []));
      cursor =
        page?.pageInfo?.hasNextPage && page.pageInfo.endCursor
          ? page.pageInfo.endCursor
          : undefined;
    }
    product[field] = { ...connection, nodes };
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
      `mutation ProductSet($input:ProductSetInput!){productSet(input:$input,synchronous:true){product{id title status variants(first:100){nodes{id title sku barcode inventoryItem{id}}}}userErrors{field message}}}`,
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

  async getInventoryLevels(
    credentials: ShopifyCredentials,
    inventoryItemId: string,
  ) {
    const levels: Array<{
      inventoryItemId: string;
      locationId: string;
      availableQuantity: number;
      updatedAt: string | null;
    }> = [];
    let cursor: string | undefined;
    do {
      const data = await this.graphql<{
        inventoryItem: {
          inventoryLevels: {
            nodes: Array<{
              updatedAt?: string | null;
              location?: { id?: string | null } | null;
              quantities?: Array<{ name: string; quantity: number }>;
            }>;
            pageInfo: { endCursor: string | null; hasNextPage: boolean };
          };
        } | null;
      }>(
        credentials,
        `query InventoryLevels($id:ID!,$after:String){inventoryItem(id:$id){inventoryLevels(first:100,after:$after){nodes{updatedAt location{id} quantities(names:["available"]){name quantity}}pageInfo{endCursor hasNextPage}}}}`,
        { id: inventoryItemId, after: cursor ?? null },
      );
      const page = data.inventoryItem?.inventoryLevels;
      for (const node of page?.nodes ?? []) {
        const locationId = node.location?.id;
        if (!locationId) continue;
        const available =
          node.quantities?.find((quantity) => quantity.name === 'available')
            ?.quantity ?? 0;
        levels.push({
          inventoryItemId,
          locationId,
          availableQuantity: Number(available) || 0,
          updatedAt: node.updatedAt ?? null,
        });
      }
      cursor =
        page?.pageInfo.hasNextPage && page.pageInfo.endCursor
          ? page.pageInfo.endCursor
          : undefined;
    } while (cursor);
    return levels;
  }

  async getDefaultInventoryLocationId(credentials: ShopifyCredentials) {
    const data = await this.graphql<{
      locations: { nodes: Array<{ id: string }> };
    }>(
      credentials,
      `query Locations($first:Int!){locations(first:$first){nodes{id}}}`,
      { first: 1 },
    );
    const locationId = data.locations.nodes[0]?.id;
    if (!locationId)
      throw new BadGatewayException('Shopify no devolviÃ³ ubicaciones activas.');
    return locationId;
  }

  async register(
    credentials: ShopifyCredentials,
    topic: WebhookTopic,
    callbackUrl: string,
  ): Promise<string | null> {
    this.logger.log(
      `Registrando webhook ${topic} para ${credentials.shopDomain} → ${callbackUrl}`,
    );
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
    if (matching) {
      this.logger.log(
        `Webhook ${topic} ya existía en Shopify con id ${matching.node.id}`,
      );
      return matching.node.id;
    }

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
    if (data.webhookSubscriptionCreate.userErrors.length) {
      const msg = data.webhookSubscriptionCreate.userErrors
        .map((e) => e.message)
        .join('; ');
      this.logger.error(
        `Shopify rechazó la suscripción del webhook ${topic}: ${msg}`,
      );
      throw new BadGatewayException({
        code: 'SHOPIFY_WEBHOOK_USER_ERROR',
        message: msg,
        topic,
      });
    }
    const id = data.webhookSubscriptionCreate.webhookSubscription?.id ?? null;
    if (!id) {
      this.logger.warn(
        `Shopify devolvió webhookSubscription null para ${topic} en ${credentials.shopDomain}`,
      );
      return null;
    }
    this.logger.log(
      `Webhook ${topic} registrado en Shopify con id ${id}`,
    );
    return id;
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
