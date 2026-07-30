import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  DistributedLockUnavailableError,
  IDistributedLock,
} from '../ports/distributed-lock.port';
import { IQueuePublisher } from '../ports/queue-publisher.port';
import { IRealtimePublisher } from '../ports/realtime-publisher.port';
import {
  IShopifyInventoryPort,
  ShopifyCredentials,
} from '../shopify/ports/shopify.ports';
import { IStoreRepository } from '../store/repositories/IStoreRepository';
import {
  IProductRepository,
  ISyncRepository,
} from '../sync/repositories/sync.repositories';
import {
  InventorySyncRequested,
  InventoryUpdated,
  VendorInventorySyncRequested,
} from '../sync/sync.events';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { SyncEventStatus } from '../../domain/enums/sync-status.enum';
import { asScalarString } from '../common/scalar';
import { IInventoryRepository } from './repositories/inventory.repository';

const INVENTORY_LOCK_TTL_MS = 5_000;

@Injectable()
export class ProcessInventorySyncRequestedUseCase {
  private readonly logger = new Logger(ProcessInventorySyncRequestedUseCase.name);

  constructor(
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(IProductRepository) private readonly products: IProductRepository,
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
    @Inject(IInventoryRepository)
    private readonly inventory: IInventoryRepository,
    @Inject(IShopifyInventoryPort)
    private readonly shopifyInventory: IShopifyInventoryPort,
    @Inject(IQueuePublisher) private readonly queues: IQueuePublisher,
    @Inject(IDistributedLock) private readonly locks: IDistributedLock,
    @Inject(IRealtimePublisher) private readonly realtime: IRealtimePublisher,
  ) {}

  async execute(input: InventorySyncRequested) {
    if (!input.storeId || !input.inventoryItemId)
      return { skipped: 'INCOMPLETE_INVENTORY_EVENT' };
    const key = `inventory-sync:${input.storeId}:${input.inventoryItemId}`;
    const token = await this.locks.acquire(key, INVENTORY_LOCK_TTL_MS);
    if (!token) throw new DistributedLockUnavailableError(key);
    try {
      return await this.executeLocked(input);
    } finally {
      await this.locks.release(key, token);
    }
  }

  private async executeLocked(input: InventorySyncRequested) {
    const started = Date.now();
    const sourceStore = await this.stores.findById(input.storeId);
    if (!sourceStore) throw new NotFoundException('Tienda no encontrada.');
    const sourceVariant = input.variantId
      ? await this.products.findVariantById(input.storeId, input.variantId)
      : await this.products.findVariantByInventoryItem(
          input.storeId,
          input.inventoryItemId,
        );
    if (!sourceVariant?.shopifyInventoryItemId)
      return { skipped: 'VARIANT_NOT_FOUND' };
    const credentials: ShopifyCredentials = {
      shopDomain: sourceStore.shopifyShopId,
      accessToken: sourceStore.accessToken,
    };
    const levels = await this.shopifyInventory.getInventoryLevels(
      credentials,
      sourceVariant.shopifyInventoryItemId,
    );
    const total = levels.reduce(
      (sum, level) => sum + Math.max(0, Number(level.availableQuantity) || 0),
      0,
    );
    const newest = levels
      .map((level) => (level.updatedAt ? new Date(level.updatedAt) : null))
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0];
    let snapshot = await this.inventory.findSnapshotByInventoryItem(
      input.storeId,
      sourceVariant.shopifyInventoryItemId,
    );
    const previousQuantity = snapshot?.availableQuantity ?? null;
    snapshot ??= this.inventory.createSnapshot({
      tenantId: sourceStore.tenantId,
      storeId: sourceStore.id,
      variantId: sourceVariant.id,
      inventoryItemId: sourceVariant.shopifyInventoryItemId,
    });
    snapshot.variantId = sourceVariant.id;
    snapshot.availableQuantity = total;
    snapshot.shopifyUpdatedAt = newest ?? null;
    snapshot.lastError = null;
    snapshot.lastDurationMs = Date.now() - started;
    await this.inventory.saveSnapshot(snapshot);
    await this.realtime.publishToTenant(input.tenantId, 'inventory.updated', {
      storeId: input.storeId,
      variantId: sourceVariant.id,
      inventoryItemId: sourceVariant.shopifyInventoryItemId,
      availableQuantity: total,
      previousQuantity,
      origin: input.origin,
    });
    await this.recordEvent(
      'INVENTORY_UPDATED',
      `inventory-updated:${input.storeId}:${sourceVariant.shopifyInventoryItemId}:${input.eventId ?? input.timestamp}`,
      input.tenantId,
      {
        storeId: input.storeId,
        variantId: sourceVariant.id,
        inventoryItemId: sourceVariant.shopifyInventoryItemId,
        previousQuantity,
        availableQuantity: total,
        origin: input.origin,
        durationMs: snapshot.lastDurationMs,
      },
      SyncEventStatus.SUCCEEDED,
    );
    const shouldDispatch =
      previousQuantity !== total ||
      input.origin === 'manual' ||
      input.origin === 'retry';
    if (shouldDispatch) {
      const payload: InventoryUpdated = {
        tenantId: input.tenantId,
        storeId: input.storeId,
        variantId: sourceVariant.id,
        inventoryItemId: sourceVariant.shopifyInventoryItemId,
        previousQuantity,
        availableQuantity: total,
        origin: input.origin,
        timestamp: new Date().toISOString(),
        eventId: input.eventId,
      };
      await this.queues.publish(
        QUEUE_NAMES.VENDOR_INVENTORY_SYNC,
        'inventory-updated',
        payload as unknown as Record<string, unknown>,
        {
          jobId: [
            'inventory-updated',
            input.storeId,
            sourceVariant.id,
            input.eventId ?? input.timestamp,
          ]
            .join('-')
            .replace(/[^a-zA-Z0-9_-]/g, '-'),
          attempts: 8,
          backoffMs: 2_000,
        },
      );
    }
    this.logger.log(
      JSON.stringify({
        event: 'inventory_snapshot_updated',
        storeId: input.storeId,
        variantId: sourceVariant.id,
        inventoryItemId: sourceVariant.shopifyInventoryItemId,
        previousQuantity,
        availableQuantity: total,
        origin: input.origin,
        durationMs: snapshot.lastDurationMs,
      }),
    );
    return { availableQuantity: total, dispatched: shouldDispatch };
  }

  async markPermanentlyFailed(input: InventorySyncRequested, error: Error) {
    await this.recordEvent(
      'INVENTORY_SYNC_REQUESTED',
      `inventory-failed:${input.storeId}:${input.inventoryItemId}:${input.eventId ?? input.timestamp}`,
      input.tenantId,
      {
        storeId: input.storeId,
        inventoryItemId: input.inventoryItemId,
        origin: input.origin,
      },
      SyncEventStatus.FAILED,
      error.message,
    );
  }

  private async recordEvent(
    type: string,
    key: string,
    tenantId: string,
    payload: Record<string, unknown>,
    status: SyncEventStatus,
    error: string | null = null,
  ) {
    const existing = await this.sync.findEventByKey(key);
    const event =
      existing ??
      this.sync.createEvent({
        tenantId,
        connectionId: null,
        batchId: null,
        type,
        idempotencyKey: key,
        attempts: 1,
      });
    event.status = status;
    event.payload = payload;
    event.error = error;
    await this.sync.saveEvent(event);
  }
}

@Injectable()
export class DispatchVendorInventorySyncUseCase {
  constructor(
    @Inject(IInventoryRepository)
    private readonly inventory: IInventoryRepository,
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
    @Inject(IQueuePublisher) private readonly queues: IQueuePublisher,
  ) {}

  async execute(input: InventoryUpdated) {
    const mappings =
      await this.inventory.findActiveVariantSyncsBySourceVariant(
        input.variantId,
      );
    let dispatched = 0;
    for (const mapping of mappings) {
      if (!mapping.sourceInventoryItemId || !mapping.vendorInventoryItemId)
        continue;
      const payload: VendorInventorySyncRequested = {
        tenantId: mapping.tenantId,
        connectionId: mapping.connectionId,
        sourceStoreId: mapping.sourceStoreId,
        vendorStoreId: mapping.vendorStoreId,
        sourceVariantId: mapping.sourceVariantId,
        vendorVariantId: mapping.vendorVariantId,
        sourceInventoryItemId: mapping.sourceInventoryItemId,
        vendorInventoryItemId: mapping.vendorInventoryItemId,
        availableQuantity: input.availableQuantity,
        origin: input.origin,
        timestamp: new Date().toISOString(),
        eventId: input.eventId,
      };
      await this.queues.publish(
        QUEUE_NAMES.VENDOR_INVENTORY_SYNC,
        'vendor-inventory-sync-requested',
        payload as unknown as Record<string, unknown>,
        {
          jobId: [
            'vendor-inventory',
            mapping.connectionId,
            mapping.sourceVariantId,
            input.eventId ?? input.timestamp,
          ]
            .join('-')
            .replace(/[^a-zA-Z0-9_-]/g, '-'),
          attempts: 8,
          backoffMs: 2_000,
        },
      );
      await this.recordDispatch(input, mapping.id);
      dispatched += 1;
    }
    return { dispatched };
  }

  private async recordDispatch(input: InventoryUpdated, variantSyncId: string) {
    const key = `vendor-inventory-requested:${variantSyncId}:${input.eventId ?? input.timestamp}`;
    const existing = await this.sync.findEventByKey(key);
    if (existing) return;
    await this.sync.saveEvent(
      this.sync.createEvent({
        tenantId: input.tenantId,
        connectionId: null,
        batchId: null,
        type: 'VENDOR_INVENTORY_SYNC_REQUESTED',
        idempotencyKey: key,
        status: SyncEventStatus.SUCCEEDED,
        attempts: 1,
        payload: {
          variantSyncId,
          sourceVariantId: input.variantId,
          availableQuantity: input.availableQuantity,
        },
      }),
    );
  }
}

@Injectable()
export class ProcessVendorInventorySyncUseCase {
  private readonly logger = new Logger(ProcessVendorInventorySyncUseCase.name);

  constructor(
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(IInventoryRepository)
    private readonly inventory: IInventoryRepository,
    @Inject(IShopifyInventoryPort)
    private readonly shopifyInventory: IShopifyInventoryPort,
    @Inject(IDistributedLock) private readonly locks: IDistributedLock,
  ) {}

  async execute(input: VendorInventorySyncRequested) {
    const key = `vendor-inventory-sync:${input.connectionId}:${input.sourceVariantId}`;
    const token = await this.locks.acquire(key, INVENTORY_LOCK_TTL_MS);
    if (!token) throw new DistributedLockUnavailableError(key);
    try {
      return await this.executeLocked(input);
    } finally {
      await this.locks.release(key, token);
    }
  }

  private async executeLocked(input: VendorInventorySyncRequested) {
    const started = Date.now();
    const [vendorStore, mapping] = await Promise.all([
      this.stores.findById(input.vendorStoreId),
      this.inventory.findVariantSync(input.connectionId, input.sourceVariantId),
    ]);
    if (!vendorStore) throw new NotFoundException('Tienda vendor no encontrada.');
    if (!mapping?.syncEnabled)
      throw new NotFoundException('RelaciÃ³n de variante no disponible.');
    const credentials = {
      shopDomain: vendorStore.shopifyShopId,
      accessToken: vendorStore.accessToken,
    };
    const vendorLevels = await this.shopifyInventory.getInventoryLevels(
      credentials,
      input.vendorInventoryItemId,
    );
    const locationId =
      vendorLevels[0]?.locationId ??
      (await this.shopifyInventory.getDefaultInventoryLocationId(credentials));
    await this.shopifyInventory.setInventory(credentials, {
      inventoryItemId: input.vendorInventoryItemId,
      locationId,
      quantity: Math.max(0, input.availableQuantity),
    });
    mapping.status = 'SYNCED';
    mapping.lastSyncedAt = new Date();
    mapping.lastError = null;
    mapping.lastDurationMs = Date.now() - started;
    await this.inventory.saveVariantSync(mapping);
    this.logger.log(
      JSON.stringify({
        event: 'vendor_inventory_sync_completed',
        connectionId: input.connectionId,
        sourceVariantId: input.sourceVariantId,
        vendorVariantId: input.vendorVariantId,
        quantity: input.availableQuantity,
        durationMs: mapping.lastDurationMs,
      }),
    );
    return { synced: true };
  }

  async markPermanentlyFailed(
    input: VendorInventorySyncRequested,
    error: Error,
  ) {
    const mapping = await this.inventory.findVariantSync(
      input.connectionId,
      input.sourceVariantId,
    );
    if (!mapping) return;
    mapping.status = 'FAILED';
    mapping.lastError = error.message;
    await this.inventory.saveVariantSync(mapping);
  }
}

export function inventoryItemIdFromWebhookPayload(
  payload: Record<string, unknown>,
) {
  const raw = payload.inventory_item_id ?? payload.inventoryItemId ?? '';
  const id = asScalarString(raw);
  if (!id) return '';
  return id.startsWith('gid://')
    ? id
    : `gid://shopify/InventoryItem/${id}`;
}
