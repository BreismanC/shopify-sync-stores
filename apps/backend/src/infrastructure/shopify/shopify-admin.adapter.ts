import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
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

  async publishProduct(
    credentials: ShopifyCredentials,
    productId: string,
  ): Promise<{ publicationIds: string[] }> {
    const publicationIds = await this.listStorefrontPublicationIds(credentials);
    if (!publicationIds.length) {
      throw new BadGatewayException({
        code: 'SHOPIFY_STOREFRONT_PUBLICATION_NOT_FOUND',
        message:
          'Shopify no devolvió publicaciones de Tienda online ni mercados activos.',
      });
    }
    for (let index = 0; index < publicationIds.length; index += 50) {
      const input = publicationIds
        .slice(index, index + 50)
        .map((publicationId) => ({ publicationId }));
      const data = await this.graphql<{
        publishablePublish: {
          userErrors: Array<{ field?: string[]; message: string }>;
        };
      }>(
        credentials,
        `mutation PublishProduct($id:ID!,$input:[PublicationInput!]!){publishablePublish(id:$id,input:$input){userErrors{field message}}}`,
        { id: productId, input },
      );
      if (data.publishablePublish.userErrors.length) {
        throw new BadGatewayException({
          code: 'SHOPIFY_PRODUCT_PUBLICATION_FAILED',
          message: data.publishablePublish.userErrors[0].message,
          details: data.publishablePublish.userErrors,
        });
      }
    }
    return { publicationIds };
  }

  private async listStorefrontPublicationIds(
    credentials: ShopifyCredentials,
  ): Promise<string[]> {
    const ids = new Set<string>();
    let cursor: string | null = null;
    do {
      const data = await this.graphql<{
        publications: {
          nodes: Array<{
            id: string;
            catalog: null | { __typename: string; status?: string };
            channels: { nodes: Array<{ name: string }> };
          }>;
          pageInfo: { endCursor: string | null; hasNextPage: boolean };
        };
      }>(
        credentials,
        `query StorefrontPublications($after:String){publications(first:100,after:$after){nodes{id catalog{__typename ... on MarketCatalog{status}} channels(first:20){nodes{name}}}pageInfo{endCursor hasNextPage}}}`,
        { after: cursor },
      );
      for (const publication of data.publications.nodes) {
        const isActiveMarket =
          publication.catalog?.__typename === 'MarketCatalog' &&
          publication.catalog.status !== 'ARCHIVED';
        const isOnlineStore = publication.channels.nodes.some((channel) =>
          ['online store', 'tienda online'].includes(
            channel.name.trim().toLowerCase(),
          ),
        );
        if (isActiveMarket || isOnlineStore) ids.add(publication.id);
      }
      cursor = data.publications.pageInfo.hasNextPage
        ? data.publications.pageInfo.endCursor
        : null;
    } while (cursor);
    return [...ids];
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
    const input = {
      ...order,
      shippingAddress: this.toShopifyMailingAddress(order.shippingAddress),
      billingAddress: this.toShopifyMailingAddress(order.billingAddress),
    };
    const data = await this.graphql<{
      orderCreate: {
        order: Record<string, unknown>;
        userErrors: Array<{ message: string }>;
      };
    }>(
      credentials,
      `mutation CreateOrder($order:OrderCreateOrderInput!){orderCreate(order:$order){order{id name}userErrors{message}}}`,
      { order: input },
    );
    if (data.orderCreate.userErrors.length)
      throw new BadGatewayException(data.orderCreate.userErrors[0].message);
    return data.orderCreate.order;
  }

  private toShopifyMailingAddress(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const address = value as Record<string, unknown>;
    const read = (...keys: string[]) =>
      keys
        .map((key) => address[key])
        .find((item) => item !== null && item !== undefined && item !== '');
    const result: Record<string, unknown> = {};
    const fields: Array<[string, string[]]> = [
      ['address1', ['address1']],
      ['address2', ['address2']],
      ['city', ['city']],
      ['company', ['company']],
      ['countryCode', ['country_code', 'countryCode']],
      ['firstName', ['first_name', 'firstName']],
      ['lastName', ['last_name', 'lastName']],
      ['phone', ['phone']],
      ['province', ['province']],
      ['zip', ['zip', 'postalCode']],
    ];
    for (const [target, keys] of fields) {
      const item = read(...keys);
      if (item !== undefined && item !== null && item !== '') result[target] = item;
    }
    return Object.keys(result).length ? result : undefined;
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
    const levels = await this.getInventoryLevels(
      credentials,
      input.inventoryItemId,
    );
    const currentQuantity =
      levels.find((level) => level.locationId === input.locationId)
        ?.availableQuantity ?? 0;
    const targetQuantity = Math.max(0, input.quantity);
    if (currentQuantity === targetQuantity) return;

    const digest = createHash('sha256')
      .update(
        [
          input.inventoryItemId,
          input.locationId,
          currentQuantity,
          targetQuantity,
        ].join(':'),
      )
      .digest('hex');
    const idempotencyKey = [
      digest.slice(0, 8),
      digest.slice(8, 12),
      `4${digest.slice(13, 16)}`,
      `8${digest.slice(17, 20)}`,
      digest.slice(20, 32),
    ].join('-');

    const data = await this.graphql<{
      inventorySetQuantities: {
        inventoryAdjustmentGroup: { createdAt: string } | null;
        userErrors: Array<{ message: string; code?: string | null }>;
      };
    }>(
      credentials,
      `mutation SetInventory($input:InventorySetQuantitiesInput!,$idempotencyKey:String!){inventorySetQuantities(input:$input) @idempotent(key:$idempotencyKey){inventoryAdjustmentGroup{createdAt}userErrors{message code}}}`,
      {
        input: {
          name: 'available',
          reason: 'correction',
          quantities: [
            {
              inventoryItemId: input.inventoryItemId,
              locationId: input.locationId,
              quantity: targetQuantity,
              changeFromQuantity: currentQuantity,
            },
          ],
        },
        idempotencyKey,
      },
    );
    const userError = data.inventorySetQuantities.userErrors[0];
    if (userError) {
      throw new BadGatewayException({
        code: userError.code ?? 'SHOPIFY_INVENTORY_SET_FAILED',
        message: userError.message,
      });
    }
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
    const sameTopic = existing.webhookSubscriptions.edges.find(
      ({ node }) => node.topic === topic,
    );
    if (sameTopic) {
      const updated = await this.graphql<{
        webhookSubscriptionUpdate: {
          webhookSubscription: { id: string } | null;
          userErrors: Array<{ message: string }>;
        };
      }>(
        credentials,
        `mutation UpdateWebhook($id:ID!,$subscription:WebhookSubscriptionInput!){webhookSubscriptionUpdate(id:$id,webhookSubscription:$subscription){webhookSubscription{id}userErrors{message}}}`,
        {
          id: sameTopic.node.id,
          subscription: { uri: callbackUrl, format: 'JSON' },
        },
      );
      const updateErrors =
        updated.webhookSubscriptionUpdate.userErrors.map(
          (error) => error.message,
        );
      if (updateErrors.length)
        throw new BadGatewayException({
          code: 'SHOPIFY_WEBHOOK_UPDATE_ERROR',
          message: updateErrors.join('; '),
          topic,
        });
      const updatedId =
        updated.webhookSubscriptionUpdate.webhookSubscription?.id;
      if (updatedId) return updatedId;
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
