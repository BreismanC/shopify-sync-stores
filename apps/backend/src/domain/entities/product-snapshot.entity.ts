import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from './store.entity';

@Entity('product_snapshots')
@Unique('UQ_product_snapshot_store_shopify', ['storeId', 'shopifyProductId'])
@Index('IDX_product_snapshot_tenant_updated', ['tenantId', 'shopifyUpdatedAt'])
export class ProductSnapshot {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() storeId: string;
  @ManyToOne(() => Store, { onDelete: 'CASCADE' }) store: Store;
  @Column() shopifyProductId: string;
  @Column() title: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', nullable: true }) vendor: string | null;
  @Column({ type: 'varchar', nullable: true }) productType: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) tags: string[];
  @Column({ default: 'draft' }) status: string;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) images: unknown[];
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
  @Column({ type: 'timestamptz', nullable: true })
  shopifyCreatedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true })
  shopifyUpdatedAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) deletedAt: Date | null;
  @OneToMany(() => ProductVariantSnapshot, (variant) => variant.product, {
    cascade: true,
  })
  variants: ProductVariantSnapshot[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('product_variant_snapshots')
@Unique('UQ_product_variant_store_shopify', ['storeId', 'shopifyVariantId'])
@Index('IDX_product_variant_tenant_sku', ['tenantId', 'sku'])
export class ProductVariantSnapshot {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column() storeId: string;
  @Column() productId: string;
  @ManyToOne(() => ProductSnapshot, (product) => product.variants, {
    onDelete: 'CASCADE',
  })
  product: ProductSnapshot;
  @Column() shopifyVariantId: string;
  @Column({ type: 'varchar', nullable: true }) shopifyInventoryItemId:
    | string
    | null;
  @Column({ type: 'varchar', nullable: true }) title: string | null;
  @Column({ type: 'varchar', nullable: true }) sku: string | null;
  @Column({ type: 'varchar', nullable: true }) barcode: string | null;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 0 })
  price: string;
  @Column({ type: 'integer', default: 0 }) inventoryQuantity: number;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
