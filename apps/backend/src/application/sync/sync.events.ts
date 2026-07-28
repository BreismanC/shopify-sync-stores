export type ProductSyncOrigin =
  | 'initial_sync'
  | 'webhook'
  | 'manual_sync'
  | 'retry';

export interface ProductSyncRequested {
  tenantId: string;
  storeId: string;
  shopifyProductId: string;
  origin: ProductSyncOrigin;
  timestamp: string;
  deduplicationKey: string;
  batchId?: string | null;
  initialSyncJobId?: string | null;
  connectionId?: string | null;
  destinationStoreId?: string | null;
  requestedByUserId?: string | null;
  deleted?: boolean;
}

export interface ProductUpdated {
  tenantId: string;
  storeId: string;
  productId: string;
  shopifyProductId: string;
  shopifyUpdatedAt: string | null;
  origin: ProductSyncOrigin;
  timestamp: string;
  batchId?: string | null;
  connectionId?: string | null;
  destinationStoreId?: string | null;
  requestedByUserId?: string | null;
  deleted?: boolean;
}

export interface ProductDeleted extends ProductUpdated {
  deleted: true;
}

export interface VendorProductSyncRequested {
  tenantId: string;
  connectionId: string;
  sourceStoreId: string;
  sourceProductId: string;
  sourceShopifyProductId: string;
  vendorStoreId: string;
  vendorProductId?: string | null;
  sourceVersion?: string | null;
  origin: ProductSyncOrigin;
  timestamp: string;
  batchId?: string | null;
  requestedByUserId?: string | null;
  deleted?: boolean;
}

export interface InitialSyncScanRequested {
  tenantId: string;
  sourceTenantId?: string;
  storeId: string;
  initialSyncJobId?: string | null;
  batchId?: string | null;
  connectionId?: string | null;
  destinationStoreId?: string | null;
  requestedByUserId?: string | null;
  origin: 'initial_sync' | 'manual_sync';
}

export type InventorySyncOrigin = 'webhook' | 'manual' | 'retry' | 'order';

export interface InventorySyncRequested {
  tenantId: string;
  storeId: string;
  inventoryItemId: string;
  variantId?: string | null;
  origin: InventorySyncOrigin;
  timestamp: string;
  deduplicationKey: string;
  deliveryId?: string | null;
  eventId?: string | null;
}

export interface InventoryUpdated {
  tenantId: string;
  storeId: string;
  variantId: string;
  inventoryItemId: string;
  previousQuantity: number | null;
  availableQuantity: number;
  origin: InventorySyncOrigin;
  timestamp: string;
  eventId?: string | null;
}

export interface VendorInventorySyncRequested {
  tenantId: string;
  connectionId: string;
  sourceStoreId: string;
  vendorStoreId: string;
  sourceVariantId: string;
  vendorVariantId: string;
  sourceInventoryItemId: string;
  vendorInventoryItemId: string;
  availableQuantity: number;
  origin: InventorySyncOrigin;
  timestamp: string;
  eventId?: string | null;
}

export interface DeadLetterPayload {
  queue: string;
  jobName: string;
  jobId: string | null;
  attemptsMade: number;
  payload: Record<string, unknown>;
  error: string;
  failedAt: string;
}
