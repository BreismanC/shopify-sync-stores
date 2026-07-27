import { ProductSnapshot } from '../../../domain/entities/product-snapshot.entity';
import {
  SyncBatch,
  SyncEvent,
  SyncSettings,
  SyncedProduct,
} from '../../../domain/entities/sync.entity';

export interface ProductListQuery {
  search?: string;
  page: number;
  perPage: number;
  sortBy: 'title' | 'createdAt';
  order: 'asc' | 'desc';
}

export abstract class IProductRepository {
  abstract listByStore(
    storeId: string,
    query: ProductListQuery,
  ): Promise<{ data: ProductSnapshot[]; total: number }>;
  abstract countByStore(storeId: string): Promise<number>;
  abstract findAllByStore(storeId: string): Promise<ProductSnapshot[]>;
  abstract findByIdsForStore(
    storeId: string,
    ids: string[],
  ): Promise<ProductSnapshot[]>;
  abstract findByIdForStore(
    storeId: string,
    id: string,
  ): Promise<ProductSnapshot | null>;
  abstract findById(
    tenantId: string,
    id: string,
  ): Promise<ProductSnapshot | null>;
  abstract findByShopifyId(
    storeId: string,
    shopifyProductId: string,
  ): Promise<ProductSnapshot | null>;
  abstract save(product: ProductSnapshot): Promise<ProductSnapshot>;
  abstract create(input: Partial<ProductSnapshot>): ProductSnapshot;
  abstract findVariantByInventoryItem(
    storeId: string,
    inventoryItemId: string,
  ): Promise<
    | import('../../../domain/entities/product-snapshot.entity').ProductVariantSnapshot
    | null
  >;
  abstract findVariantBySku(
    storeId: string,
    sku: string,
  ): Promise<
    | import('../../../domain/entities/product-snapshot.entity').ProductVariantSnapshot
    | null
  >;
}

export abstract class ISyncRepository {
  abstract getSettings(
    tenantId: string,
    connectionId: string | null,
  ): Promise<SyncSettings | null>;
  abstract saveSettings(settings: SyncSettings): Promise<SyncSettings>;
  abstract createSettings(input: Partial<SyncSettings>): SyncSettings;
  abstract createBatch(input: Partial<SyncBatch>): SyncBatch;
  abstract saveBatch(batch: SyncBatch): Promise<SyncBatch>;
  abstract recordBatchResult(
    batchId: string,
    result: 'succeeded' | 'failed' | 'skipped',
  ): Promise<SyncBatch | null>;
  abstract findBatch(tenantId: string, id: string): Promise<SyncBatch | null>;
  abstract findActiveBatch(
    tenantId: string,
    sourceStoreId: string,
  ): Promise<SyncBatch | null>;
  abstract createEvent(input: Partial<SyncEvent>): SyncEvent;
  abstract saveEvent(event: SyncEvent): Promise<SyncEvent>;
  abstract findEventByKey(key: string): Promise<SyncEvent | null>;
  abstract findSyncedProduct(
    connectionId: string,
    sourceProductId: string,
  ): Promise<SyncedProduct | null>;
  abstract findSyncedProductByVendorId(
    connectionId: string,
    vendorShopifyProductId: string,
  ): Promise<SyncedProduct | null>;
  abstract createSyncedProduct(input: Partial<SyncedProduct>): SyncedProduct;
  abstract saveSyncedProduct(product: SyncedProduct): Promise<SyncedProduct>;
}
