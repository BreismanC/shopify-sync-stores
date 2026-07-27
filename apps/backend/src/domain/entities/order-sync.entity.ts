import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PayoutStatus } from '../enums/sync-status.enum';

@Entity('synced_orders')
@Unique('UQ_synced_order_connection_vendor_source', [
  'connectionId',
  'vendorShopifyOrderId',
  'sourceStoreId',
])
@Index('IDX_synced_order_tenant_created', ['tenantId', 'createdAt'])
export class SyncedOrder {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() connectionId: string;
  @Column() vendorStoreId: string;
  @Column() sourceStoreId: string;
  @Column() vendorShopifyOrderId: string;
  @Column({ type: 'varchar', nullable: true }) sourceShopifyOrderId:
    | string
    | null;
  @Column({ default: 'PENDING' }) status: string;
  @Column({ type: 'varchar', nullable: true }) currency: string | null;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  subtotal: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
  @Column({ type: 'text', nullable: true }) lastError: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('order_line_mappings')
@Unique('UQ_order_line_mapping_vendor_line_source', [
  'syncedOrderId',
  'vendorLineItemId',
  'sourceVariantId',
])
export class OrderLineMapping {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() syncedOrderId: string;
  @Column() vendorLineItemId: string;
  @Column() sourceVariantId: string;
  @Column({ type: 'varchar', nullable: true }) sourceLineItemId: string | null;
  @Column({ type: 'integer' }) quantity: number;
  @Column({ type: 'numeric', precision: 18, scale: 4 }) unitPrice: string;
  @CreateDateColumn() createdAt: Date;
}

@Entity('payouts')
@Index('IDX_payout_tenant_status', ['tenantId', 'status'])
export class Payout {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() syncedOrderId: string;
  @Column() sourceTenantId: string;
  @Column() vendorTenantId: string;
  @Column({ type: 'numeric', precision: 18, scale: 4 }) grossAmount: string;
  @Column({ type: 'numeric', precision: 18, scale: 4 })
  commissionAmount: string;
  @Column({ type: 'numeric', precision: 18, scale: 4 }) netAmount: string;
  @Column() currency: string;
  @Column({ type: 'enum', enum: PayoutStatus, default: PayoutStatus.PENDING })
  status: PayoutStatus;
  @Column({ type: 'timestamptz', nullable: true }) paidAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
