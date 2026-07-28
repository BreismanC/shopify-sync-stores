import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('notifications')
@Index('IDX_notification_tenant_read_created', [
  'tenantId',
  'readAt',
  'createdAt',
])
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() tenantId: string;
  @Column({ type: 'uuid', nullable: true }) userId: string | null;
  @Column() type: string;
  @Column() title: string;
  @Column({ type: 'text' }) message: string;
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" }) payload: Record<
    string,
    unknown
  >;
  @Column({ type: 'uuid', nullable: true }) eventId: string | null;
  @Column({ type: 'timestamptz', nullable: true }) readAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) archivedAt: Date | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('webhook_deliveries')
@Unique('UQ_webhook_shop_event', ['shopDomain', 'shopifyEventId'])
@Index('IDX_webhook_status_created', ['status', 'createdAt'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) tenantId: string | null;
  @Column() shopDomain: string;
  @Column() topic: string;
  @Column() shopifyEventId: string;
  @Column() payloadHash: string;
  @Column({ default: 'RECEIVED' }) status: string;
  @Column({ type: 'jsonb' }) payload: Record<string, unknown>;
  @Column({ type: 'timestamptz', nullable: true }) triggeredAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) processedAt: Date | null;
  @Column({ type: 'text', nullable: true }) error: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
