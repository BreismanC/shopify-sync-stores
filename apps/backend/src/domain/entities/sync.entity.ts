import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import {
  SyncBatchOperation,
  SyncBatchStatus,
  SyncEventStatus,
} from '../enums/sync-status.enum';

@Entity('synced_products')
@Unique('UQ_synced_product_connection_source', [
  'connectionId',
  'sourceProductId',
])
export class SyncedProduct {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() connectionId: string;
  @Column() sourceStoreId: string;
  @Column() sourceProductId: string;
  @Column() vendorStoreId: string;
  @Column() vendorProductId: string;
  @Column() sourceShopifyProductId: string;
  @Column() vendorShopifyProductId: string;
  @Column({ default: 'PENDING' }) status: string;
  @Column({ default: true }) syncEnabled: boolean;
  @Column({ type: 'varchar', nullable: true }) lastSourceVersion: string | null;
  @Column({ type: 'timestamptz', nullable: true }) lastSyncedAt: Date | null;
  @Column({ type: 'text', nullable: true }) lastError: string | null;
  @Column({ type: 'integer', nullable: true }) lastDurationMs: number | null;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('initial_sync_jobs')
@Index('IDX_initial_sync_store_created', ['storeId', 'createdAt'])
export class InitialSyncJob {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() storeId: string;
  @Column({
    type: 'enum',
    enum: SyncBatchStatus,
    enumName: 'sync_batches_status_enum',
    default: SyncBatchStatus.PENDING,
  })
  status: SyncBatchStatus;
  @Column({ type: 'integer', default: 0 }) totalProducts: number;
  @Column({ type: 'integer', default: 0 }) processedProducts: number;
  @Column({ type: 'integer', default: 0 }) succeededProducts: number;
  @Column({ type: 'integer', default: 0 }) failedProducts: number;
  @Column({ type: 'text', nullable: true }) lastError: string | null;
  @Column({ type: 'timestamptz', nullable: true }) startedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('inventory_snapshots')
@Unique('UQ_inventory_snapshot_store_item', ['storeId', 'inventoryItemId'])
@Index('IDX_inventory_snapshot_variant', ['variantId'])
export class InventorySnapshot {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() storeId: string;
  @Column() variantId: string;
  @Column() inventoryItemId: string;
  @Column({ type: 'integer', default: 0 }) availableQuantity: number;
  @Column({ type: 'timestamptz', nullable: true }) shopifyUpdatedAt:
    | Date
    | null;
  @Column({ type: 'text', nullable: true }) lastError: string | null;
  @Column({ type: 'integer', nullable: true }) lastDurationMs: number | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('variant_syncs')
@Unique('UQ_variant_sync_connection_source', ['connectionId', 'sourceVariantId'])
@Index('IDX_variant_sync_source_variant', ['sourceVariantId'])
@Index('IDX_variant_sync_vendor_variant', ['vendorVariantId'])
@Index('IDX_variant_sync_connection_source', [
  'connectionId',
  'sourceVariantId',
])
export class VariantSync {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() productSyncId: string;
  @Column() connectionId: string;
  @Column() sourceStoreId: string;
  @Column() vendorStoreId: string;
  @Column() sourceVariantId: string;
  @Column() vendorVariantId: string;
  @Column({ type: 'varchar', nullable: true }) sourceInventoryItemId:
    | string
    | null;
  @Column({ type: 'varchar', nullable: true }) vendorInventoryItemId:
    | string
    | null;
  @Column({ default: 'PENDING' }) status: string;
  @Column({ default: true }) syncEnabled: boolean;
  @Column({ type: 'timestamptz', nullable: true }) lastSyncedAt: Date | null;
  @Column({ type: 'text', nullable: true }) lastError: string | null;
  @Column({ type: 'integer', nullable: true }) lastDurationMs: number | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('sync_settings')
@Unique('UQ_sync_settings_tenant_connection', ['tenantId', 'connectionId'])
export class SyncSettings {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column({ type: 'uuid', nullable: true }) connectionId: string | null;
  @Column({ type: 'integer', default: 1 }) version: number;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) productRules: Record<
    string,
    unknown
  >;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) orderRules: Record<
    string,
    unknown
  >;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  inventoryRules: Record<string, unknown>;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('sync_batches')
@Index('IDX_sync_batch_tenant_created', ['tenantId', 'createdAt'])
export class SyncBatch {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column({ type: 'uuid', nullable: true }) connectionId: string | null;
  @Column() sourceStoreId: string;
  @Column() destinationStoreId: string;
  @Column({ type: 'enum', enum: SyncBatchOperation })
  operation: SyncBatchOperation;
  @Column() requestedByUserId: string;
  @Column({
    type: 'enum',
    enum: SyncBatchStatus,
    default: SyncBatchStatus.PENDING,
  })
  status: SyncBatchStatus;
  @Column({ type: 'integer', default: 0 }) total: number;
  @Column({ type: 'integer', default: 0 }) processed: number;
  @Column({ type: 'integer', default: 0 }) succeeded: number;
  @Column({ type: 'integer', default: 0 }) failed: number;
  @Column({ type: 'integer', default: 0 }) skipped: number;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) summary: Record<
    string,
    unknown
  >;
  @Column({ type: 'timestamptz', nullable: true }) startedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) finishedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('sync_events')
@Unique('UQ_sync_event_idempotency', ['idempotencyKey'])
@Index('IDX_sync_event_tenant_created', ['tenantId', 'createdAt'])
export class SyncEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column({ type: 'uuid', nullable: true }) batchId: string | null;
  @Column({ type: 'uuid', nullable: true }) connectionId: string | null;
  @Column() type: string;
  @Column() idempotencyKey: string;
  @Column({
    type: 'enum',
    enum: SyncEventStatus,
    default: SyncEventStatus.PENDING,
  })
  status: SyncEventStatus;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @Column({ type: 'integer', default: 0 }) attempts: number;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('inventory_location_mappings')
@Unique('UQ_inventory_mapping_connection_locations', [
  'connectionId',
  'sourceLocationId',
  'vendorLocationId',
])
export class InventoryLocationMapping {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() connectionId: string;
  @Column() sourceLocationId: string;
  @Column() vendorLocationId: string;
  @Column({ default: true }) isActive: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('reconciliation_checkpoints')
@Unique('UQ_reconciliation_store_module', ['storeId', 'module'])
export class ReconciliationCheckpoint {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() storeId: string;
  @Column() module: string;
  @Column({ type: 'varchar', nullable: true }) cursor: string | null;
  @Column({ type: 'timestamptz', nullable: true })
  processedThrough: Date | null;
  @UpdateDateColumn() updatedAt: Date;
}
