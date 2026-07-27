import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import {
  PayoutStatus,
  SyncBatchOperation,
  SyncBatchStatus,
  SyncEventStatus,
} from "../enums/sync-status.enum";

abstract class TimedEntity {
  @PrimaryGeneratedColumn("uuid") id: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity("product_snapshots")
export class ProductSnapshot extends TimedEntity {
  @Column() tenantId: string;
  @Column() storeId: string;
  @Column() shopifyProductId: string;
  @Column() title: string;
  @Column({ type: "text", nullable: true }) description: string | null;
  @Column({ nullable: true }) vendor: string | null;
  @Column({ nullable: true }) productType: string | null;
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" }) tags: string[];
  @Column({ default: "draft" }) status: string;
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" }) images: unknown[];
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
  @Column({ type: "timestamptz", nullable: true })
  shopifyCreatedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true })
  shopifyUpdatedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) deletedAt: Date | null;
}

@Entity("product_variant_snapshots")
export class ProductVariantSnapshot extends TimedEntity {
  @Column() tenantId: string;
  @Column() storeId: string;
  @Column() productId: string;
  @Column() shopifyVariantId: string;
  @Column({ nullable: true }) shopifyInventoryItemId: string | null;
  @Column({ nullable: true }) title: string | null;
  @Column({ nullable: true }) sku: string | null;
  @Column({ nullable: true }) barcode: string | null;
  @Column({ type: "numeric", precision: 18, scale: 4, default: 0 })
  price: string;
  @Column({ type: "integer", default: 0 }) inventoryQuantity: number;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
}

@Entity("synced_products")
export class SyncedProduct extends TimedEntity {
  @Column() tenantId: string;
  @Column() connectionId: string;
  @Column() sourceProductId: string;
  @Column() vendorProductId: string;
  @Column() sourceShopifyProductId: string;
  @Column() vendorShopifyProductId: string;
  @Column({ type: "varchar", nullable: true }) lastSourceVersion: string | null;
  @Column({ type: "timestamptz", nullable: true }) lastSyncedAt: Date | null;
  @Column({ default: true }) isActive: boolean;
}

@Entity("sync_settings")
export class SyncSettings extends TimedEntity {
  @Column() tenantId: string;
  @Column({ nullable: true }) connectionId: string | null;
  @Column({ default: 1 }) version: number;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) productRules: Record<
    string,
    unknown
  >;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) orderRules: Record<
    string,
    unknown
  >;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  inventoryRules: Record<string, unknown>;
}

@Entity("sync_batches")
export class SyncBatch extends TimedEntity {
  @Column() tenantId: string;
  @Column({ type: "uuid", nullable: true }) connectionId: string | null;
  @Column() sourceStoreId: string;
  @Column() destinationStoreId: string;
  @Column({ type: "enum", enum: SyncBatchOperation })
  operation: SyncBatchOperation;
  @Column() requestedByUserId: string;
  @Column({
    type: "enum",
    enum: SyncBatchStatus,
    default: SyncBatchStatus.PENDING,
  })
  status: SyncBatchStatus;
  @Column({ default: 0 }) total: number;
  @Column({ default: 0 }) processed: number;
  @Column({ default: 0 }) succeeded: number;
  @Column({ default: 0 }) failed: number;
  @Column({ default: 0 }) skipped: number;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) summary: Record<
    string,
    unknown
  >;
  @Column({ type: "timestamptz", nullable: true }) startedAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) finishedAt: Date | null;
}

@Entity("sync_events")
export class SyncEvent extends TimedEntity {
  @Column() tenantId: string;
  @Column({ nullable: true }) batchId: string | null;
  @Column({ nullable: true }) connectionId: string | null;
  @Column() type: string;
  @Column() idempotencyKey: string;
  @Column({ type: "enum", enum: SyncEventStatus }) status: SyncEventStatus;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
  @Column({ type: "text", nullable: true }) error: string | null;
  @Column({ default: 0 }) attempts: number;
}

@Entity("inventory_location_mappings")
export class InventoryLocationMapping extends TimedEntity {
  @Column() tenantId: string;
  @Column() connectionId: string;
  @Column() sourceLocationId: string;
  @Column() vendorLocationId: string;
  @Column({ default: true }) isActive: boolean;
}

@Entity("synced_orders")
export class SyncedOrder extends TimedEntity {
  @Column() tenantId: string;
  @Column() connectionId: string;
  @Column() vendorStoreId: string;
  @Column() sourceStoreId: string;
  @Column() vendorShopifyOrderId: string;
  @Column({ nullable: true }) sourceShopifyOrderId: string | null;
  @Column() status: string;
  @Column({ nullable: true }) currency: string | null;
  @Column({ type: "numeric", precision: 18, scale: 4 }) subtotal: string;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
  @Column({ type: "text", nullable: true }) lastError: string | null;
}

@Entity("order_line_mappings")
export class OrderLineMapping {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() tenantId: string;
  @Column() syncedOrderId: string;
  @Column() vendorLineItemId: string;
  @Column() sourceVariantId: string;
  @Column({ nullable: true }) sourceLineItemId: string | null;
  @Column() quantity: number;
  @Column({ type: "numeric", precision: 18, scale: 4 }) unitPrice: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity("payouts")
export class Payout extends TimedEntity {
  @Column() tenantId: string;
  @Column() syncedOrderId: string;
  @Column() sourceTenantId: string;
  @Column() vendorTenantId: string;
  @Column({ type: "numeric", precision: 18, scale: 4 }) grossAmount: string;
  @Column({ type: "numeric", precision: 18, scale: 4 })
  commissionAmount: string;
  @Column({ type: "numeric", precision: 18, scale: 4 }) netAmount: string;
  @Column() currency: string;
  @Column({ type: "enum", enum: PayoutStatus }) status: PayoutStatus;
  @Column({ type: "timestamptz", nullable: true }) paidAt: Date | null;
}

@Entity("notifications")
export class Notification extends TimedEntity {
  @Column() tenantId: string;
  @Column({ nullable: true }) userId: string | null;
  @Column() type: string;
  @Column() title: string;
  @Column({ type: "text" }) message: string;
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
  @Column({ nullable: true }) eventId: string | null;
  @Column({ type: "timestamptz", nullable: true }) readAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) archivedAt: Date | null;
}

@Entity("webhook_deliveries")
export class WebhookDelivery extends TimedEntity {
  @Column({ nullable: true }) tenantId: string | null;
  @Column() shopDomain: string;
  @Column() topic: string;
  @Column() shopifyEventId: string;
  @Column() payloadHash: string;
  @Column() status: string;
  @Column({ type: "jsonb" }) payload: Record<string, unknown>;
  @Column({ type: "timestamptz", nullable: true }) triggeredAt: Date | null;
  @Column({ type: "timestamptz", nullable: true }) processedAt: Date | null;
  @Column({ type: "text", nullable: true }) error: string | null;
}

@Entity("reconciliation_checkpoints")
export class ReconciliationCheckpoint {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column() tenantId: string;
  @Column() storeId: string;
  @Column() module: string;
  @Column({ nullable: true }) cursor: string | null;
  @Column({ type: "timestamptz", nullable: true })
  processedThrough: Date | null;
  @UpdateDateColumn() updatedAt: Date;
}
