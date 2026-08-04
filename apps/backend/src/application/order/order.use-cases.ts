import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IShopifyOrderPort } from '../shopify/ports/shopify.ports';
import {
  IStoreConnectionRepository,
  ISTORE_CONNECTION_REPOSITORY,
} from '../store/repositories/IStoreConnectionRepository';
import { IStoreRepository } from '../store/repositories/IStoreRepository';
import { StoreRole } from '../../domain/enums/store-role.enum';
import { PayoutStatus } from '../../domain/enums/sync-status.enum';
import {
  IProductRepository,
  ISyncRepository,
} from '../sync/repositories/sync.repositories';
import { CreateNotificationUseCase } from '../notification/notification.use-cases';
import {
  IOrderRepository,
  OrderListQuery,
} from './repositories/order.repository';
import { asScalarString } from '../common/scalar';

export interface OrderLineView {
  id: string;
  vendorLineItemId: string;
  sourceVariantId: string;
  sourceLineItemId: string | null;
  quantity: number;
  unitPrice: string;
  title?: string | null;
  sku?: string | null;
  image?: string | null;
}

export interface OrderRowView {
  id: string;
  vendorShopifyOrderId: string;
  sourceShopifyOrderId: string | null;
  status: string;
  pushStatus: 'PUSHED' | 'NOT_PUSHED';
  customerName: string | null;
  itemCount: number;
  currency: string | null;
  subtotal: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderDetail {
  id: string;
  status: string;
  currency: string | null;
  subtotal: string;
  payload: Record<string, unknown>;
  lastError: string | null;
  vendorShopifyOrderId: string;
  sourceShopifyOrderId: string | null;
  sourceStoreId: string;
  sourceStoreDomain: string | null;
  vendorStoreId: string;
  vendorStoreDomain: string | null;
  connectionId: string;
  payout: {
    id: string;
    grossAmount: string;
    commissionAmount: string;
    netAmount: string;
    currency: string;
    status: PayoutStatus;
    paidAt: string | null;
  } | null;
  customer: {
    name: string | null;
    email: string | null;
    contactEmail: string | null;
    shippingAddress: string | null;
    billingAddress: string | null;
  };
  items: OrderLineView[];
  createdAt: Date;
  updatedAt: Date;
}

function readShippingAddress(payload: Record<string, unknown>): string | null {
  const addr = payload.shipping_address as Record<string, unknown> | undefined;
  if (!addr || typeof addr !== 'object') return null;
  const name = typeof addr.name === 'string' ? addr.name : '';
  const parts = [
    addr.address1,
    addr.address2,
    addr.city,
    addr.province,
    addr.country,
    addr.zip,
  ]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .map((value) => String(value));
  const trimmedName = name.trim();
  const joined = parts
    .join(', ')
    .replace(/^, |, $/g, '')
    .trim();
  if (trimmedName && joined) return `${trimmedName}, ${joined}`;
  return trimmedName || joined || null;
}

function readBillingAddress(payload: Record<string, unknown>): string | null {
  const addr = payload.billing_address as Record<string, unknown> | undefined;
  if (!addr || typeof addr !== 'object') return null;
  const parts = [
    addr.address1,
    addr.address2,
    addr.city,
    addr.province,
    addr.country,
    addr.zip,
  ]
    .filter((value) => typeof value === 'string' && value.length > 0)
    .map((value) => String(value));
  const joined = parts
    .join(', ')
    .replace(/^, |, $/g, '')
    .trim();
  return joined || null;
}

function readLineItemTitle(
  payload: Record<string, unknown>,
  vendorLineId: string,
): { title: string | null; sku: string | null; image: string | null } {
  const lines = Array.isArray(payload.line_items)
    ? (payload.line_items as Record<string, unknown>[])
    : [];
  const match = lines.find((line) => String(line.id) === vendorLineId);
  if (!match) return { title: null, sku: null, image: null };
  const title = typeof match.title === 'string' ? match.title : null;
  const sku = typeof match.sku === 'string' ? match.sku : null;
  const image = (() => {
    if (!Array.isArray(match.line_item) && match.line_item) {
      const nested = match.line_item as Record<string, unknown> | undefined;
      if (nested && typeof nested === 'object') {
        const props =
          (nested.properties as Record<string, unknown> | undefined) ?? {};
        if (Array.isArray(props.image)) {
          const first = props.image[0] as Record<string, unknown> | undefined;
          if (first && typeof first.value === 'string') return first.value;
        }
      }
    }
    return null;
  })();
  return { title, sku, image };
}

@Injectable()
export class GetOrdersUseCase {
  constructor(
    @Inject(IOrderRepository) private readonly orders: IOrderRepository,
  ) {}
  async execute(tenantId: string, query: OrderListQuery) {
    const result = await this.orders.list(tenantId, query);
    const data = await Promise.all(
      result.data.map(async (order) => {
        const payload = order.payload ?? {};
        const customer =
          (payload.customer as Record<string, unknown> | undefined) ?? {};
        const customerName =
          [customer.first_name, customer.last_name]
            .filter((v) => typeof v === 'string' && v.length > 0)
            .map((v) => String(v))
            .join(' ')
            .trim() || null;
        const lines = await this.orders.findLinesByOrder(tenantId, order.id);
        return {
          ...order,
          customerName,
          itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
          pushStatus: order.sourceShopifyOrderId ? 'PUSHED' : 'NOT_PUSHED',
        };
      }),
    );
    return { ...result, data };
  }
}

@Injectable()
export class GetOrderDetailUseCase {
  constructor(
    @Inject(IOrderRepository) private readonly orders: IOrderRepository,
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
  ) {}

  async execute(tenantId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.orders.findById(tenantId, orderId);
    if (!order) {
      throw new NotFoundException('Pedido no encontrado.');
    }
    const [payout, lines, sourceStore, vendorStore] = await Promise.all([
      this.orders.findPayoutByOrder(tenantId, order.id),
      this.orders.findLinesByOrder(tenantId, order.id),
      this.stores.findById(order.sourceStoreId),
      this.stores.findById(order.vendorStoreId),
    ]);

    const payload = order.payload ?? {};
    const customer =
      (payload.customer as Record<string, unknown> | undefined) ?? {};
    const items: OrderLineView[] = lines.map((line) => {
      const meta = readLineItemTitle(payload, line.vendorLineItemId);
      return {
        id: line.id,
        vendorLineItemId: line.vendorLineItemId,
        sourceVariantId: line.sourceVariantId,
        sourceLineItemId: line.sourceLineItemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        title: meta.title,
        sku: meta.sku,
        image: meta.image,
      };
    });

    return {
      id: order.id,
      status: order.status,
      currency: order.currency,
      subtotal: order.subtotal,
      payload,
      lastError: order.lastError,
      vendorShopifyOrderId: order.vendorShopifyOrderId,
      sourceShopifyOrderId: order.sourceShopifyOrderId,
      sourceStoreId: order.sourceStoreId,
      sourceStoreDomain: sourceStore?.shopifyShopId ?? null,
      vendorStoreId: order.vendorStoreId,
      vendorStoreDomain: vendorStore?.shopifyShopId ?? null,
      connectionId: order.connectionId,
      payout: payout
        ? {
            id: payout.id,
            grossAmount: payout.grossAmount,
            commissionAmount: payout.commissionAmount,
            netAmount: payout.netAmount,
            currency: payout.currency,
            status: payout.status,
            paidAt: payout.paidAt ? payout.paidAt.toISOString() : null,
          }
        : null,
      customer: {
        name:
          [customer.first_name, customer.last_name]
            .filter((v) => typeof v === 'string' && v.length > 0)
            .map((v) => String(v))
            .join(' ')
            .trim() || null,
        email: typeof customer.email === 'string' ? customer.email : null,
        contactEmail:
          typeof payload.contact_email === 'string'
            ? String(payload.contact_email)
            : typeof payload.email === 'string'
              ? String(payload.email)
              : null,
        shippingAddress: readShippingAddress(payload),
        billingAddress: readBillingAddress(payload),
      },
      items,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}

export interface PushOrderResult {
  sourceShopifyOrderId: string | null;
  status: 'CREATED' | 'ALREADY_PUSHED';
}

@Injectable()
export class PushOrderToSourceUseCase {
  constructor(
    @Inject(IOrderRepository) private readonly orders: IOrderRepository,
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(IShopifyOrderPort) private readonly shopify: IShopifyOrderPort,
  ) {}

  async execute(
    tenantId: string,
    orderId: string,
    shippingFee: number | null,
  ): Promise<PushOrderResult> {
    const order = await this.orders.findById(tenantId, orderId);
    if (!order) {
      throw new NotFoundException('Pedido no encontrado.');
    }
    if (order.sourceShopifyOrderId) {
      return {
        sourceShopifyOrderId: order.sourceShopifyOrderId,
        status: 'ALREADY_PUSHED',
      };
    }
    const sourceStore = await this.stores.findById(order.sourceStoreId);
    if (!sourceStore) {
      throw new NotFoundException('Tienda origen no encontrada.');
    }
    const payload = order.payload ?? {};
    const lines = await this.orders.findLinesByOrder(tenantId, order.id);
    if (!lines.length) {
      throw new NotFoundException('El pedido no tiene líneas sincronizadas.');
    }
    const sourceOrder = await this.shopify.createOrder(
      {
        shopDomain: sourceStore.shopifyShopId,
        accessToken: sourceStore.accessToken,
      },
      {
        lineItems: lines.map((line) => ({
          variantId: line.sourceVariantId,
          quantity: line.quantity,
        })),
        email: typeof payload.email === 'string' ? payload.email : undefined,
        phone: typeof payload.phone === 'string' ? payload.phone : undefined,
        shippingAddress: payload.shipping_address as
          | Record<string, unknown>
          | undefined,
        billingAddress: payload.billing_address as
          | Record<string, unknown>
          | undefined,
        shippingLine:
          shippingFee && Number.isFinite(shippingFee) && shippingFee > 0
            ? { price: Number(shippingFee), title: 'Manual shipping' }
            : undefined,
        note: `Pedido asociado VENDOR #${order.vendorShopifyOrderId}`,
        tags: [
          'shopify-sync-stores',
          `vendor-order-${order.vendorShopifyOrderId}`,
        ],
      },
    );
    order.sourceShopifyOrderId = String(sourceOrder.id);
    order.status = 'CREATED';
    order.lastError = null;
    await this.orders.saveOrder(order);
    return {
      sourceShopifyOrderId: order.sourceShopifyOrderId,
      status: 'CREATED',
    };
  }
}

@Injectable()
export class ProcessOrderWebhookUseCase {
  constructor(
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(ISTORE_CONNECTION_REPOSITORY)
    private readonly connections: IStoreConnectionRepository,
    @Inject(IProductRepository) private readonly products: IProductRepository,
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
    @Inject(IOrderRepository) private readonly orders: IOrderRepository,
    @Inject(IShopifyOrderPort) private readonly shopify: IShopifyOrderPort,
    private readonly notifications: CreateNotificationUseCase,
  ) {}

  async execute(job: {
    storeId?: string | null;
    eventId: string;
    topic: string;
    payload: Record<string, unknown>;
  }) {
    if (!job.storeId) return { skipped: 'UNKNOWN_STORE' };
    const vendorStore = await this.stores.findById(job.storeId);
    if (!vendorStore || vendorStore.role !== StoreRole.VENDOR)
      return { skipped: 'NOT_VENDOR' };
    const vendorOrderId = asScalarString(job.payload.id);
    const connections = await this.connections.findActiveByVendorStore(
      vendorStore.id,
    );
    const lineItems = Array.isArray(job.payload.line_items)
      ? (job.payload.line_items as Record<string, unknown>[])
      : [];
    let created = 0;
    for (const connection of connections) {
      const sourceStore = await this.stores.findById(connection.sourceStoreId);
      if (!sourceStore) continue;
      const existing = await this.orders.findSynced(
        connection.id,
        vendorOrderId,
        sourceStore.id,
      );
      if (existing) {
        existing.payload = job.payload;
        existing.status = this.statusForTopic(job.topic, job.payload);
        await this.orders.saveOrder(existing);
        continue;
      }
      if (job.topic !== 'orders/create' && job.topic !== 'orders/paid')
        continue;
      const mappedLines: Array<{
        vendor: Record<string, unknown>;
        sourceVariantId: string;
        sourceShopifyVariantId: string;
        quantity: number;
        price: number;
      }> = [];
      for (const line of lineItems) {
        const vendorProductId = asScalarString(line.product_id);
        const synced = await this.sync.findSyncedProductByVendorId(
          connection.id,
          vendorProductId,
        );
        if (!synced) continue;
        const sourceProduct = await this.products.findById(
          sourceStore.tenantId,
          synced.sourceProductId,
        );
        const sku = asScalarString(line.sku);
        const variant =
          sourceProduct?.variants.find((item) => item.sku === sku) ??
          sourceProduct?.variants[0];
        if (!variant) continue;
        mappedLines.push({
          vendor: line,
          sourceVariantId: variant.id,
          sourceShopifyVariantId: variant.shopifyVariantId,
          quantity: Number(line.quantity ?? 1),
          price: Number(line.price ?? 0),
        });
      }
      if (!mappedLines.length) continue;
      const settings = await this.sync.getSettings(
        sourceStore.tenantId,
        connection.id,
      );
      const autoCreate = settings?.orderRules?.autoCreateOrders !== false;
      if (!autoCreate) continue;
      const sourceOrder = await this.shopify.createOrder(
        {
          shopDomain: sourceStore.shopifyShopId,
          accessToken: sourceStore.accessToken,
        },
        {
          lineItems: mappedLines.map((line) => ({
            variantId: line.sourceShopifyVariantId,
            quantity: line.quantity,
          })),
          email: job.payload.email,
          phone: job.payload.phone,
          shippingAddress: job.payload.shipping_address,
          billingAddress:
            settings?.orderRules?.vendorBillingAddress ??
            job.payload.billing_address,
          note: `Pedido asociado VENDOR #${asScalarString(job.payload.order_number, vendorOrderId)}`,
          tags: ['shopify-sync-stores', `vendor-order-${vendorOrderId}`],
        },
      );
      const gross = mappedLines.reduce(
        (sum, line) => sum + line.price * line.quantity,
        0,
      );
      const percentage = Number(
        settings?.productRules?.commissionPercentage ?? 0,
      );
      const fixed = Number(settings?.productRules?.commissionFixed ?? 0);
      const commission = (gross * percentage) / 100 + fixed;
      const order = await this.orders.saveOrder(
        this.orders.createOrder({
          tenantId: sourceStore.tenantId,
          connectionId: connection.id,
          vendorStoreId: vendorStore.id,
          sourceStoreId: sourceStore.id,
          vendorShopifyOrderId: vendorOrderId,
          sourceShopifyOrderId: String(sourceOrder.id),
          status: 'CREATED',
          currency: asScalarString(job.payload.currency),
          subtotal: gross.toFixed(4),
          payload: job.payload,
          lastError: null,
        }),
      );
      await this.orders.saveLines(
        mappedLines.map((line) =>
          this.orders.createLine({
            tenantId: sourceStore.tenantId,
            syncedOrderId: order.id,
            vendorLineItemId: String(line.vendor.id),
            sourceVariantId: line.sourceVariantId,
            sourceLineItemId: null,
            quantity: line.quantity,
            unitPrice: line.price.toFixed(4),
          }),
        ),
      );
      await this.orders.savePayout(
        this.orders.createPayout({
          tenantId: sourceStore.tenantId,
          syncedOrderId: order.id,
          sourceTenantId: sourceStore.tenantId,
          vendorTenantId: vendorStore.tenantId,
          grossAmount: gross.toFixed(4),
          commissionAmount: commission.toFixed(4),
          netAmount: Math.max(0, gross - commission).toFixed(4),
          currency: asScalarString(job.payload.currency, 'USD'),
          status: PayoutStatus.PENDING,
          paidAt: null,
        }),
      );
      await Promise.all(
        [sourceStore.tenantId, vendorStore.tenantId].map((tenantId) =>
          this.notifications.execute({
            tenantId,
            type: 'ORDER_CREATED',
            title: 'Pedido asociado creado',
            message: `Pedido ${asScalarString(job.payload.name, vendorOrderId)} sincronizado con ${mappedLines.length} línea(s).`,
            eventId: `order-created:${job.eventId}:${connection.id}:${tenantId}`,
            payload: { syncedOrderId: order.id, vendorOrderId },
          }),
        ),
      );
      created += 1;
    }
    return { created };
  }

  private statusForTopic(topic: string, payload: Record<string, unknown>) {
    if (topic === 'orders/cancelled') return 'CANCELED';
    if (topic === 'orders/fulfilled') return 'FULFILLED';
    if (topic === 'orders/paid') return 'PAID';
    if (topic === 'refunds/create') return 'REFUNDED';
    return asScalarString(
      payload.financial_status ?? payload.fulfillment_status,
      'UPDATED',
    ).toUpperCase();
  }
}
