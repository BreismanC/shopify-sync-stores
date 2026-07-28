import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Index,
  BeforeInsert,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { StoreRole } from '../enums/store-role.enum';
import * as crypto from 'crypto';

@Entity('stores')
@Index('UQ_stores_storeKey', ['storeKey'], { unique: true })
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  shopifyShopId: string;

  @Column()
  accessToken: string;

  @Column({
    type: 'enum',
    enum: StoreRole,
  })
  role: StoreRole;

  @Column({ default: true })
  isActive: boolean;

  @Column({
    type: 'varchar',
    length: 64,
    unique: true,
    nullable: true,
  })
  storeKey: string | null;

  @ManyToOne(() => Tenant)
  tenant: Tenant;

  @Column()
  tenantId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateStoreKeyIfMissing() {
    if (!this.storeKey) {
      this.storeKey = generateStoreKey();
    }
  }
}

export function generateStoreKey(): string {
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

export function normalizeStoreKey(value: string): string {
  return (value ?? '').trim().toUpperCase();
}
