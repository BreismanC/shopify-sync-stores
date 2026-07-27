import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IQueuePublisher } from '../ports/queue-publisher.port';
import { IRealtimePublisher } from '../ports/realtime-publisher.port';
import { IShopifyProductPort } from '../shopify/ports/shopify.ports';
import {
  IStoreConnectionRepository,
  ISTORE_CONNECTION_REPOSITORY,
} from '../store/repositories/IStoreConnectionRepository';
import { IStoreRepository } from '../store/repositories/IStoreRepository';
import {
  ProductSnapshot,
  ProductVariantSnapshot,
} from '../../domain/entities/product-snapshot.entity';
import { Store } from '../../domain/entities/store.entity';
import {
  SyncBatchOperation,
  SyncBatchStatus,
  SyncEventStatus,
} from '../../domain/enums/sync-status.enum';
import { StoreRole } from '../../domain/enums/store-role.enum';
import { UserRole } from '../../domain/enums/user-role.enum';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import {
  IProductRepository,
  ISyncRepository,
  ProductListQuery,
} from './repositories/sync.repositories';
import { asScalarString } from '../common/scalar';
import { CreateNotificationUseCase } from '../notification/notification.use-cases';

const DEFAULT_PRODUCT_RULES = {
  title: true,
  description: true,
  images: true,
  vendor: true,
  productType: true,
  tags: true,
  price: true,
  variants: true,
  skuStrategy: 'SOURCE_SKU',
  inventory: true,
  publicationStatus: 'DRAFT',
  commissionPercentage: 0,
  commissionFixed: 0,
};

function assertCanSynchronize(role: UserRole) {
  if (![UserRole.OWNER, UserRole.ADMIN].includes(role))
    throw new ForbiddenException(
      'Solo OWNER y ADMIN pueden iniciar sincronizaciones.',
    );
}

export interface ProductSourceContext {
  source: Store;
  destination: Store;
  connectionId: string | null;
  kind: 'OWN' | 'CONNECTED';
}

@Injectable()
export class ProductSourceAccessUseCase {
  constructor(
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(ISTORE_CONNECTION_REPOSITORY)
    private readonly connections: IStoreConnectionRepository,
    @Inject(IProductRepository) private readonly products: IProductRepository,
  ) {}

  async list(tenantId: string) {
    const destination = await this.currentStore(tenantId);
    const rows: ProductSourceContext[] = [
      { source: destination, destination, connectionId: null, kind: 'OWN' },
    ];
    if (destination.role === StoreRole.VENDOR) {
      const connections = await this.connections.findActiveByVendorStore(
        destination.id,
      );
      const connected: Array<ProductSourceContext | null> = await Promise.all(
        connections.map(async (connection) => {
          const source = await this.stores.findById(connection.sourceStoreId);
          if (!source || !source.isActive || source.role !== StoreRole.SOURCE)
            return null;
          return {
            source,
            destination,
            connectionId: connection.id,
            kind: 'CONNECTED' as const,
          };
        }),
      );
      rows.push(
        ...connected
          .filter((row): row is ProductSourceContext => Boolean(row))
          .sort((a, b) =>
            a.source.shopifyShopId.localeCompare(b.source.shopifyShopId),
          ),
      );
    }
    return Promise.all(
      rows.map(async (row) => {
        const productCount = await this.products.countByStore(row.source.id);
        return {
          storeId: row.source.id,
          shopifyShopId: row.source.shopifyShopId,
          role: row.source.role,
          kind: row.kind,
          connectionId: row.connectionId,
          productCount,
          catalogStatus: productCount > 0 ? 'READY' : 'EMPTY',
        };
      }),
    );
  }

  async resolve(
    tenantId: string,
    sourceStoreId: string,
  ): Promise<ProductSourceContext> {
    const destination = await this.currentStore(tenantId);
    if (sourceStoreId === destination.id)
      return {
        source: destination,
        destination,
        connectionId: null,
        kind: 'OWN',
      };
    if (destination.role !== StoreRole.VENDOR)
      throw new ForbiddenException(
        'Una tienda SOURCE solo puede consultar su propio catálogo.',
      );
    const source = await this.stores.findById(sourceStoreId);
    if (!source || !source.isActive || source.role !== StoreRole.SOURCE)
      throw new ForbiddenException('Catálogo fuente no autorizado.');
    const connection = await this.connections.findPair(
      source.id,
      destination.id,
    );
    if (!connection || !connection.isActive)
      throw new ForbiddenException('La conexión SOURCE/VENDOR no está activa.');
    return {
      source,
      destination,
      connectionId: connection.id,
      kind: 'CONNECTED',
    };
  }

  private async currentStore(tenantId: string) {
    const stores = await this.stores.findByTenantId(tenantId);
    const store = stores.find((row) => row.isActive) ?? stores[0];
    if (!store)
      throw new NotFoundException('El tenant no tiene una tienda conectada.');
    return store;
  }
}

@Injectable()
export class GetProductSourcesUseCase {
  constructor(private readonly access: ProductSourceAccessUseCase) {}
  async execute(tenantId: string) {
    return { data: await this.access.list(tenantId) };
  }
}

@Injectable()
export class GetProductsUseCase {
  constructor(
    private readonly access: ProductSourceAccessUseCase,
    @Inject(IProductRepository) private readonly products: IProductRepository,
  ) {}
  async execute(
    tenantId: string,
    query: ProductListQuery & { sourceStoreId: string },
  ) {
    await this.access.resolve(tenantId, query.sourceStoreId);
    const { sourceStoreId, ...filters } = query;
    return this.products.listByStore(sourceStoreId, filters);
  }
}

@Injectable()
export class QueueStoreReconciliationUseCase {
  constructor(
    private readonly access: ProductSourceAccessUseCase,
    @Inject(IQueuePublisher) private readonly queues: IQueuePublisher,
  ) {}
  async execute(tenantId: string, sourceStoreId: string, role: UserRole) {
    assertCanSynchronize(role);
    const context = await this.access.resolve(tenantId, sourceStoreId);
    const bucket = Math.floor(Date.now() / 60_000);
    const jobId = await this.queues.publish(
      QUEUE_NAMES.RECONCILIATION,
      'reconcile-products',
      {
        tenantId: context.source.tenantId,
        notifyTenantId: tenantId,
        storeId: context.source.id,
      },
      {
        jobId: `products-${context.source.id}-${bucket}`,
        attempts: 3,
      },
    );
    return { jobId, status: 'QUEUED' };
  }
}

@Injectable()
export class UpsertProductSnapshotUseCase {
  constructor(
    @Inject(IProductRepository) private readonly products: IProductRepository,
  ) {}

  async execute(store: Store, raw: Record<string, unknown>) {
    const shopifyProductId = asScalarString(raw.id);
    let product = await this.products.findByShopifyId(
      store.id,
      shopifyProductId,
    );
    if (!product)
      product = this.products.create({
        tenantId: store.tenantId,
        storeId: store.id,
        shopifyProductId,
      });
    product.title = asScalarString(raw.title, 'Sin título');
    product.description = raw.descriptionHtml
      ? asScalarString(raw.descriptionHtml)
      : null;
    product.vendor = raw.vendor ? asScalarString(raw.vendor) : null;
    product.productType = raw.productType
      ? asScalarString(raw.productType)
      : null;
    product.tags = Array.isArray(raw.tags) ? raw.tags.map(String) : [];
    product.status = asScalarString(raw.status, 'DRAFT').toLowerCase();
    const imageUrl = (
      raw.featuredMedia as { preview?: { image?: { url?: unknown } } }
    )?.preview?.image?.url;
    product.images = imageUrl ? [asScalarString(imageUrl)] : [];
    product.payload = raw;
    product.shopifyCreatedAt = raw.createdAt
      ? new Date(asScalarString(raw.createdAt))
      : null;
    product.shopifyUpdatedAt = raw.updatedAt
      ? new Date(asScalarString(raw.updatedAt))
      : null;
    product.deletedAt = null;
    const variantNodes =
      (raw.variants as { nodes?: Record<string, unknown>[] } | undefined)
        ?.nodes ?? [];
    const existingVariants = new Map(
      (product.variants ?? []).map((variant) => [
        variant.shopifyVariantId,
        variant,
      ]),
    );
    product.variants = variantNodes.map((variant) => {
      const shopifyVariantId = asScalarString(variant.id);
      return Object.assign(
        existingVariants.get(shopifyVariantId) ?? new ProductVariantSnapshot(),
        {
          tenantId: store.tenantId,
          storeId: store.id,
          shopifyVariantId,
          shopifyInventoryItemId:
            (variant.inventoryItem as { id?: string } | undefined)?.id ?? null,
          title: variant.title ? asScalarString(variant.title) : null,
          sku: variant.sku ? asScalarString(variant.sku) : null,
          barcode: variant.barcode ? asScalarString(variant.barcode) : null,
          price: asScalarString(variant.price, '0'),
          inventoryQuantity: Number(variant.inventoryQuantity ?? 0),
          payload: variant,
        },
      );
    });
    return this.products.save(product);
  }
}

@Injectable()
export class ReconcileStoreUseCase {
  constructor(
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(IShopifyProductPort) private readonly shopify: IShopifyProductPort,
    private readonly upsertSnapshot: UpsertProductSnapshotUseCase,
    @Inject(IRealtimePublisher) private readonly realtime: IRealtimePublisher,
  ) {}
  async execute(input: {
    tenantId: string;
    storeId: string;
    notifyTenantId?: string;
  }) {
    const store = await this.stores.findById(input.storeId);
    if (!store || store.tenantId !== input.tenantId)
      throw new NotFoundException('Tienda no encontrada.');
    let cursor: string | undefined;
    let imported = 0;
    do {
      const page = await this.shopify.listProducts(
        { shopDomain: store.shopifyShopId, accessToken: store.accessToken },
        cursor,
        100,
      );
      for (const raw of page.items) {
        await this.upsertSnapshot.execute(store, raw);
        imported += 1;
      }
      cursor = page.hasNextPage && page.cursor ? page.cursor : undefined;
    } while (cursor);
    const payload = { storeId: input.storeId, imported };
    await this.realtime.publishToTenant(
      input.notifyTenantId ?? input.tenantId,
      'products.reconciled',
      payload,
    );
    if (input.notifyTenantId && input.notifyTenantId !== input.tenantId)
      await this.realtime.publishToTenant(
        input.tenantId,
        'products.reconciled',
        payload,
      );
    return { imported };
  }
}

@Injectable()
export class ProcessProductWebhookUseCase {
  constructor(
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(IProductRepository) private readonly products: IProductRepository,
    private readonly reconcile: ReconcileStoreUseCase,
  ) {}
  async execute(job: {
    tenantId?: string | null;
    storeId?: string | null;
    topic: string;
    payload: Record<string, unknown>;
  }) {
    if (!job.storeId) return { skipped: 'UNKNOWN_STORE' };
    const store = await this.stores.findById(job.storeId);
    if (!store) return { skipped: 'UNKNOWN_STORE' };
    if (job.topic === 'products/delete') {
      const rawId = asScalarString(job.payload.id);
      const product =
        (await this.products.findByShopifyId(store.id, rawId)) ??
        (await this.products.findByShopifyId(
          store.id,
          `gid://shopify/Product/${rawId}`,
        ));
      if (product) {
        product.deletedAt = new Date();
        await this.products.save(product);
      }
      return { deleted: Boolean(product) };
    }
    return this.reconcile.execute({
      tenantId: store.tenantId,
      storeId: store.id,
    });
  }
}

@Injectable()
export class UpdateSyncSettingsUseCase {
  constructor(
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
  ) {}
  async get(tenantId: string, connectionId: string | null) {
    const found = await this.sync.getSettings(tenantId, connectionId);
    return (
      found ?? {
        tenantId,
        connectionId,
        version: 1,
        productRules: DEFAULT_PRODUCT_RULES,
        orderRules: {},
        inventoryRules: { sourceOfTruth: 'SOURCE', preventNegative: true },
      }
    );
  }
  async execute(
    tenantId: string,
    connectionId: string | null,
    input: {
      productRules?: Record<string, unknown>;
      orderRules?: Record<string, unknown>;
      inventoryRules?: Record<string, unknown>;
    },
  ) {
    let settings = await this.sync.getSettings(tenantId, connectionId);
    if (!settings)
      settings = this.sync.createSettings({
        tenantId,
        connectionId,
        version: 1,
      });
    settings.version += settings.id ? 1 : 0;
    settings.productRules = {
      ...DEFAULT_PRODUCT_RULES,
      ...settings.productRules,
      ...input.productRules,
    };
    settings.orderRules = { ...settings.orderRules, ...input.orderRules };
    settings.inventoryRules = {
      sourceOfTruth: 'SOURCE',
      preventNegative: true,
      ...settings.inventoryRules,
      ...input.inventoryRules,
    };
    return this.sync.saveSettings(settings);
  }
}

export interface CreateSyncBatchInput {
  tenantId: string;
  userId: string;
  userRole: UserRole;
  sourceStoreId: string;
  productIds: string[];
}

export interface ProductSyncJobInput {
  tenantId: string;
  batchId: string;
  sourceStoreId: string;
  destinationStoreId: string;
  connectionId: string | null;
  operation: SyncBatchOperation;
  productId: string;
}

@Injectable()
export class CreateSyncBatchUseCase {
  constructor(
    private readonly access: ProductSourceAccessUseCase,
    @Inject(IProductRepository) private readonly products: IProductRepository,
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
    @Inject(IQueuePublisher) private readonly queues: IQueuePublisher,
  ) {}

  async execute(input: CreateSyncBatchInput) {
    assertCanSynchronize(input.userRole);
    const context = await this.access.resolve(
      input.tenantId,
      input.sourceStoreId,
    );
    const uniqueIds = [...new Set(input.productIds)];
    const products = uniqueIds.length
      ? await this.products.findByIdsForStore(context.source.id, uniqueIds)
      : await this.products.findAllByStore(context.source.id);
    if (uniqueIds.length && products.length !== uniqueIds.length)
      throw new BadRequestException(
        'Uno o más productos no pertenecen al catálogo autorizado.',
      );
    if (!products.length)
      throw new BadRequestException(
        'El catálogo está vacío. Actualízalo primero desde Shopify.',
      );
    const operation =
      context.kind === 'OWN'
        ? SyncBatchOperation.CATALOG_REFRESH
        : SyncBatchOperation.PRODUCT_REPLICATION;
    const batch = await this.sync.saveBatch(
      this.sync.createBatch({
        tenantId: input.tenantId,
        connectionId: context.connectionId,
        sourceStoreId: context.source.id,
        destinationStoreId: context.destination.id,
        operation,
        requestedByUserId: input.userId,
        status: SyncBatchStatus.PENDING,
        total: products.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        summary: {},
        startedAt: null,
        finishedAt: null,
      }),
    );
    await Promise.all(
      products.map((product) =>
        this.queues.publish(
          QUEUE_NAMES.PRODUCT_SYNC,
          'sync-product',
          {
            tenantId: input.tenantId,
            batchId: batch.id,
            sourceStoreId: context.source.id,
            destinationStoreId: context.destination.id,
            connectionId: context.connectionId,
            operation,
            productId: product.id,
          },
          { jobId: `${batch.id}-${product.id}`, attempts: 5, backoffMs: 2_000 },
        ),
      ),
    );
    batch.status = SyncBatchStatus.RUNNING;
    batch.startedAt = new Date();
    return this.sync.saveBatch(batch);
  }
}

@Injectable()
export class ProcessProductSyncJobUseCase {
  constructor(
    @Inject(IProductRepository) private readonly products: IProductRepository,
    @Inject(ISyncRepository) private readonly sync: ISyncRepository,
    @Inject(ISTORE_CONNECTION_REPOSITORY)
    private readonly connections: IStoreConnectionRepository,
    @Inject(IStoreRepository) private readonly stores: IStoreRepository,
    @Inject(IShopifyProductPort) private readonly shopify: IShopifyProductPort,
    private readonly upsertSnapshot: UpsertProductSnapshotUseCase,
    private readonly createNotification: CreateNotificationUseCase,
    @Inject(IRealtimePublisher) private readonly realtime: IRealtimePublisher,
  ) {}

  async execute(input: ProductSyncJobInput) {
    const product = await this.products.findByIdForStore(
      input.sourceStoreId,
      input.productId,
    );
    const source = await this.stores.findById(input.sourceStoreId);
    const destination = await this.stores.findById(input.destinationStoreId);
    if (
      !product ||
      !source ||
      !destination ||
      destination.tenantId !== input.tenantId
    )
      throw new NotFoundException('Producto o tiendas no disponibles.');
    if (input.operation === SyncBatchOperation.PRODUCT_REPLICATION) {
      if (!input.connectionId)
        throw new BadRequestException('La replicación requiere una conexión.');
      const connection = await this.connections.findById(input.connectionId);
      if (
        !connection ||
        !connection.isActive ||
        connection.sourceStoreId !== source.id ||
        connection.vendorStoreId !== destination.id
      )
        throw new ForbiddenException(
          'La conexión ya no autoriza esta sincronización.',
        );
    } else if (source.id !== destination.id) {
      throw new BadRequestException(
        'La actualización propia requiere la misma tienda.',
      );
    }

    const idempotencyKey =
      input.operation === SyncBatchOperation.CATALOG_REFRESH
        ? `catalog:${input.batchId}:${product.id}`
        : `product:${input.connectionId}:${product.id}:${product.updatedAt.toISOString()}`;
    const previous = await this.sync.findEventByKey(idempotencyKey);
    if (previous?.status === SyncEventStatus.SUCCEEDED) {
      if (input.operation === SyncBatchOperation.PRODUCT_REPLICATION) {
        const batch = await this.sync.recordBatchResult(
          input.batchId,
          'skipped',
        );
        await this.publishProgress(input.tenantId, batch, product.id);
      }
      return { skipped: true };
    }
    const event =
      previous ??
      this.sync.createEvent({
        tenantId: input.tenantId,
        batchId: input.batchId,
        connectionId: input.connectionId,
        type: input.operation,
        idempotencyKey,
        status: SyncEventStatus.PROCESSING,
        payload: { productId: product.id, sourceStoreId: source.id },
        attempts: 0,
        error: null,
      });
    event.status = SyncEventStatus.PROCESSING;
    event.attempts += 1;
    await this.sync.saveEvent(event);
    try {
      let remoteId = product.shopifyProductId;
      if (input.operation === SyncBatchOperation.CATALOG_REFRESH) {
        const raw = await this.shopify.getProduct(
          { shopDomain: source.shopifyShopId, accessToken: source.accessToken },
          product.shopifyProductId,
        );
        if (!raw)
          throw new NotFoundException('El producto ya no existe en Shopify.');
        await this.upsertSnapshot.execute(source, raw);
      } else {
        const connectionId = input.connectionId as string;
        const settings = await this.sync.getSettings(
          input.tenantId,
          connectionId,
        );
        const mapping = await this.sync.findSyncedProduct(
          connectionId,
          product.id,
        );
        const remote = await this.shopify.upsertProduct(
          {
            shopDomain: destination.shopifyShopId,
            accessToken: destination.accessToken,
          },
          this.transformProduct(
            product,
            settings?.productRules ?? DEFAULT_PRODUCT_RULES,
          ),
          mapping?.vendorShopifyProductId,
        );
        remoteId = String(remote.id);
        const relation =
          mapping ??
          this.sync.createSyncedProduct({
            tenantId: input.tenantId,
            connectionId,
            sourceProductId: product.id,
            vendorProductId: remoteId,
            sourceShopifyProductId: product.shopifyProductId,
            vendorShopifyProductId: remoteId,
            isActive: true,
          });
        relation.vendorShopifyProductId = remoteId;
        relation.vendorProductId = remoteId;
        relation.lastSourceVersion = product.updatedAt.toISOString();
        relation.lastSyncedAt = new Date();
        await this.sync.saveSyncedProduct(relation);
      }
      event.status = SyncEventStatus.SUCCEEDED;
      event.error = null;
      await this.sync.saveEvent(event);
      const batch = await this.sync.recordBatchResult(
        input.batchId,
        'succeeded',
      );
      await this.publishProgress(input.tenantId, batch, product.id);
      return { remoteId };
    } catch (error) {
      event.status = SyncEventStatus.FAILED;
      event.error = error instanceof Error ? error.message : String(error);
      await this.sync.saveEvent(event);
      throw error;
    }
  }

  async markPermanentlyFailed(input: ProductSyncJobInput, error: Error) {
    const batch = await this.sync.recordBatchResult(input.batchId, 'failed');
    await this.publishProgress(
      input.tenantId,
      batch,
      input.productId,
      error.message,
    );
  }

  private async publishProgress(
    tenantId: string,
    batch: import('../../domain/entities/sync.entity').SyncBatch | null,
    productId: string,
    error?: string,
  ) {
    if (!batch) return;
    await this.realtime.publishToTenant(tenantId, 'sync.batch.progress', {
      batchId: batch.id,
      processed: batch.processed,
      total: batch.total,
      succeeded: batch.succeeded,
      failed: batch.failed,
      skipped: batch.skipped,
      status: batch.status,
      productId,
      ...(error ? { error } : {}),
    });
    if (batch.finishedAt) {
      const hasErrors = batch.failed > 0;
      await this.createNotification.execute({
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
          operation: batch.operation,
        },
        eventId: `sync-batch-completed:${batch.id}`,
      });
    }
  }

  private transformProduct(
    product: ProductSnapshot,
    rules: Record<string, unknown>,
  ) {
    const variantRows = (product.variants ?? []).map(
      (variant: ProductVariantSnapshot) => ({
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price,
        optionValues: [
          { optionName: 'Title', name: variant.title || 'Default Title' },
        ],
      }),
    );
    return {
      title: rules.title === false ? undefined : product.title,
      descriptionHtml:
        rules.description === false ? undefined : product.description,
      vendor: rules.vendor === false ? undefined : product.vendor,
      productType:
        rules.productType === false ? undefined : product.productType,
      tags: rules.tags === false ? undefined : product.tags,
      status: asScalarString(rules.publicationStatus, 'DRAFT'),
      productOptions: [
        {
          name: 'Title',
          values: variantRows.map((row) => ({
            name: row.optionValues[0].name,
          })),
        },
      ],
      variants: variantRows,
    };
  }
}
