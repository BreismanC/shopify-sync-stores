import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  ManyToOne,
  Unique,
  Index,
  JoinColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { User } from './user.entity';

@Entity('store_connections')
@Unique('UQ_store_connections_source_vendor', ['sourceStoreId', 'vendorStoreId'])
@Index('IDX_store_connections_source', ['sourceStoreId'])
@Index('IDX_store_connections_vendor', ['vendorStoreId'])
export class StoreConnection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceStoreId' })
  sourceStore: Store;

  @Column()
  sourceStoreId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorStoreId' })
  vendorStore: Store;

  @Column()
  vendorStoreId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'initiatedByStoreId' })
  initiatedByStore: Store;

  @Column()
  initiatedByStoreId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  initiatedByUser: User | null;

  @Column({ nullable: true })
  initiatedByUserId: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz' })
  connectedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  disconnectedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
