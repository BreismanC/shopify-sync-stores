import { ForbiddenException } from '@nestjs/common';
import { StoreRole } from '../../domain/enums/store-role.enum';
import { UserRole } from '../../domain/enums/user-role.enum';
import {
  SyncBatchOperation,
  SyncBatchStatus,
  SyncEventStatus,
} from '../../domain/enums/sync-status.enum';
import {
  CreateSyncBatchUseCase,
  GetProductsUseCase,
  ProcessProductSyncJobUseCase,
  ProductSourceAccessUseCase,
  QueueStoreReconciliationUseCase,
} from './sync.use-cases';

describe('Product sync use cases', () => {
  const ownStore = {
    id: 'store-own',
    tenantId: 'tenant-vendor',
    shopifyShopId: 'vendor.myshopify.com',
    accessToken: 'token',
    role: StoreRole.VENDOR,
    isActive: true,
  };
  const sourceStore = {
    id: 'store-source',
    tenantId: 'tenant-source',
    shopifyShopId: 'source.myshopify.com',
    accessToken: 'source-token',
    role: StoreRole.SOURCE,
    isActive: true,
  };

  it('lists the own store and active SOURCE stores for a VENDOR', async () => {
    const stores = {
      findByTenantId: jest.fn().mockResolvedValue([ownStore]),
      findById: jest.fn().mockResolvedValue(sourceStore),
    };
    const connections = {
      findActiveByVendorStore: jest.fn().mockResolvedValue([
        {
          id: 'connection-1',
          sourceStoreId: sourceStore.id,
          vendorStoreId: ownStore.id,
          isActive: true,
        },
      ]),
    };
    const products = { countByStore: jest.fn().mockResolvedValue(2) };
    const useCase = new ProductSourceAccessUseCase(
      stores as never,
      connections as never,
      products as never,
    );

    const result = await useCase.list(ownStore.tenantId);

    expect(result).toEqual([
      expect.objectContaining({ storeId: ownStore.id, kind: 'OWN' }),
      expect.objectContaining({
        storeId: sourceStore.id,
        kind: 'CONNECTED',
        connectionId: 'connection-1',
      }),
    ]);
  });

  it('rejects external catalogs when the active store is SOURCE', async () => {
    const stores = {
      findByTenantId: jest
        .fn()
        .mockResolvedValue([{ ...sourceStore, tenantId: 'tenant-source' }]),
    };
    const useCase = new ProductSourceAccessUseCase(
      stores as never,
      {} as never,
      {} as never,
    );

    await expect(
      useCase.resolve('tenant-source', 'another-store'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks own products as synced because they exist in the catalog', async () => {
    const product = { id: 'product-1', variants: [] };
    const useCase = new GetProductsUseCase(
      {
        resolve: jest.fn().mockResolvedValue({
          source: ownStore,
          destination: ownStore,
          connectionId: null,
          kind: 'OWN',
        }),
      } as never,
      {
        listByStore: jest.fn().mockResolvedValue({ data: [product], total: 1 }),
      } as never,
      { findSnapshotsByVariantIds: jest.fn().mockResolvedValue([]) } as never,
      { findSyncedProductIds: jest.fn() } as never,
    );

    const result = await useCase.execute(ownStore.tenantId, {
      sourceStoreId: ownStore.id,
      page: 1,
      perPage: 20,
      sortBy: 'createdAt',
      order: 'desc',
    });

    expect(result.data[0]).toEqual(expect.objectContaining({ isSynced: true }));
  });

  it('marks connected products as synced only when a destination mapping exists', async () => {
    const products = [
      { id: 'product-synced', variants: [] },
      { id: 'product-missing', variants: [] },
    ];
    const sync = {
      findSyncedProductIds: jest.fn().mockResolvedValue(['product-synced']),
    };
    const useCase = new GetProductsUseCase(
      {
        resolve: jest.fn().mockResolvedValue({
          source: sourceStore,
          destination: ownStore,
          connectionId: 'connection-1',
          kind: 'CONNECTED',
        }),
      } as never,
      {
        listByStore: jest.fn().mockResolvedValue({ data: products, total: 2 }),
      } as never,
      { findSnapshotsByVariantIds: jest.fn().mockResolvedValue([]) } as never,
      sync as never,
    );

    const result = await useCase.execute(ownStore.tenantId, {
      sourceStoreId: sourceStore.id,
      page: 1,
      perPage: 20,
      sortBy: 'createdAt',
      order: 'desc',
    });

    expect(sync.findSyncedProductIds).toHaveBeenCalledWith('connection-1', [
      'product-synced',
      'product-missing',
    ]);
    expect(result.data).toEqual([
      expect.objectContaining({ id: 'product-synced', isSynced: true }),
      expect.objectContaining({ id: 'product-missing', isSynced: false }),
    ]);
  });

  it('creates an initial sync job and queues the product scan', async () => {
    const access = {
      resolve: jest.fn().mockResolvedValue({
        source: ownStore,
        destination: ownStore,
        connectionId: null,
        kind: 'OWN',
      }),
    };
    const initial = { id: 'initial-1' };
    const sync = {
      findActiveInitialSyncJob: jest.fn().mockResolvedValue(null),
      createInitialSyncJob: jest.fn(() => initial),
      saveInitialSyncJob: jest.fn().mockResolvedValue(initial),
    };
    const queues = { publish: jest.fn().mockResolvedValue('refresh-job') };
    const useCase = new QueueStoreReconciliationUseCase(
      access as never,
      sync as never,
      queues as never,
    );

    const result = await useCase.execute(
      ownStore.tenantId,
      ownStore.id,
      UserRole.OWNER,
    );

    expect(result).toEqual({
      jobId: 'refresh-job',
      initialSyncJobId: initial.id,
      status: SyncBatchStatus.PENDING,
    });
    expect(queues.publish).toHaveBeenCalledWith(
      'reconciliation',
      'scan-products',
      expect.objectContaining({
        tenantId: ownStore.tenantId,
        storeId: ownStore.id,
        origin: 'initial_sync',
      }),
      expect.objectContaining({ attempts: 5 }),
    );
  });
  it('creates one catalog refresh job per selected own product', async () => {
    const access = {
      resolve: jest.fn().mockResolvedValue({
        source: ownStore,
        destination: ownStore,
        connectionId: null,
        kind: 'OWN',
      }),
    };
    const products = {
      findByIdsForStore: jest.fn().mockResolvedValue([
        {
          id: 'product-1',
          shopifyProductId: 'gid://shopify/Product/1',
        },
        {
          id: 'product-2',
          shopifyProductId: 'gid://shopify/Product/2',
        },
      ]),
    };
    const batch = {
      id: 'batch-1',
      status: SyncBatchStatus.PENDING,
      startedAt: null,
    };
    const sync = {
      findActiveBatch: jest.fn().mockResolvedValue(null),
      createBatch: jest.fn((input: Record<string, unknown>) => ({
        ...batch,
        ...input,
      })),
      saveBatch: jest.fn((input: unknown) => Promise.resolve(input)),
    };
    const queues = { publish: jest.fn().mockResolvedValue('job-id') };
    const useCase = new CreateSyncBatchUseCase(
      access as never,
      products as never,
      sync as never,
      queues as never,
    );

    const result = await useCase.execute({
      tenantId: ownStore.tenantId,
      userId: 'user-1',
      userRole: UserRole.OWNER,
      sourceStoreId: ownStore.id,
      productIds: ['product-1', 'product-2'],
    });

    expect(result.operation).toBe(SyncBatchOperation.CATALOG_REFRESH);
    expect(result.connectionId).toBeNull();
    expect(queues.publish).toHaveBeenCalledTimes(2);
    expect(queues.publish).toHaveBeenCalledWith(
      'product-sync',
      'product-sync-requested',
      expect.objectContaining({
        storeId: ownStore.id,
        destinationStoreId: ownStore.id,
        origin: 'manual_sync',
      }),
      expect.any(Object),
    );
  });

  it('queues a paginated Shopify scan when no product is selected', async () => {
    const access = {
      resolve: jest.fn().mockResolvedValue({
        source: ownStore,
        destination: ownStore,
        connectionId: null,
        kind: 'OWN',
      }),
    };
    const products = {
      findByIdsForStore: jest.fn(),
    };
    const batch = {
      id: 'batch-all',
      status: SyncBatchStatus.PENDING,
      startedAt: null,
    };
    const sync = {
      findActiveBatch: jest.fn().mockResolvedValue(null),
      createBatch: jest.fn((input: Record<string, unknown>) => ({
        ...batch,
        ...input,
      })),
      saveBatch: jest.fn((input: unknown) => Promise.resolve(input)),
    };
    const queues = { publish: jest.fn().mockResolvedValue('job-id') };
    const useCase = new CreateSyncBatchUseCase(
      access as never,
      products as never,
      sync as never,
      queues as never,
    );

    const result = await useCase.execute({
      tenantId: ownStore.tenantId,
      userId: 'user-1',
      userRole: UserRole.OWNER,
      sourceStoreId: ownStore.id,
      productIds: [],
    });

    expect(products.findByIdsForStore).not.toHaveBeenCalled();
    expect(result.total).toBe(0);
    expect(queues.publish).toHaveBeenCalledTimes(1);
    expect(queues.publish).toHaveBeenCalledWith(
      'reconciliation',
      'scan-products',
      expect.objectContaining({
        tenantId: ownStore.tenantId,
        sourceTenantId: ownStore.tenantId,
        storeId: ownStore.id,
        batchId: 'batch-all',
      }),
      expect.any(Object),
    );
  });
  it('refreshes an own product without calling Shopify productSet', async () => {
    const product = {
      id: 'product-1',
      storeId: ownStore.id,
      shopifyProductId: 'gid://shopify/Product/1',
      updatedAt: new Date('2026-07-23T00:00:00Z'),
    };
    const products = { findByIdForStore: jest.fn().mockResolvedValue(product) };
    const event = {
      status: SyncEventStatus.PROCESSING,
      attempts: 0,
      error: null,
    };
    const batch = {
      id: 'batch-1',
      requestedByUserId: 'user-1',
      sourceStoreId: ownStore.id,
      destinationStoreId: ownStore.id,
      operation: SyncBatchOperation.CATALOG_REFRESH,
      status: SyncBatchStatus.RUNNING,
      total: 1,
      processed: 1,
      succeeded: 1,
      failed: 0,
      skipped: 0,
      finishedAt: null,
    };
    const sync = {
      findEventByKey: jest.fn().mockResolvedValue(null),
      createEvent: jest.fn(() => event),
      saveEvent: jest.fn((input: unknown) => Promise.resolve(input)),
      recordBatchResult: jest.fn().mockResolvedValue(batch),
    };
    const stores = {
      findById: jest.fn().mockResolvedValue(ownStore),
    };
    const shopify = {
      getProduct: jest.fn().mockResolvedValue({
        id: product.shopifyProductId,
        title: 'Product',
      }),
      upsertProduct: jest.fn(),
    };
    const snapshot = { execute: jest.fn().mockResolvedValue(product) };
    const realtime = {
      publishToTenant: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new ProcessProductSyncJobUseCase(
      products as never,
      sync as never,
      {} as never,
      stores as never,
      shopify as never,
      snapshot as never,
      { execute: jest.fn() } as never,
      realtime as never,
    );

    await useCase.execute({
      tenantId: ownStore.tenantId,
      batchId: batch.id,
      sourceStoreId: ownStore.id,
      destinationStoreId: ownStore.id,
      connectionId: null,
      operation: SyncBatchOperation.CATALOG_REFRESH,
      productId: product.id,
    });

    expect(shopify.getProduct).toHaveBeenCalled();
    expect(snapshot.execute).toHaveBeenCalled();
    expect(shopify.upsertProduct).not.toHaveBeenCalled();
  });
});
