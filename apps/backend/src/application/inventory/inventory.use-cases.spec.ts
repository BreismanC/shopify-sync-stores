import {
  DispatchVendorInventorySyncUseCase,
  ProcessInventorySyncRequestedUseCase,
  ProcessVendorInventorySyncUseCase,
} from './inventory.use-cases';

describe('Inventory synchronization pipeline', () => {
  it('consulta Shopify, suma ubicaciones y publica InventoryUpdated', async () => {
    const inventory = {
      findSnapshotByInventoryItem: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        availableQuantity: 8,
      }),
      saveSnapshot: jest.fn(async (snapshot) => snapshot),
    };
    const queues = { publish: jest.fn().mockResolvedValue('job-id') };
    const sync = {
      findEventByKey: jest.fn().mockResolvedValue(null),
      createEvent: jest.fn((value) => ({ ...value })),
      saveEvent: jest.fn(async (event) => event),
    };
    const useCase = new ProcessInventorySyncRequestedUseCase(
      {
        findById: jest.fn().mockResolvedValue({
          id: 'source-store',
          tenantId: 'tenant-1',
          shopifyShopId: 'source.myshopify.com',
          accessToken: 'token',
        }),
      } as never,
      {
        findVariantByInventoryItem: jest.fn().mockResolvedValue({
          id: 'variant-1',
          shopifyInventoryItemId: 'gid://shopify/InventoryItem/1',
        }),
      } as never,
      sync as never,
      inventory as never,
      {
        getInventoryLevels: jest.fn().mockResolvedValue([
          { availableQuantity: 5, updatedAt: '2026-07-27T10:00:00.000Z' },
          { availableQuantity: 7, updatedAt: '2026-07-27T11:00:00.000Z' },
        ]),
      } as never,
      queues as never,
      {
        acquire: jest.fn().mockResolvedValue('token'),
        release: jest.fn().mockResolvedValue(undefined),
      } as never,
      { publishToTenant: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        storeId: 'source-store',
        inventoryItemId: 'gid://shopify/InventoryItem/1',
        origin: 'webhook',
        timestamp: '2026-07-27T11:00:00.000Z',
        deduplicationKey: 'inventory-sync:source-store:gid://shopify/InventoryItem/1',
        eventId: 'evt-1',
      }),
    ).resolves.toEqual({ availableQuantity: 12, dispatched: true });

    expect(inventory.saveSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        availableQuantity: 12,
        variantId: 'variant-1',
      }),
    );
    expect(queues.publish).toHaveBeenCalledWith(
      'vendor-inventory-sync',
      'inventory-updated',
      expect.objectContaining({
        variantId: 'variant-1',
        previousQuantity: 8,
        availableQuantity: 12,
      }),
      expect.any(Object),
    );
  });

  it('no publica InventoryUpdated cuando la cantidad no cambia', async () => {
    const queues = { publish: jest.fn() };
    const useCase = new ProcessInventorySyncRequestedUseCase(
      {
        findById: jest.fn().mockResolvedValue({
          id: 'source-store',
          tenantId: 'tenant-1',
          shopifyShopId: 'source.myshopify.com',
          accessToken: 'token',
        }),
      } as never,
      {
        findVariantByInventoryItem: jest.fn().mockResolvedValue({
          id: 'variant-1',
          shopifyInventoryItemId: 'gid://shopify/InventoryItem/1',
        }),
      } as never,
      {
        findEventByKey: jest.fn().mockResolvedValue(null),
        createEvent: jest.fn((value) => ({ ...value })),
        saveEvent: jest.fn(async (event) => event),
      } as never,
      {
        findSnapshotByInventoryItem: jest.fn().mockResolvedValue({
          id: 'snapshot-1',
          availableQuantity: 12,
        }),
        saveSnapshot: jest.fn(async (snapshot) => snapshot),
      } as never,
      {
        getInventoryLevels: jest.fn().mockResolvedValue([
          { availableQuantity: 5, updatedAt: null },
          { availableQuantity: 7, updatedAt: null },
        ]),
      } as never,
      queues as never,
      {
        acquire: jest.fn().mockResolvedValue('token'),
        release: jest.fn().mockResolvedValue(undefined),
      } as never,
      { publishToTenant: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        storeId: 'source-store',
        inventoryItemId: 'gid://shopify/InventoryItem/1',
        origin: 'webhook',
        timestamp: '2026-07-27T11:00:00.000Z',
        deduplicationKey: 'inventory-sync:source-store:gid://shopify/InventoryItem/1',
      }),
    ).resolves.toEqual({ availableQuantity: 12, dispatched: false });

    expect(queues.publish).not.toHaveBeenCalled();
  });

  it('despacha un evento vendor por cada VariantSync activo', async () => {
    const queues = { publish: jest.fn().mockResolvedValue('job-id') };
    const useCase = new DispatchVendorInventorySyncUseCase(
      {
        findActiveVariantSyncsBySourceVariant: jest.fn().mockResolvedValue([
          {
            id: 'variant-sync-1',
            tenantId: 'vendor-tenant-1',
            connectionId: 'connection-1',
            sourceStoreId: 'source-store',
            vendorStoreId: 'vendor-store-1',
            sourceVariantId: 'source-variant',
            vendorVariantId: 'vendor-variant-1',
            sourceInventoryItemId: 'source-item',
            vendorInventoryItemId: 'vendor-item-1',
          },
          {
            id: 'variant-sync-2',
            tenantId: 'vendor-tenant-2',
            connectionId: 'connection-2',
            sourceStoreId: 'source-store',
            vendorStoreId: 'vendor-store-2',
            sourceVariantId: 'source-variant',
            vendorVariantId: 'vendor-variant-2',
            sourceInventoryItemId: 'source-item',
            vendorInventoryItemId: 'vendor-item-2',
          },
        ]),
      } as never,
      {
        findEventByKey: jest.fn().mockResolvedValue(null),
        createEvent: jest.fn((value) => ({ ...value })),
        saveEvent: jest.fn(async (event) => event),
      } as never,
      queues as never,
    );

    await expect(
      useCase.execute({
        tenantId: 'source-tenant',
        storeId: 'source-store',
        variantId: 'source-variant',
        inventoryItemId: 'source-item',
        previousQuantity: 10,
        availableQuantity: 9,
        origin: 'webhook',
        timestamp: '2026-07-27T11:00:00.000Z',
      }),
    ).resolves.toEqual({ dispatched: 2 });

    expect(queues.publish).toHaveBeenCalledTimes(2);
    expect(queues.publish).toHaveBeenCalledWith(
      'vendor-inventory-sync',
      'vendor-inventory-sync-requested',
      expect.objectContaining({
        connectionId: 'connection-2',
        vendorInventoryItemId: 'vendor-item-2',
        availableQuantity: 9,
      }),
      expect.any(Object),
    );
  });

  it('actualiza solo una variante vendor', async () => {
    const variantSync = {
      id: 'variant-sync-1',
      syncEnabled: true,
      status: 'PENDING',
    };
    const inventory = {
      findVariantSync: jest.fn().mockResolvedValue(variantSync),
      saveVariantSync: jest.fn(async (value) => value),
    };
    const useCase = new ProcessVendorInventorySyncUseCase(
      {
        findById: jest.fn().mockResolvedValue({
          id: 'vendor-store',
          shopifyShopId: 'vendor.myshopify.com',
          accessToken: 'token',
        }),
      } as never,
      inventory as never,
      {
        getDefaultInventoryLocationId: jest
          .fn()
          .mockResolvedValue('vendor-location'),
        setInventory: jest.fn().mockResolvedValue(undefined),
      } as never,
      {
        acquire: jest.fn().mockResolvedValue('token'),
        release: jest.fn().mockResolvedValue(undefined),
      } as never,
    );

    await expect(
      useCase.execute({
        tenantId: 'vendor-tenant',
        connectionId: 'connection-1',
        sourceStoreId: 'source-store',
        vendorStoreId: 'vendor-store',
        sourceVariantId: 'source-variant',
        vendorVariantId: 'vendor-variant',
        sourceInventoryItemId: 'source-item',
        vendorInventoryItemId: 'vendor-item',
        availableQuantity: 4,
        origin: 'webhook',
        timestamp: '2026-07-27T11:00:00.000Z',
      }),
    ).resolves.toEqual({ synced: true });

    expect(inventory.saveVariantSync).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SYNCED', lastError: null }),
    );
  });
});
