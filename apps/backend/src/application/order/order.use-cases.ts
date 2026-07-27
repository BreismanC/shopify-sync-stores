import { Inject, Injectable } from '@nestjs/common';
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

@Injectable()
export class GetOrdersUseCase {
  constructor(
    @Inject(IOrderRepository) private readonly orders: IOrderRepository,
  ) {}
  async execute(tenantId: string, query: OrderListQuery) {
    const result = await this.orders.list(tenantId, query);
    const data = await Promise.all(result.data.map(async (order) => ({
      ...order,
      payout: await this.orders.findPayoutByOrder(tenantId, order.id),
    })));
    return { ...result, data };
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
