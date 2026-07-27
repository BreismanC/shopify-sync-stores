import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  IShopifyInventoryPort,
  IShopifyProductPort,
} from '../shopify/ports/shopify.ports';
import {
  IStoreConnectionRepository,
  ISTORE_CONNECTION_REPOSITORY,
} from '../store/repositories/IStoreConnectionRepository';
import { IStoreRepository } from '../store/repositories/IStoreRepository';
import { StoreRole } from '../../domain/enums/store-role.enum';
import { SyncEventStatus } from '../../domain/enums/sync-status.enum';
import {
  IProductRepository,
  ISyncRepository,
} from '../sync/repositories/sync.repositories';
import { IInventoryRepository } from './repositories/inventory.repository';
import { CreateNotificationUseCase } from '../notification/notification.use-cases';
import { asScalarString } from '../common/scalar';

@Injectable()
export class ProcessInventoryWebhookUseCase {
  constructor(
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(ISTORE_CONNECTION_REPOSITORY)
    private readonly connections: IStoreConnectionRepository,
    @Inject(IProductRepository) private readonly products: IProductRepository,
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
    @Inject(IInventoryRepository)
    private readonly inventory: IInventoryRepository,
    @Inject(IShopifyProductPort)
    private readonly shopifyProducts: IShopifyProductPort,
    @Inject(IShopifyInventoryPort)
    private readonly shopifyInventory: IShopifyInventoryPort,
    private readonly notifications: CreateNotificationUseCase,
  ) {}

  async execute(job: {
    storeId?: string | null;
    eventId: string;
    topic: string;
    payload: Record<string, unknown>;
  }) {
    if (!job.storeId) return { skipped: 'UNKNOWN_STORE' };
    const sourceStore = await this.stores.findById(job.storeId);
    if (!sourceStore || sourceStore.role !== StoreRole.SOURCE)
      return { skipped: 'NOT_SOURCE' };
    const inventoryItemId = asScalarString(
      job.payload.inventory_item_id ?? job.payload.inventoryItemId ?? '',
    );
    const locationId = asScalarString(
      job.payload.location_id ?? job.payload.locationId ?? '',
    );
    const quantity = Math.max(
      0,
      Number(job.payload.available ?? job.payload.quantity ?? 0),
    );
    const sourceVariant = await this.products.findVariantByInventoryItem(
      sourceStore.id,
      inventoryItemId,
    );
    if (!sourceVariant?.sku) return { skipped: 'VARIANT_WITHOUT_SKU' };
    const connections = await this.connections.findActiveBySourceStore(
      sourceStore.id,
    );
    let updated = 0;
    for (const connection of connections) {
      const key = `inventory:${job.eventId}:${connection.id}`;
      if (
        (await this.sync.findEventByKey(key))?.status ===
        SyncEventStatus.SUCCEEDED
      )
        continue;
      const mapping = await this.inventory.findLocationMapping(
        connection.id,
        locationId,
      );
      const synced = await this.sync.findSyncedProduct(
        connection.id,
        sourceVariant.product.id,
      );
      const vendorStore = await this.stores.findById(connection.vendorStoreId);
      if (!mapping || !synced || !vendorStore) continue;
      const event = this.sync.createEvent({
        tenantId: sourceStore.tenantId,
        connectionId: connection.id,
        batchId: null,
        type: 'INVENTORY_SYNC',
        idempotencyKey: key,
        status: SyncEventStatus.PROCESSING,
        payload: job.payload,
        attempts: 1,
        error: null,
      });
      await this.sync.saveEvent(event);
      try {
        const remote = await this.shopifyProducts.getProduct(
          {
            shopDomain: vendorStore.shopifyShopId,
            accessToken: vendorStore.accessToken,
          },
          synced.vendorShopifyProductId,
        );
        const variants =
          (
            remote?.variants as
              | { nodes?: Record<string, unknown>[] }
              | undefined
          )?.nodes ?? [];
        const remoteVariant = variants.find(
          (variant) => asScalarString(variant.sku) === sourceVariant.sku,
        );
        const remoteInventoryItemId = (
          remoteVariant?.inventoryItem as { id?: string } | undefined
        )?.id;
        if (!remoteInventoryItemId)
          throw new NotFoundException('Variante VENDOR sin inventory item.');
        await this.shopifyInventory.setInventory(
          {
            shopDomain: vendorStore.shopifyShopId,
            accessToken: vendorStore.accessToken,
          },
          {
            inventoryItemId: remoteInventoryItemId,
            locationId: mapping.vendorLocationId,
            quantity,
          },
        );
        event.status = SyncEventStatus.SUCCEEDED;
        await this.sync.saveEvent(event);
        updated += 1;
      } catch (error) {
        event.status = SyncEventStatus.FAILED;
        event.error = error instanceof Error ? error.message : String(error);
        await this.sync.saveEvent(event);
        throw error;
      }
    }
    if (updated)
      await this.notifications.execute({
        tenantId: sourceStore.tenantId,
        type: 'INVENTORY_UPDATED',
        title: 'Inventario sincronizado',
        message: `${sourceVariant.sku}: ${quantity} unidades actualizadas en ${updated} tienda(s).`,
        eventId: `inventory-notification:${job.eventId}`,
        payload: { sku: sourceVariant.sku, quantity, updated },
      });
    return { updated };
  }
}
