import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { IQueuePublisher } from '../ports/queue-publisher.port';
import {
  DistributedLockUnavailableError,
  IDistributedLock,
} from '../ports/distributed-lock.port';
import { IRealtimePublisher } from '../ports/realtime-publisher.port';
import { IShopifyProductPort } from '../shopify/ports/shopify.ports';
import {
  IStoreConnectionRepository,
  ISTORE_CONNECTION_REPOSITORY,
} from '../store/repositories/IStoreConnectionRepository';
import { IStoreRepository } from '../store/repositories/IStoreRepository';
import { CreateNotificationUseCase } from '../notification/notification.use-cases';
import {
  ProductSnapshot,
  ProductVariantSnapshot,
} from '../../domain/entities/product-snapshot.entity';
import {
  InitialSyncJob,
  SyncedProduct,
} from '../../domain/entities/sync.entity';
import { SyncBatchStatus } from '../../domain/enums/sync-status.enum';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { asScalarString } from '../common/scalar';
import {
  IProductRepository,
  ISyncRepository,
} from './repositories/sync.repositories';
import { sourcePublicationStatus } from './product-publication-status';
import { IInventoryRepository } from '../inventory/repositories/inventory.repository';
import {
  InitialSyncScanRequested,
  InventorySyncRequested,
  ProductSyncRequested,
  ProductUpdated,
  VendorProductSyncRequested,
} from './sync.events';

const LOCK_TTL_MS = 10_000;
const DEFAULT_VENDOR_PRODUCT_RULES: Record<string, unknown> = {
  title: true,
  description: true,
  images: true,
  vendor: true,
  productType: true,
  tags: true,
  price: true,
  variants: true,
  options: true,
  skuStrategy: 'SOURCE_SKU',
  commissionPercentage: 0,
  commissionFixed: 0,
};

@Injectable()
export class QueueInitialSyncUseCase {
  constructor(
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
    @Inject(IQueuePublisher) private readonly queues: IQueuePublisher,
  ) {}

  async execute(tenantId: string, storeId: string) {
    const store = await this.stores.findById(storeId);
    if (!store || store.tenantId !== tenantId)
      throw new NotFoundException('Tienda no encontrada.');
    const active = await this.sync.findActiveInitialSyncJob(tenantId, storeId);
    if (active) return active;
    const initial = await this.sync.saveInitialSyncJob(
      this.sync.createInitialSyncJob({
        tenantId,
        storeId,
        status: SyncBatchStatus.PENDING,
        totalProducts: 0,
        processedProducts: 0,
        succeededProducts: 0,
        failedProducts: 0,
        lastError: null,
        startedAt: null,
        finishedAt: null,
      }),
    );
    await this.queues.publish(
      QUEUE_NAMES.RECONCILIATION,
      'scan-products',
      {
        tenantId,
        sourceTenantId: tenantId,
        storeId,
        initialSyncJobId: initial.id,
        origin: 'initial_sync',
      } satisfies InitialSyncScanRequested,
      {
        jobId: `initial-sync-${initial.id}`,
        attempts: 5,
        backoffMs: 2_000,
      },
    );
    return initial;
  }
}

@Injectable()
export class ScanProductsForSyncUseCase {
  private readonly logger = new Logger(ScanProductsForSyncUseCase.name);
  constructor(
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
    @Inject(IShopifyProductPort) private readonly shopify: IShopifyProductPort,
    @Inject(IQueuePublisher) private readonly queues: IQueuePublisher,
    @Inject(IRealtimePublisher) private readonly realtime: IRealtimePublisher,
    private readonly notifications: CreateNotificationUseCase,
  ) {}

  async execute(input: InitialSyncScanRequested) {
    const store = await this.stores.findById(input.storeId);
    if (!store || store.tenantId !== (input.sourceTenantId ?? input.tenantId))
      throw new NotFoundException('Tienda no encontrada.');
    const credentials = {
      shopDomain: store.shopifyShopId,
      accessToken: store.accessToken,
    };
    const total = await this.shopify.countProducts(credentials);
    if (input.initialSyncJobId) {
      const initial = await this.sync.setInitialSyncTotalAndRunning(
        input.initialSyncJobId,
        total,
      );
      if (initial)
        await this.realtime.publishToTenant(
          input.tenantId,
          'initial-sync.progress',
          {
            initialSyncJobId: initial.id,
            storeId: initial.storeId,
            status: initial.status,
            total: initial.totalProducts,
            processed: initial.processedProducts,
            succeeded: initial.succeededProducts,
            failed: initial.failedProducts,
            skipped: 0,
          },
        );
      await this.notifyInitialFinished(input.tenantId, initial);
    }
    if (input.batchId) {
      const batch = await this.sync.setBatchTotalAndRunning(
        input.batchId,
        total,
      );
      if (batch)
        await this.realtime.publishToTenant(
          input.tenantId,
          'sync.batch.progress',
          batch as unknown as Record<string, unknown>,
        );
      await this.notifyBatchFinished(input.tenantId, batch);
    }

    let cursor: string | undefined;
    let queued = 0;
    do {
      const page = await this.shopify.listProducts(credentials, cursor, 100);
      const payloads: ProductSyncRequested[] = [];
      for (const raw of page.items) {
        const shopifyProductId = asScalarString(raw.id);
        if (!shopifyProductId) continue;
        payloads.push({
          tenantId: input.tenantId,
          storeId: input.storeId,
          shopifyProductId,
          origin: input.origin,
          timestamp: new Date().toISOString(),
          deduplicationKey: `product-sync:${input.storeId}:${shopifyProductId}`,
          batchId: input.batchId,
          initialSyncJobId: input.initialSyncJobId,
          connectionId: input.connectionId,
          destinationStoreId: input.destinationStoreId,
          requestedByUserId: input.requestedByUserId,
        });
      }
      for (let offset = 0; offset < payloads.length; offset += 20)
        await Promise.all(
          payloads
            .slice(offset, offset + 20)
            .map((payload) => this.publishProduct(payload)),
        );
      queued += payloads.length;
      cursor = page.hasNextPage && page.cursor ? page.cursor : undefined;
    } while (cursor);
    if (queued !== total) {
      if (input.initialSyncJobId) {
        const initial = await this.sync.setInitialSyncTotalAndRunning(
          input.initialSyncJobId,
          queued,
        );
        if (initial)
          await this.realtime.publishToTenant(
            input.tenantId,
            'initial-sync.progress',
            {
              initialSyncJobId: initial.id,
              storeId: initial.storeId,
              status: initial.status,
              total: initial.totalProducts,
              processed: initial.processedProducts,
              succeeded: initial.succeededProducts,
              failed: initial.failedProducts,
              skipped: 0,
            },
          );
        await this.notifyInitialFinished(input.tenantId, initial);
      }
      if (input.batchId) {
        const batch = await this.sync.setBatchTotalAndRunning(
          input.batchId,
          queued,
        );
        if (batch)
          await this.realtime.publishToTenant(
            input.tenantId,
            'sync.batch.progress',
            batch as unknown as Record<string, unknown>,
          );
        await this.notifyBatchFinished(input.tenantId, batch);
      }
    }
    this.logger.log(
      JSON.stringify({
        event: 'product_scan_completed',
        storeId: input.storeId,
        origin: input.origin,
        queued,
      }),
    );
    return { queued, total };
  }

  private async notifyInitialFinished(
    tenantId: string,
    job: InitialSyncJob | null,
  ) {
    if (!job?.finishedAt) return;
    const hasErrors =
      job.status === SyncBatchStatus.FAILED ||
      job.status === SyncBatchStatus.PARTIAL ||
      job.failedProducts > 0;
    await this.notifications.execute({
      tenantId,
      type: hasErrors ? 'SYNC_ERROR' : 'INITIAL_SYNC_COMPLETED',
      title: hasErrors
        ? 'Sincronización inicial con errores'
        : 'Sincronización inicial completada',
      message: `${job.succeededProducts} correctos · ${job.failedProducts} errores`,
      payload: {
        initialSyncJobId: job.id,
        storeId: job.storeId,
        processed: job.processedProducts,
        total: job.totalProducts,
      },
      eventId: `initial-sync-completed:${job.id}`,
    });
  }

  private async notifyBatchFinished(
    tenantId: string,
    batch: import('../../domain/entities/sync.entity').SyncBatch | null,
  ) {
    if (!batch?.finishedAt) return;
    const hasErrors =
      batch.status === SyncBatchStatus.FAILED ||
      batch.status === SyncBatchStatus.PARTIAL ||
      batch.failed > 0;
    await this.notifications.execute({
      tenantId,
      userId: batch.requestedByUserId,
      type: hasErrors ? 'SYNC_ERROR' : 'SYNC_BATCH_COMPLETED',
      title: hasErrors
        ? 'Sincronización finalizada con errores'
        : 'Sincronización completada',
      message: `${batch.succeeded} correctos · ${batch.skipped} omitidos · ${batch.failed} errores`,
      payload: {
        batchId: batch.id,
        sourceStoreId: batch.sourceStoreId,
        destinationStoreId: batch.destinationStoreId,
        processed: batch.processed,
        succeeded: batch.succeeded,
        failed: batch.failed,
        skipped: batch.skipped,
      },
      eventId: `sync-batch-completed:${batch.id}`,
    });
  }

  async markPermanentlyFailed(input: InitialSyncScanRequested, error: Error) {
    if (input.initialSyncJobId) {
      const initial = await this.sync.failInitialSyncJob(
        input.initialSyncJobId,
        error.message,
      );
      if (initial)
        await this.realtime.publishToTenant(
          input.tenantId,
          'initial-sync.progress',
          {
            initialSyncJobId: initial.id,
            storeId: initial.storeId,
            status: initial.status,
            total: initial.totalProducts,
            processed: initial.processedProducts,
            succeeded: initial.succeededProducts,
            failed: initial.failedProducts,
          },
        );
      await this.notifyInitialFinished(input.tenantId, initial);
    }
    if (input.batchId) {
      const batch = await this.sync.failBatch(input.batchId, error.message);
      if (batch)
        await this.realtime.publishToTenant(
          input.tenantId,
          'sync.batch.progress',
          batch as unknown as Record<string, unknown>,
        );
      await this.notifyBatchFinished(input.tenantId, batch);
    }
  }

  private publishProduct(payload: ProductSyncRequested) {
    return this.queues.publish(
      QUEUE_NAMES.PRODUCT_SYNC,
      'product-sync-requested',
      payload as unknown as Record<string, unknown>,
      {
        jobId: [
          payload.batchId ??
            payload.initialSyncJobId ??
            `${payload.origin}-${payload.timestamp}`,
          payload.storeId,
          payload.shopifyProductId,
        ]
          .join('-')
          .replace(/[^a-zA-Z0-9_-]/g, '-'),
        attempts: 8,
        backoffMs: 2_000,
      },
    );
  }
}

@Injectable()
export class ProcessProductRequestedUseCase {
  private readonly logger = new Logger(ProcessProductRequestedUseCase.name);
  constructor(
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(IProductRepository) private readonly products: IProductRepository,
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
    @Inject(IShopifyProductPort) private readonly shopify: IShopifyProductPort,
    @Inject(IQueuePublisher) private readonly queues: IQueuePublisher,
    @Inject(IRealtimePublisher) private readonly realtime: IRealtimePublisher,
    private readonly notifications: CreateNotificationUseCase,
    @Inject(IDistributedLock) private readonly locks: IDistributedLock,
  ) {}

  async execute(input: ProductSyncRequested) {
    const key = `product-sync:${input.storeId}:${input.shopifyProductId}`;
    const token = await this.locks.acquire(key, LOCK_TTL_MS);
    if (!token) throw new DistributedLockUnavailableError(key);
    try {
      return await this.executeLocked(input);
    } finally {
      await this.locks.release(key, token);
    }
  }

  private async executeLocked(input: ProductSyncRequested) {
    const started = Date.now();
    const store = await this.stores.findById(input.storeId);
    if (!store) throw new NotFoundException('Tienda no encontrada.');
    const raw = input.deleted
      ? null
      : await this.shopify.getProduct(
          {
            shopDomain: store.shopifyShopId,
            accessToken: store.accessToken,
          },
          input.shopifyProductId,
        );
    let snapshot = await this.products.findByShopifyId(
      store.id,
      input.shopifyProductId,
    );
    if (!snapshot && !input.shopifyProductId.startsWith('gid://')) {
      snapshot = await this.products.findByShopifyId(
        store.id,
        `gid://shopify/Product/${input.shopifyProductId}`,
      );
    }

    if (!raw) {
      if (snapshot?.deletedAt) {
        await this.completeSourceResult(input, 'skipped');
        return {
          productId: snapshot.id,
          skipped: 'ALREADY_DELETED',
        };
      }
      if (snapshot) {
        snapshot.deletedAt = new Date();
        snapshot = await this.products.save(snapshot);
        await this.publishUpdated(input, snapshot, true);
      }
      await this.completeSourceResult(input, 'succeeded');
      return { deleted: Boolean(snapshot) };
    }

    const remoteUpdatedAt = raw.updatedAt
      ? new Date(asScalarString(raw.updatedAt))
      : null;
    const hasNewerVersion =
      !snapshot ||
      !snapshot.shopifyUpdatedAt ||
      !remoteUpdatedAt ||
      remoteUpdatedAt > snapshot.shopifyUpdatedAt;
    if (hasNewerVersion) {
      snapshot = await this.upsert(store, snapshot, raw);
    } else if (input.origin === 'webhook') {
      return {
        productId: snapshot!.id,
        skipped: 'STALE_OR_DUPLICATE_VERSION',
      };
    }
    if (!snapshot)
      throw new NotFoundException('No fue posible crear el snapshot.');
    await this.queueInventorySync(input, snapshot);
    await this.publishUpdated(input, snapshot, false);
    await this.completeSourceResult(input, 'succeeded');
    this.logger.log(
      JSON.stringify({
        event: 'product_sync_completed',
        storeId: store.id,
        productId: snapshot.id,
        origin: input.origin,
        durationMs: Date.now() - started,
      }),
    );
    return { productId: snapshot.id };
  }

  private async queueInventorySync(
    input: ProductSyncRequested,
    product: ProductSnapshot,
  ) {
    const variants = (product.variants ?? []).filter(
      (variant) => Boolean(variant.shopifyInventoryItemId),
    );
    await Promise.all(
      variants.map((variant) => {
        const inventoryItemId = variant.shopifyInventoryItemId as string;
        const payload: InventorySyncRequested = {
          tenantId: input.tenantId,
          storeId: input.storeId,
          variantId: variant.id,
          inventoryItemId,
          origin:
            input.origin === 'initial_sync' || input.origin === 'manual_sync'
              ? 'manual'
              : input.origin,
          timestamp: new Date().toISOString(),
          deduplicationKey: `inventory-sync:${input.storeId}:${inventoryItemId}`,
          eventId: input.batchId ?? input.initialSyncJobId ?? null,
        };
        return this.queues.publish(
          QUEUE_NAMES.INVENTORY_SYNC,
          'inventory-sync-requested',
          payload as unknown as Record<string, unknown>,
          {
            jobId: [
              'product-inventory',
              input.storeId,
              inventoryItemId,
              input.batchId ?? input.initialSyncJobId ?? input.origin,
            ]
              .join('-')
              .replace(/[^a-zA-Z0-9_-]/g, '-'),
            attempts: 8,
            backoffMs: 2_000,
          },
        );
      }),
    );
  }

  async markPermanentlyFailed(input: ProductSyncRequested, error: Error) {
    await this.completeSourceResult(input, 'failed', error.message);
  }

  private async upsert(
    store: import('../../domain/entities/store.entity').Store,
    product: ProductSnapshot | null,
    raw: Record<string, unknown>,
  ) {
    const entity =
      product ??
      this.products.create({
        tenantId: store.tenantId,
        storeId: store.id,
        shopifyProductId: asScalarString(raw.id),
      });
    entity.title = asScalarString(raw.title, 'Sin título');
    entity.description = raw.descriptionHtml
      ? asScalarString(raw.descriptionHtml)
      : null;
    entity.vendor = raw.vendor ? asScalarString(raw.vendor) : null;
    entity.productType = raw.productType
      ? asScalarString(raw.productType)
      : null;
    entity.tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
    entity.status = asScalarString(raw.status, 'DRAFT').toLowerCase();
    const imageNodes =
      (raw.images as { nodes?: Array<{ url?: unknown }> } | undefined)?.nodes ??
      [];
    const featured = (
      raw.featuredMedia as { preview?: { image?: { url?: unknown } } }
    )?.preview?.image?.url;
    entity.images = imageNodes.length
      ? imageNodes.map((image) => asScalarString(image.url)).filter(Boolean)
      : featured
        ? [asScalarString(featured)]
        : [];
    entity.payload = raw;
    entity.shopifyCreatedAt = raw.createdAt
      ? new Date(asScalarString(raw.createdAt))
      : null;
    entity.shopifyUpdatedAt = raw.updatedAt
      ? new Date(asScalarString(raw.updatedAt))
      : null;
    entity.deletedAt = null;
    const variants =
      (raw.variants as { nodes?: Record<string, unknown>[] } | undefined)
        ?.nodes ?? [];
    const existing = new Map(
      (entity.variants ?? []).map((variant) => [
        variant.shopifyVariantId,
        variant,
      ]),
    );
    entity.variants = variants.map((variant) => {
      const id = asScalarString(variant.id);
      return Object.assign(existing.get(id) ?? new ProductVariantSnapshot(), {
        tenantId: store.tenantId,
        storeId: store.id,
        shopifyVariantId: id,
        shopifyInventoryItemId:
          (variant.inventoryItem as { id?: string } | undefined)?.id ?? null,
        title: variant.title ? asScalarString(variant.title) : null,
        sku: variant.sku ? asScalarString(variant.sku) : null,
        barcode: variant.barcode ? asScalarString(variant.barcode) : null,
        price: asScalarString(variant.price, '0'),
        payload: variant,
      });
    });
    return this.products.save(entity);
  }

  private publishUpdated(
    input: ProductSyncRequested,
    product: ProductSnapshot,
    deleted: boolean,
  ) {
    const payload: ProductUpdated = {
      tenantId: input.tenantId,
      storeId: input.storeId,
      productId: product.id,
      shopifyProductId: product.shopifyProductId,
      shopifyUpdatedAt: product.shopifyUpdatedAt?.toISOString() ?? null,
      origin: input.origin,
      timestamp: new Date().toISOString(),
      batchId: input.batchId,
      connectionId: input.connectionId,
      destinationStoreId: input.destinationStoreId,
      requestedByUserId: input.requestedByUserId,
      deleted,
    };
    return this.queues.publish(
      QUEUE_NAMES.VENDOR_SYNC,
      deleted ? 'product-deleted' : 'product-updated',
      payload as unknown as Record<string, unknown>,
      { attempts: 8, backoffMs: 2_000 },
    );
  }

  private async completeSourceResult(
    input: ProductSyncRequested,
    result: 'succeeded' | 'failed' | 'skipped',
    error?: string,
  ) {
    if (input.initialSyncJobId) {
      const job = await this.sync.recordInitialSyncResult(
        input.initialSyncJobId,
        result === 'failed' ? 'failed' : 'succeeded',
        error,
      );
      if (job)
        await this.realtime.publishToTenant(
          input.tenantId,
          'initial-sync.progress',
          this.initialProgress(job),
        );
      if (job?.finishedAt)
        await this.notifications.execute({
          tenantId: input.tenantId,
          type:
            job.failedProducts > 0 ? 'SYNC_ERROR' : 'INITIAL_SYNC_COMPLETED',
          title:
            job.failedProducts > 0
              ? 'Sincronización inicial con errores'
              : 'Sincronización inicial completada',
          message: `${job.succeededProducts} correctos · ${job.failedProducts} errores`,
          payload: this.initialProgress(job),
          eventId: `initial-sync-completed:${job.id}`,
        });
    }
    if (input.batchId && (!input.connectionId || result === 'failed')) {
      const batch = await this.sync.recordBatchResult(input.batchId, result);
      if (batch)
        await this.realtime.publishToTenant(
          input.tenantId,
          'sync.batch.progress',
          batch as unknown as Record<string, unknown>,
        );
      if (batch?.finishedAt)
        await this.notifications.execute({
          tenantId: input.tenantId,
          userId: batch.requestedByUserId,
          type: batch.failed > 0 ? 'SYNC_ERROR' : 'SYNC_BATCH_COMPLETED',
          title:
            batch.failed > 0
              ? 'Sincronización finalizada con errores'
              : 'Sincronización completada',
          message: `${batch.succeeded} correctos · ${batch.skipped} omitidos · ${batch.failed} errores`,
          payload: {
            batchId: batch.id,
            sourceStoreId: batch.sourceStoreId,
            destinationStoreId: batch.destinationStoreId,
            processed: batch.processed,
            succeeded: batch.succeeded,
            failed: batch.failed,
            skipped: batch.skipped,
          },
          eventId: `sync-batch-completed:${batch.id}`,
        });
    }
  }

  private initialProgress(job: InitialSyncJob) {
    return {
      initialSyncJobId: job.id,
      storeId: job.storeId,
      status: job.status,
      total: job.totalProducts,
      processed: job.processedProducts,
      succeeded: job.succeededProducts,
      failed: job.failedProducts,
    };
  }
}

@Injectable()
export class DispatchVendorProductSyncUseCase {
  constructor(
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
    @Inject(ISTORE_CONNECTION_REPOSITORY)
    private readonly connections: IStoreConnectionRepository,
    @Inject(IQueuePublisher) private readonly queues: IQueuePublisher,
    @Inject(IRealtimePublisher) private readonly realtime: IRealtimePublisher,
    private readonly notifications: CreateNotificationUseCase,
  ) {}

  async execute(input: ProductUpdated) {
    const targets = new Map<string, VendorProductSyncRequested>();
    const mappings = await this.sync.findActiveSyncedProducts(
      input.storeId,
      input.productId,
    );
    for (const mapping of mappings)
      targets.set(mapping.connectionId, this.fromMapping(input, mapping));

    if (input.connectionId && input.destinationStoreId) {
      const connection = await this.connections.findById(input.connectionId);
      if (
        connection?.isActive &&
        connection.sourceStoreId === input.storeId &&
        connection.vendorStoreId === input.destinationStoreId
      ) {
        const mapping = mappings.find(
          (item) => item.connectionId === connection.id,
        );
        targets.set(connection.id, {
          tenantId: input.tenantId,
          connectionId: connection.id,
          sourceStoreId: input.storeId,
          sourceProductId: input.productId,
          sourceShopifyProductId: input.shopifyProductId,
          vendorStoreId: connection.vendorStoreId,
          vendorProductId: mapping?.vendorShopifyProductId ?? null,
          sourceVersion: input.shopifyUpdatedAt,
          origin: input.origin,
          timestamp: new Date().toISOString(),
          batchId: input.batchId,
          requestedByUserId: input.requestedByUserId,
          deleted: input.deleted,
        });
      }
    }

    for (const target of targets.values()) {
      await this.queues.publish(
        QUEUE_NAMES.VENDOR_SYNC,
        'vendor-product-sync-requested',
        target as unknown as Record<string, unknown>,
        {
          jobId: [
            'vendor',
            target.batchId ?? target.sourceVersion ?? target.timestamp,
            target.connectionId,
            target.sourceProductId,
          ]
            .join('-')
            .replace(/[^a-zA-Z0-9_-]/g, '-'),
          attempts: 8,
          backoffMs: 2_000,
        },
      );
    }
    if (input.batchId && input.connectionId && targets.size === 0)
      throw new ForbiddenException('No existe una conexión vendor activa.');
    return { dispatched: targets.size };
  }

  async markPermanentlyFailed(input: ProductUpdated, error: Error) {
    if (!input.batchId) return;
    const batch = await this.sync.recordBatchResult(input.batchId, 'failed');
    if (!batch) return;
    await this.realtime.publishToTenant(
      input.tenantId,
      'sync.batch.progress',
      batch as unknown as Record<string, unknown>,
    );
    if (batch.finishedAt)
      await this.notifications.execute({
        tenantId: input.tenantId,
        userId: batch.requestedByUserId,
        type: 'SYNC_ERROR',
        title: 'Sincronización finalizada con errores',
        message: `${batch.succeeded} correctos · ${batch.skipped} omitidos · ${batch.failed} errores`,
        payload: {
          batchId: batch.id,
          sourceStoreId: batch.sourceStoreId,
          destinationStoreId: batch.destinationStoreId,
          error: error.message,
        },
        eventId: `sync-batch-completed:${batch.id}`,
      });
  }

  private fromMapping(input: ProductUpdated, mapping: SyncedProduct) {
    return {
      tenantId: mapping.tenantId,
      connectionId: mapping.connectionId,
      sourceStoreId: mapping.sourceStoreId,
      sourceProductId: mapping.sourceProductId,
      sourceShopifyProductId: mapping.sourceShopifyProductId,
      vendorStoreId: mapping.vendorStoreId,
      vendorProductId: mapping.vendorShopifyProductId,
      sourceVersion: input.shopifyUpdatedAt,
      origin: input.origin,
      timestamp: new Date().toISOString(),
      batchId:
        input.connectionId === mapping.connectionId ? input.batchId : null,
      requestedByUserId: input.requestedByUserId,
      deleted: input.deleted,
    } satisfies VendorProductSyncRequested;
  }
}

@Injectable()
export class ProcessVendorProductSyncUseCase {
  private readonly logger = new Logger(ProcessVendorProductSyncUseCase.name);
  constructor(
    @Inject(IProductRepository) private readonly products: IProductRepository,
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
    @Inject(ISTORE_CONNECTION_REPOSITORY)
    private readonly connections: IStoreConnectionRepository,
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(IInventoryRepository)
    private readonly inventory: IInventoryRepository,
    @Inject(IShopifyProductPort) private readonly shopify: IShopifyProductPort,
    @Inject(IRealtimePublisher) private readonly realtime: IRealtimePublisher,
    @Inject(IQueuePublisher) private readonly queues: IQueuePublisher,
    private readonly notifications: CreateNotificationUseCase,
    @Inject(IDistributedLock) private readonly locks: IDistributedLock,
  ) {}

  async execute(input: VendorProductSyncRequested) {
    const key = `vendor-sync:${input.connectionId}:${input.sourceProductId}`;
    const token = await this.locks.acquire(key, LOCK_TTL_MS);
    if (!token) throw new DistributedLockUnavailableError(key);
    try {
      return await this.executeLocked(input);
    } finally {
      await this.locks.release(key, token);
    }
  }

  private async executeLocked(input: VendorProductSyncRequested) {
    const started = Date.now();
    const connection = await this.connections.findById(input.connectionId);
    if (
      !connection?.isActive ||
      connection.sourceStoreId !== input.sourceStoreId ||
      connection.vendorStoreId !== input.vendorStoreId
    )
      throw new ForbiddenException('La conexión ya no está activa.');
    const [source, vendor, product] = await Promise.all([
      this.stores.findById(input.sourceStoreId),
      this.stores.findById(input.vendorStoreId),
      this.products.findByIdForStore(
        input.sourceStoreId,
        input.sourceProductId,
      ),
    ]);
    if (!source || !vendor)
      throw new NotFoundException('Tiendas no disponibles.');
    let mapping = await this.sync.findSyncedProduct(
      input.connectionId,
      input.sourceProductId,
    );
    if (input.deleted) {
      if (mapping?.vendorShopifyProductId)
        await this.shopify.deleteProduct(
          {
            shopDomain: vendor.shopifyShopId,
            accessToken: vendor.accessToken,
          },
          mapping.vendorShopifyProductId,
        );
      if (mapping) {
        mapping.isActive = false;
        mapping.status = 'DELETED';
        mapping.lastSyncedAt = new Date();
        mapping.lastError = null;
        mapping.lastDurationMs = Date.now() - started;
        await this.sync.saveSyncedProduct(mapping);
      }
      await this.completeBatch(input, 'succeeded');
      return { deleted: Boolean(mapping) };
    }
    if (!product) throw new NotFoundException('Producto source no disponible.');
    const [globalSettings, connectionSettings] = await Promise.all([
      this.sync.getSettings(input.tenantId, null),
      this.sync.getSettings(input.tenantId, input.connectionId),
    ]);
    const productRules = {
      ...DEFAULT_VENDOR_PRODUCT_RULES,
      ...(globalSettings?.productRules ?? {}),
      ...(connectionSettings?.productRules ?? {}),
    };
    const transformedProduct = this.transformProduct(product, productRules);
    const remote = await this.shopify.upsertProduct(
      {
        shopDomain: vendor.shopifyShopId,
        accessToken: vendor.accessToken,
      },
      transformedProduct,
      mapping?.vendorShopifyProductId ?? input.vendorProductId ?? undefined,
    );
    const remoteId = String(remote.id);
    if (transformedProduct.status === 'ACTIVE') {
      await this.shopify.publishProduct(
        {
          shopDomain: vendor.shopifyShopId,
          accessToken: vendor.accessToken,
        },
        remoteId,
      );
    }
    mapping ??= this.sync.createSyncedProduct({
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      sourceStoreId: source.id,
      sourceProductId: product.id,
      vendorStoreId: vendor.id,
      vendorProductId: remoteId,
      sourceShopifyProductId: product.shopifyProductId,
      vendorShopifyProductId: remoteId,
      syncEnabled: true,
      isActive: true,
    });
    mapping.vendorProductId = remoteId;
    mapping.vendorShopifyProductId = remoteId;
    mapping.status = 'PROCESSING';
    mapping.syncEnabled = true;
    mapping.isActive = true;
    mapping.lastSourceVersion = product.shopifyUpdatedAt?.toISOString() ?? null;
    mapping.lastSyncedAt = null;
    mapping.lastError = null;
    mapping.lastDurationMs = Date.now() - started;
    mapping = await this.sync.saveSyncedProduct(mapping);
    const remoteProduct =
      (await this.shopify.getProduct(
        {
          shopDomain: vendor.shopifyShopId,
          accessToken: vendor.accessToken,
        },
        remoteId,
      )) ?? remote;
    await this.persistVariantSyncs(input, mapping, product, remoteProduct);
    mapping.status = 'SYNCED';
    mapping.lastSyncedAt = new Date();
    mapping.lastDurationMs = Date.now() - started;
    mapping = await this.sync.saveSyncedProduct(mapping);
    await this.completeBatch(input, 'succeeded');
    this.logger.log(
      JSON.stringify({
        event: 'vendor_product_sync_completed',
        connectionId: input.connectionId,
        sourceProductId: input.sourceProductId,
        vendorStoreId: input.vendorStoreId,
        durationMs: mapping.lastDurationMs,
      }),
    );
    return { remoteId };
  }

  async markPermanentlyFailed(input: VendorProductSyncRequested, error: Error) {
    let mapping = await this.sync.findSyncedProduct(
      input.connectionId,
      input.sourceProductId,
    );
    mapping ??= this.sync.createSyncedProduct({
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      sourceStoreId: input.sourceStoreId,
      sourceProductId: input.sourceProductId,
      sourceShopifyProductId: input.sourceShopifyProductId,
      vendorStoreId: input.vendorStoreId,
      vendorProductId: input.vendorProductId ?? '',
      vendorShopifyProductId: input.vendorProductId ?? '',
      syncEnabled: true,
      isActive: true,
    });
    mapping.status = 'FAILED';
    mapping.lastError = error.message;
    await this.sync.saveSyncedProduct(mapping);
    await this.completeBatch(input, 'failed', error.message);
  }

  private async completeBatch(
    input: VendorProductSyncRequested,
    result: 'succeeded' | 'failed',
    error?: string,
  ) {
    if (!input.batchId) return;
    const batch = await this.sync.recordBatchResult(input.batchId, result);
    if (!batch) return;
    await this.realtime.publishToTenant(
      input.tenantId,
      'sync.batch.progress',
      batch as unknown as Record<string, unknown>,
    );
    if (batch.finishedAt)
      await this.notifications.execute({
        tenantId: input.tenantId,
        userId: batch.requestedByUserId,
        type: error ? 'SYNC_ERROR' : 'SYNC_BATCH_COMPLETED',
        title: error
          ? 'Sincronización finalizada con errores'
          : 'Sincronización completada',
        message: `${batch.succeeded} correctos · ${batch.skipped} omitidos · ${batch.failed} errores`,
        payload: {
          batchId: batch.id,
          sourceStoreId: batch.sourceStoreId,
          destinationStoreId: batch.destinationStoreId,
          processed: batch.processed,
          succeeded: batch.succeeded,
          failed: batch.failed,
          skipped: batch.skipped,
        },
        eventId: `sync-batch-completed:${batch.id}`,
      });
  }

  private transformProduct(
    product: ProductSnapshot,
    rules: Record<string, unknown>,
  ) {
    const percentage = Math.max(
      0,
      Number(rules.commissionPercentage ?? 0) || 0,
    );
    const fixed = Math.max(0, Number(rules.commissionFixed ?? 0) || 0);
    const generatedSkuPrefix = product.shopifyProductId
      .split('/')
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, '');
    const variants = (product.variants ?? []).map((variant, index) => ({
      sku:
        rules.skuStrategy === 'GENERATED'
          ? `SSS-${generatedSkuPrefix || product.id.slice(0, 8)}-${index + 1}`
          : variant.sku,
      barcode: variant.barcode,
      price:
        rules.price === false
          ? undefined
          : this.applyCommission(variant.price, percentage, fixed),
      optionValues: [
        { optionName: 'Title', name: variant.title || 'Default Title' },
      ],
    }));
    return {
      title: rules.title === false ? undefined : product.title,
      descriptionHtml:
        rules.description === false ? undefined : product.description,
      vendor: rules.vendor === false ? undefined : product.vendor,
      productType:
        rules.productType === false ? undefined : product.productType,
      tags: rules.tags === false ? undefined : product.tags,
      files:
        rules.images === false
          ? undefined
          : (product.images ?? []).map((originalSource) => ({
              originalSource,
              contentType: 'IMAGE',
            })),
      status: sourcePublicationStatus(product.status),
      productOptions: [
        {
          name: 'Title',
          values: variants.map((variant) => ({
            name: variant.optionValues[0].name,
          })),
        },
      ],
      variants,
    };
  }

  private async persistVariantSyncs(
    input: VendorProductSyncRequested,
    mapping: SyncedProduct,
    sourceProduct: ProductSnapshot,
    remoteProduct: Record<string, unknown>,
  ) {
    const sourceVariants = sourceProduct.variants ?? [];
    const remoteVariants =
      (remoteProduct.variants as { nodes?: Record<string, unknown>[] })
        ?.nodes ?? [];
    for (const [index, sourceVariant] of sourceVariants.entries()) {
      const remoteVariant =
        remoteVariants[index] ??
        remoteVariants.find(
          (variant) =>
            asScalarString(variant.title) ===
            (sourceVariant.title || 'Default Title'),
        ) ??
        (sourceVariant.sku
          ? remoteVariants.find(
              (variant) => asScalarString(variant.sku) === sourceVariant.sku,
            )
          : undefined);
      const remoteVariantId = remoteVariant
        ? asScalarString(remoteVariant.id)
        : '';
      if (!remoteVariantId) continue;
      const existingVariantSync = await this.inventory.findVariantSync(
        input.connectionId,
        sourceVariant.id,
      );
      const previousVendorInventoryItemId =
        existingVariantSync?.vendorInventoryItemId ?? null;
      const wasInventoryMappingReady =
        existingVariantSync?.status === 'SYNCED' &&
        Boolean(previousVendorInventoryItemId);
      const variantSync =
        existingVariantSync ??
        this.inventory.createVariantSync({
          tenantId: mapping.tenantId,
          productSyncId: mapping.id,
          connectionId: mapping.connectionId,
          sourceStoreId: mapping.sourceStoreId,
          vendorStoreId: mapping.vendorStoreId,
          sourceVariantId: sourceVariant.id,
        });
      variantSync.productSyncId = mapping.id;
      variantSync.vendorVariantId = remoteVariantId;
      variantSync.sourceInventoryItemId = sourceVariant.shopifyInventoryItemId;
      variantSync.vendorInventoryItemId =
        (remoteVariant?.inventoryItem as { id?: string } | undefined)?.id ??
        null;
      variantSync.status = variantSync.vendorInventoryItemId
        ? 'SYNCED'
        : 'PENDING';
      variantSync.syncEnabled = true;
      variantSync.lastSyncedAt = new Date();
      variantSync.lastError = null;
      variantSync.lastDurationMs = null;
      const savedVariantSync =
        await this.inventory.saveVariantSync(variantSync);
      if (
        !wasInventoryMappingReady ||
        previousVendorInventoryItemId !==
          savedVariantSync.vendorInventoryItemId
      )
        await this.queueInventoryReconciliation(
          input,
          sourceVariant,
          savedVariantSync.id,
        );
    }
  }

  private async queueInventoryReconciliation(
    input: VendorProductSyncRequested,
    sourceVariant: ProductVariantSnapshot,
    variantSyncId: string,
  ) {
    if (!sourceVariant.shopifyInventoryItemId) return;
    const eventId = [
      input.batchId ?? input.sourceVersion ?? input.timestamp,
      input.connectionId,
      variantSyncId,
      'mapping-ready',
    ].join(':');
    const payload: InventorySyncRequested = {
      tenantId: input.tenantId,
      storeId: input.sourceStoreId,
      variantId: sourceVariant.id,
      inventoryItemId: sourceVariant.shopifyInventoryItemId,
      origin: 'retry',
      timestamp: new Date().toISOString(),
      deduplicationKey: `inventory-sync:${input.sourceStoreId}:${sourceVariant.shopifyInventoryItemId}`,
      eventId,
    };
    await this.queues.publish(
      QUEUE_NAMES.INVENTORY_SYNC,
      'inventory-sync-requested',
      payload as unknown as Record<string, unknown>,
      {
        jobId: [
          'vendor-inventory-reconcile',
          input.connectionId,
          sourceVariant.id,
          input.batchId ?? input.sourceVersion ?? input.timestamp,
        ]
          .join('-')
          .replace(/[^a-zA-Z0-9_-]/g, '-'),
        attempts: 8,
        backoffMs: 2_000,
      },
    );
  }

  private applyCommission(
    sourcePrice: string,
    percentage: number,
    fixed: number,
  ) {
    const price = Number(sourcePrice);
    if (!Number.isFinite(price)) return sourcePrice;
    return (price + price * (percentage / 100) + fixed).toFixed(2);
  }
}
