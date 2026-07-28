import {
  DispatchVendorProductSyncUseCase,
  ProcessProductRequestedUseCase,
  ProcessVendorProductSyncUseCase,
  ScanProductsForSyncUseCase,
} from './product-sync-pipeline.use-cases';

describe('Product synchronization pipeline', () => {
  it('pages Shopify and publishes one product event per product', async () => {
    const stores = {
      findById: jest.fn().mockResolvedValue({
        id: 'source-store',
        tenantId: 'source-tenant',
        shopifyShopId: 'source.myshopify.com',
        accessToken: 'token',
      }),
    };
    const sync = {
      setBatchTotalAndRunning: jest.fn().mockResolvedValue({
        id: 'batch-1',
        status: 'RUNNING',
        total: 2,
      }),
    };
    const shopify = {
      countProducts: jest.fn().mockResolvedValue(2),
      listProducts: jest
        .fn()
        .mockResolvedValueOnce({
          items: [{ id: 'gid://shopify/Product/1' }],
          cursor: 'cursor-1',
          hasNextPage: true,
        })
        .mockResolvedValueOnce({
          items: [{ id: 'gid://shopify/Product/2' }],
          cursor: null,
          hasNextPage: false,
        }),
    };
    const queues = { publish: jest.fn().mockResolvedValue('job-id') };
    const realtime = {
      publishToTenant: jest.fn().mockResolvedValue(undefined),
    };
    const useCase = new ScanProductsForSyncUseCase(
      stores as never,
      sync as never,
      shopify as never,
      queues as never,
      realtime as never,
      {} as never,
    );

    const result = await useCase.execute({
      tenantId: 'vendor-tenant',
      sourceTenantId: 'source-tenant',
      storeId: 'source-store',
      batchId: 'batch-1',
      connectionId: 'connection-1',
      destinationStoreId: 'vendor-store',
      origin: 'manual_sync',
    });

    expect(result).toEqual({ queued: 2, total: 2 });
    expect(queues.publish).toHaveBeenCalledTimes(2);
    expect(queues.publish).toHaveBeenNthCalledWith(
      1,
      'product-sync',
      'product-sync-requested',
      expect.objectContaining({
        tenantId: 'vendor-tenant',
        storeId: 'source-store',
        shopifyProductId: 'gid://shopify/Product/1',
      }),
      expect.objectContaining({
        jobId: expect.stringContaining('batch-1-source-store'),
      }),
    );
  });

  it('ignores an older webhook without overwriting or dispatching it', async () => {
    const snapshot = {
      id: 'product-1',
      shopifyUpdatedAt: new Date('2026-07-27T10:00:00.000Z'),
    };
    const stores = {
      findById: jest.fn().mockResolvedValue({
        id: 'source-store',
        tenantId: 'source-tenant',
        shopifyShopId: 'source.myshopify.com',
        accessToken: 'token',
      }),
    };
    const products = {
      findByShopifyId: jest.fn().mockResolvedValue(snapshot),
      save: jest.fn(),
    };
    const shopify = {
      getProduct: jest.fn().mockResolvedValue({
        id: 'gid://shopify/Product/1',
        updatedAt: '2026-07-27T09:00:00.000Z',
      }),
    };
    const queues = { publish: jest.fn() };
    const useCase = new ProcessProductRequestedUseCase(
      stores as never,
      products as never,
      {} as never,
      shopify as never,
      queues as never,
      {} as never,
      {} as never,
      {
        acquire: jest.fn().mockResolvedValue('lock-token'),
        release: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    const result = await useCase.execute({
      tenantId: 'source-tenant',
      storeId: 'source-store',
      shopifyProductId: 'gid://shopify/Product/1',
      origin: 'webhook',
      timestamp: new Date().toISOString(),
      deduplicationKey: 'product-sync:source-store:gid://shopify/Product/1',
    });

    expect(result).toEqual({
      productId: 'product-1',
      skipped: 'STALE_OR_DUPLICATE_VERSION',
    });
    expect(products.save).not.toHaveBeenCalled();
    expect(queues.publish).not.toHaveBeenCalled();
  });

  it('encola la lectura de inventario para cada variante después de guardar el producto', async () => {
    const stores = {
      findById: jest.fn().mockResolvedValue({
        id: 'source-store',
        tenantId: 'source-tenant',
        shopifyShopId: 'source.myshopify.com',
        accessToken: 'token',
      }),
    };
    const products = {
      findByShopifyId: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => ({ id: 'product-1', ...input })),
      save: jest.fn(async (product) => product),
    };
    const queues = { publish: jest.fn().mockResolvedValue('job-id') };
    const useCase = new ProcessProductRequestedUseCase(
      stores as never,
      products as never,
      {} as never,
      {
        getProduct: jest.fn().mockResolvedValue({
          id: 'gid://shopify/Product/1',
          title: 'Producto con inventario',
          updatedAt: '2026-07-28T10:00:00.000Z',
          variants: {
            nodes: [
              {
                id: 'gid://shopify/ProductVariant/1',
                inventoryItem: {
                  id: 'gid://shopify/InventoryItem/1',
                },
              },
              {
                id: 'gid://shopify/ProductVariant/2',
                inventoryItem: {
                  id: 'gid://shopify/InventoryItem/2',
                },
              },
            ],
          },
        }),
      } as never,
      queues as never,
      {} as never,
      {} as never,
      {
        acquire: jest.fn().mockResolvedValue('lock-token'),
        release: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    await useCase.execute({
      tenantId: 'source-tenant',
      storeId: 'source-store',
      shopifyProductId: 'gid://shopify/Product/1',
      origin: 'manual_sync',
      timestamp: new Date().toISOString(),
      deduplicationKey: 'product-sync:source-store:product-1',
    });

    expect(queues.publish).toHaveBeenCalledWith(
      'inventory-sync',
      'inventory-sync-requested',
      expect.objectContaining({
        storeId: 'source-store',
        inventoryItemId: 'gid://shopify/InventoryItem/1',
      }),
      expect.any(Object),
    );
    expect(queues.publish).toHaveBeenCalledWith(
      'inventory-sync',
      'inventory-sync-requested',
      expect.objectContaining({
        storeId: 'source-store',
        inventoryItemId: 'gid://shopify/InventoryItem/2',
      }),
      expect.any(Object),
    );
  });

  it('retries instead of processing the same source product concurrently', async () => {
    const shopify = { getProduct: jest.fn() };
    const useCase = new ProcessProductRequestedUseCase(
      {} as never,
      {} as never,
      {} as never,
      shopify as never,
      {} as never,
      {} as never,
      {} as never,
      {
        acquire: jest.fn().mockResolvedValue(null),
        release: jest.fn(),
      } as never,
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        storeId: 'store-1',
        shopifyProductId: 'gid://shopify/Product/1',
        origin: 'webhook',
        timestamp: new Date().toISOString(),
        deduplicationKey: 'product-sync:store-1:gid://shopify/Product/1',
      }),
    ).rejects.toMatchObject({ name: 'DistributedLockUnavailableError' });
    expect(shopify.getProduct).not.toHaveBeenCalled();
  });

  it('dispatches an independent vendor job for every active mapping', async () => {
    const mappings = [
      {
        tenantId: 'vendor-tenant-1',
        connectionId: 'connection-1',
        sourceStoreId: 'source-store',
        sourceProductId: 'product-1',
        sourceShopifyProductId: 'gid://shopify/Product/1',
        vendorStoreId: 'vendor-store-1',
        vendorShopifyProductId: 'vendor-product-1',
      },
      {
        tenantId: 'vendor-tenant-2',
        connectionId: 'connection-2',
        sourceStoreId: 'source-store',
        sourceProductId: 'product-1',
        sourceShopifyProductId: 'gid://shopify/Product/1',
        vendorStoreId: 'vendor-store-2',
        vendorShopifyProductId: 'vendor-product-2',
      },
    ];
    const sync = {
      findActiveSyncedProducts: jest.fn().mockResolvedValue(mappings),
    };
    const queues = { publish: jest.fn().mockResolvedValue('job-id') };
    const useCase = new DispatchVendorProductSyncUseCase(
      sync as never,
      {} as never,
      queues as never,
      {} as never,
      {} as never,
    );

    const result = await useCase.execute({
      tenantId: 'source-tenant',
      storeId: 'source-store',
      productId: 'product-1',
      shopifyProductId: 'gid://shopify/Product/1',
      shopifyUpdatedAt: '2026-07-27T10:00:00.000Z',
      origin: 'webhook',
      timestamp: new Date().toISOString(),
    });

    expect(result).toEqual({ dispatched: 2 });
    expect(queues.publish).toHaveBeenCalledTimes(2);
    expect(queues.publish).toHaveBeenCalledWith(
      'vendor-sync',
      'vendor-product-sync-requested',
      expect.objectContaining({ vendorStoreId: 'vendor-store-2' }),
      expect.objectContaining({
        jobId: expect.stringContaining('connection-2-product-1'),
      }),
    );
  });

  it('persiste VariantSync despuÃ©s de sincronizar un producto vendor', async () => {
    const variantSync = { id: 'variant-sync-1' };
    const inventory = {
      findVariantSync: jest.fn().mockResolvedValue(null),
      createVariantSync: jest.fn((value) => ({ ...variantSync, ...value })),
      saveVariantSync: jest.fn(async (value) => value),
    };
    const sync = {
      getSettings: jest.fn().mockResolvedValue(null),
      findSyncedProduct: jest.fn().mockResolvedValue(null),
      createSyncedProduct: jest.fn((value) => ({ id: 'mapping-1', ...value })),
      saveSyncedProduct: jest.fn(async (value) => value),
    };
    const product = {
      id: 'source-product',
      shopifyProductId: 'gid://shopify/Product/1',
      title: 'Brown Cat',
      description: null,
      vendor: null,
      productType: null,
      tags: [],
      images: [],
      shopifyUpdatedAt: new Date('2026-07-27T11:00:00.000Z'),
      variants: [
        {
          id: 'source-variant-1',
          title: 'Default Title',
          sku: 'CAT-1',
          barcode: null,
          price: '10.00',
          shopifyInventoryItemId: 'source-inventory-item',
        },
      ],
    };
    const useCase = new ProcessVendorProductSyncUseCase(
      {
        findByIdForStore: jest.fn().mockResolvedValue(product),
      } as never,
      sync as never,
      {
        findById: jest.fn().mockResolvedValue({
          id: 'connection-1',
          isActive: true,
          sourceStoreId: 'source-store',
          vendorStoreId: 'vendor-store',
        }),
      } as never,
      {
        findById: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'source-store',
            shopifyShopId: 'source.myshopify.com',
            accessToken: 'source-token',
          })
          .mockResolvedValueOnce({
            id: 'vendor-store',
            shopifyShopId: 'vendor.myshopify.com',
            accessToken: 'vendor-token',
          }),
      } as never,
      inventory as never,
      {
        upsertProduct: jest
          .fn()
          .mockResolvedValue({ id: 'gid://shopify/Product/99' }),
        getProduct: jest.fn().mockResolvedValue({
          id: 'gid://shopify/Product/99',
          variants: {
            nodes: [
              {
                id: 'vendor-variant-1',
                title: 'Default Title',
                sku: 'CAT-1',
                inventoryItem: { id: 'vendor-inventory-item' },
              },
            ],
          },
        }),
      } as never,
      {
        publishToTenant: jest.fn(),
      } as never,
      {} as never,
      {
        acquire: jest.fn().mockResolvedValue('lock-token'),
        release: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    await expect(
      useCase.execute({
        tenantId: 'vendor-tenant',
        connectionId: 'connection-1',
        sourceStoreId: 'source-store',
        sourceProductId: 'source-product',
        sourceShopifyProductId: 'gid://shopify/Product/1',
        vendorStoreId: 'vendor-store',
        origin: 'manual_sync',
        timestamp: new Date().toISOString(),
      }),
    ).resolves.toEqual({ remoteId: 'gid://shopify/Product/99' });

    expect(inventory.saveVariantSync).toHaveBeenCalledWith(
      expect.objectContaining({
        productSyncId: 'mapping-1',
        sourceVariantId: 'source-variant-1',
        vendorVariantId: 'vendor-variant-1',
        sourceInventoryItemId: 'source-inventory-item',
        vendorInventoryItemId: 'vendor-inventory-item',
        status: 'SYNCED',
      }),
    );
  });
});
