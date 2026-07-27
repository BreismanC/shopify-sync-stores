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

  it('queues a full Shopify reconciliation for an empty own catalog', async () => {
    const access = {
      resolve: jest.fn().mockResolvedValue({
        source: ownStore,
        destination: ownStore,
        connectionId: null,
        kind: 'OWN',
      }),
    };
    const queues = { publish: jest.fn().mockResolvedValue('refresh-job') };
    const useCase = new QueueStoreReconciliationUseCase(
      access as never,
      queues as never,
    );

    const result = await useCase.execute(
      ownStore.tenantId,
      ownStore.id,
      UserRole.OWNER,
    );

    expect(result).toEqual({ jobId: 'refresh-job', status: 'QUEUED' });
    expect(queues.publish).toHaveBeenCalledWith(
      'reconciliation',
      'reconcile-products',
      expect.objectContaining({
        tenantId: ownStore.tenantId,
        notifyTenantId: ownStore.tenantId,
        storeId: ownStore.id,
      }),
      expect.objectContaining({ attempts: 3 }),
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
      findByIdsForStore: jest
        .fn()
        .mockResolvedValue([{ id: 'product-1' }, { id: 'product-2' }]),
    };
    const batch = {
      id: 'batch-1',
      status: SyncBatchStatus.PENDING,
      startedAt: null,
    };
    const sync = {
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
      'sync-product',
      expect.objectContaining({
        sourceStoreId: ownStore.id,
        destinationStoreId: ownStore.id,
        operation: SyncBatchOperation.CATALOG_REFRESH,
      }),
      expect.any(Object),
    );
  });

  it('synchronizes every stored product when no product is selected', async () => {
    const access = {
      resolve: jest.fn().mockResolvedValue({
        source: ownStore,
        destination: ownStore,
        connectionId: null,
        kind: 'OWN',
      }),
    };
    const products = {
      findAllByStore: jest
        .fn()
        .mockResolvedValue([{ id: 'product-1' }, { id: 'product-2' }]),
      findByIdsForStore: jest.fn(),
    };
    const batch = {
      id: 'batch-all',
      status: SyncBatchStatus.PENDING,
      startedAt: null,
    };
    const sync = {
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

    expect(products.findAllByStore).toHaveBeenCalledWith(ownStore.id);
    expect(products.findByIdsForStore).not.toHaveBeenCalled();
    expect(result.total).toBe(2);
    expect(queues.publish).toHaveBeenCalledTimes(2);
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
